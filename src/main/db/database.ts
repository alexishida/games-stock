import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { getAppUserDataDir } from "../appPaths";
import { LEGACY_PLATFORM_ALIASES, PLATFORM_CATALOG } from "./platformCatalog";

let db: Database.Database | null = null;

export function getUserDataDir(): string {
  return getAppUserDataDir();
}

export function getImagesDir(): string {
  return path.join(getUserDataDir(), "images");
}

export function getDatabase(): Database.Database {
  if (db) return db;

  const dataDir = getUserDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(getImagesDir(), { recursive: true });

  db = new Database(path.join(dataDir, "gamestock.db"));
  db.pragma("foreign_keys = ON");
  applySchema(db);
  migratePlatformAliases(db);
  dedupeGamesByLaunchBoxId(db);
  ensureGamesLaunchBoxUniqueIndex(db);
  seedPlatforms(db);
  seedPlatformMappings(db);
  seedEmulators(db);
  backfillCachedCoverPaths(db);
  return db;
}

function applySchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS platforms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      platform_id INTEGER NOT NULL,
      publisher TEXT,
      year INTEGER,
      genre TEXT,
      rating TEXT,
      box_art_path TEXT,
      background_path TEXT,
      screenshot_path TEXT,
      rom_path TEXT,
      favorite INTEGER NOT NULL DEFAULT 0,
      play_status TEXT NOT NULL DEFAULT 'unplayed',
      notes TEXT,
      launchbox_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_games_title ON games(title);
    CREATE INDEX IF NOT EXISTS idx_games_platform ON games(platform_id);
    CREATE INDEX IF NOT EXISTS idx_games_launchbox ON games(launchbox_id);

    CREATE TABLE IF NOT EXISTS platform_launchbox_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
      alias TEXT NOT NULL COLLATE NOCASE UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS platform_rom_extensions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
      extension TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT '',
      is_primary INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(platform_id, extension)
    );

    CREATE TABLE IF NOT EXISTS emulators (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL UNIQUE,
      executable   TEXT    NOT NULL DEFAULT '',
      args         TEXT    NOT NULL DEFAULT '',
      is_retroarch INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS platform_emulators (
      platform_id  INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
      emulator_id  INTEGER NOT NULL REFERENCES emulators(id) ON DELETE CASCADE,
      is_default   INTEGER NOT NULL DEFAULT 0,
      core_path    TEXT,
      PRIMARY KEY (platform_id, emulator_id)
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TRIGGER IF NOT EXISTS trg_platform_emulators_single_default_insert
    BEFORE INSERT ON platform_emulators
    WHEN NEW.is_default = 1
    BEGIN
      UPDATE platform_emulators SET is_default = 0 WHERE platform_id = NEW.platform_id;
    END;

    CREATE TRIGGER IF NOT EXISTS trg_platform_emulators_single_default_update
    BEFORE UPDATE OF is_default ON platform_emulators
    WHEN NEW.is_default = 1
    BEGIN
      UPDATE platform_emulators SET is_default = 0
      WHERE platform_id = NEW.platform_id AND emulator_id != NEW.emulator_id;
    END;
  `);

  addColumnIfMissing(database, "games", "favorite", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(database, "games", "play_status", "TEXT NOT NULL DEFAULT 'unplayed'");
  addColumnIfMissing(database, "games", "background_path", "TEXT");
  addColumnIfMissing(database, "games", "screenshot_path", "TEXT");
  addColumnIfMissing(database, "games", "rom_path", "TEXT");
  addColumnIfMissing(database, "games", "launchbox_id", "TEXT");
  addColumnIfMissing(database, "platforms", "is_default", "INTEGER NOT NULL DEFAULT 0");

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_games_favorite ON games(favorite);
    CREATE INDEX IF NOT EXISTS idx_games_play_status ON games(play_status);
    CREATE INDEX IF NOT EXISTS idx_games_rom_path ON games(rom_path);
  `);
}

function ensureGamesLaunchBoxUniqueIndex(database: Database.Database): void {
  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_games_platform_launchbox_unique
    ON games(platform_id, launchbox_id)
    WHERE launchbox_id IS NOT NULL AND TRIM(launchbox_id) != '';
  `);
}

function dedupeGamesByLaunchBoxId(database: Database.Database): void {
  const duplicateGroups = database.prepare(`
    SELECT
      platform_id,
      launchbox_id
    FROM games
    WHERE launchbox_id IS NOT NULL AND TRIM(launchbox_id) != ''
    GROUP BY platform_id, launchbox_id
    HAVING COUNT(*) > 1
  `).all() as Array<{ platform_id: number; launchbox_id: string }>;

  if (!duplicateGroups.length) return;

  const selectDuplicates = database.prepare(`
    SELECT *
    FROM games
    WHERE platform_id = ? AND launchbox_id = ?
    ORDER BY updated_at DESC, created_at DESC, id DESC
  `);
  const updateMerged = database.prepare(`
    UPDATE games
    SET
      title = ?,
      publisher = ?,
      year = ?,
      genre = ?,
      rating = ?,
      box_art_path = ?,
      background_path = ?,
      screenshot_path = ?,
      rom_path = ?,
      favorite = ?,
      play_status = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const deleteGame = database.prepare("DELETE FROM games WHERE id = ?");

  database.transaction(() => {
    for (const group of duplicateGroups) {
      const duplicates = selectDuplicates.all(group.platform_id, group.launchbox_id) as GameRecord[];
      if (duplicates.length < 2) continue;

      const survivor = duplicates[0];
      const merged = duplicates.slice(1).reduce(mergeGameRecord, survivor);

      updateMerged.run(
        merged.title,
        merged.publisher,
        merged.year,
        merged.genre,
        merged.rating,
        merged.box_art_path,
        merged.background_path,
        merged.screenshot_path,
        merged.rom_path,
        merged.favorite,
        merged.play_status,
        merged.notes,
        survivor.id
      );

      for (const duplicate of duplicates.slice(1)) {
        deleteGame.run(duplicate.id);
      }
    }
  })();
}

