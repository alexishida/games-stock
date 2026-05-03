import Database from "better-sqlite3";
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

let db: Database.Database | null = null;

const defaultPlatforms = [
  ["Sega Mega Drive", "Consoles"],
  ["Super Nintendo", "Consoles"],
  ["Nintendo 64", "Consoles"],
  ["Nintendo Entertainment System", "Consoles"],
  ["Game Boy Advance", "Portateis"],
  ["Game Boy", "Portateis"],
  ["Game Boy Color", "Portateis"],
  ["PlayStation", "Consoles"],
  ["PlayStation 2", "Consoles"],
  ["Sega Master System", "Consoles"],
  ["Sega Game Gear", "Portateis"],
  ["Atari 2600", "Consoles"],
  ["Sega Saturn", "Consoles"],
  ["Sega Dreamcast", "Consoles"],
  ["Nintendo DS", "Portateis"],
];

// oldName → canonical name in defaultPlatforms
const platformAliases: [string, string][] = [
  ["Sega Genesis", "Sega Mega Drive"],
  ["NES", "Nintendo Entertainment System"],
];

export function getUserDataDir(): string {
  return path.join(app.getPath("appData"), "GameStock");
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
  seedPlatforms(db);
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

function addColumnIfMissing(database: Database.Database, table: string, column: string, definition: string): void {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function migratePlatformAliases(database: Database.Database): void {
  const transaction = database.transaction(() => {
    for (const [oldName, canonicalName] of platformAliases) {
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
    for (const platform of defaultPlatforms) {
      insert.run(platform[0], platform[1]);
      update.run(platform[0]);
    }
  });
  transaction();
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