interface GameRecord {
  id: number;
  title: string;
  publisher: string | null;
  year: number | null;
  genre: string | null;
  rating: string | null;
  box_art_path: string | null;
  background_path: string | null;
  screenshot_path: string | null;
  rom_path: string | null;
  favorite: number;
  play_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mergeGameRecord(preferred: GameRecord, candidate: GameRecord): GameRecord {
  return {
    ...preferred,
    title: pickPreferredString(preferred.title, candidate.title) ?? preferred.title,
    publisher: pickPreferredString(preferred.publisher, candidate.publisher),
    year: preferred.year ?? candidate.year,
    genre: pickPreferredString(preferred.genre, candidate.genre),
    rating: pickPreferredString(preferred.rating, candidate.rating),
    box_art_path: pickPreferredString(preferred.box_art_path, candidate.box_art_path),
    background_path: pickPreferredString(preferred.background_path, candidate.background_path),
    screenshot_path: pickPreferredString(preferred.screenshot_path, candidate.screenshot_path),
    rom_path: pickPreferredString(preferred.rom_path, candidate.rom_path),
    favorite: preferred.favorite || candidate.favorite ? 1 : 0,
    play_status: preferred.play_status !== "unplayed" ? preferred.play_status : candidate.play_status,
    notes: pickPreferredString(preferred.notes, candidate.notes)
  };
}

function pickPreferredString(primary: string | null, fallback: string | null): string | null {
  if (primary && primary.trim()) return primary;
  if (fallback && fallback.trim()) return fallback;
  return null;
}

function addColumnIfMissing(database: Database.Database, table: string, column: string, definition: string): void {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function migratePlatformAliases(database: Database.Database): void {
  const transaction = database.transaction(() => {
    for (const [oldName, canonicalName] of LEGACY_PLATFORM_ALIASES) {
      const old = database.prepare("SELECT id FROM platforms WHERE name = ?").get(oldName) as { id: number } | undefined;
      if (!old) continue;
      const canonical = database.prepare("SELECT id FROM platforms WHERE name = ?").get(canonicalName) as { id: number } | undefined;
      if (canonical) {
        database.prepare("UPDATE games SET platform_id = ? WHERE platform_id = ?").run(canonical.id, old.id);
        database.prepare("DELETE FROM platforms WHERE id = ?").run(old.id);
      } else {
        database.prepare("UPDATE platforms SET name = ?, is_default = 1 WHERE id = ?").run(canonicalName, old.id);
      }
    }
  });
  transaction();
}

function seedPlatforms(database: Database.Database): void {
  const insert = database.prepare("INSERT OR IGNORE INTO platforms (name, category, is_default) VALUES (?, ?, 1)");
  const update = database.prepare("UPDATE platforms SET is_default = 1 WHERE name = ? AND is_default = 0");
  const transaction = database.transaction(() => {
    for (const platform of PLATFORM_CATALOG) {
      insert.run(platform.name, platform.category);
      update.run(platform.name);
    }
  });
  transaction();
}

function seedPlatformMappings(database: Database.Database): void {
  const findPlatformId = database.prepare("SELECT id FROM platforms WHERE name = ?");
  const insertAlias = database.prepare("INSERT OR IGNORE INTO platform_launchbox_aliases (platform_id, alias) VALUES (?, ?)");
  const insertExtension = database.prepare(`
    INSERT OR IGNORE INTO platform_rom_extensions (platform_id, extension, kind, is_primary)
    VALUES (?, ?, ?, ?)
  `);

  const transaction = database.transaction(() => {
    for (const platform of PLATFORM_CATALOG) {
      const row = findPlatformId.get(platform.name) as { id: number } | undefined;
      if (!row) continue;

      insertAlias.run(row.id, platform.name);
      for (const alias of platform.launchboxAliases) {
        insertAlias.run(row.id, alias);
      }

      for (const extension of platform.romExtensions) {
        insertExtension.run(row.id, extension.extension.toLowerCase(), extension.kind, extension.isPrimary ? 1 : 0);
      }
    }
  });

  transaction();
}

function seedEmulators(database: Database.Database): void {
  database.prepare("INSERT OR IGNORE INTO emulators (name, executable, is_retroarch) VALUES ('RetroArch', '', 1)").run();
}

function backfillCachedCoverPaths(database: Database.Database): void {
  const rows = database
    .prepare(`
      SELECT games.id, games.title, platforms.name as platform_name
      FROM games
      JOIN platforms ON platforms.id = games.platform_id
      WHERE games.box_art_path IS NULL OR games.box_art_path = ''
    `)
    .all() as Array<{ id: number; title: string; platform_name: string }>;

  if (!rows.length) return;

  const update = database.prepare("UPDATE games SET box_art_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
  const repair = database.transaction((items: Array<{ id: number; title: string; platform_name: string }>) => {
    for (const item of items) {
      const coverPath = path.join(getImagesDir(), sanitizeMediaPath(item.platform_name), sanitizeMediaPath(item.title), "cover.jpg");
      if (fs.existsSync(coverPath)) update.run(coverPath, item.id);
    }
  });

  repair(rows);
}

function sanitizeMediaPath(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

export function closeDatabase(): void {
  db?.close();
  db = null;
}
