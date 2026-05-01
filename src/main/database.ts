import Database from "better-sqlite3";
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

let db: Database.Database | null = null;

const defaultPlatforms = [
  ["Sega Genesis", "Consoles"],
  ["Nintendo 64", "Consoles"],
  ["Sega Saturn", "Consoles"],
  ["Game Boy", "Portateis"],
  ["SNES", "Consoles"],
  ["NES", "Consoles"]
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
  seedPlatforms(db);
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
      owned_physical INTEGER NOT NULL DEFAULT 0,
      physical_condition TEXT,
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

function seedPlatforms(database: Database.Database): void {
  const count = database.prepare("SELECT COUNT(*) as count FROM platforms").get() as { count: number };
  if (count.count > 0) return;

  const insert = database.prepare("INSERT INTO platforms (name, category) VALUES (?, ?)");
  const transaction = database.transaction(() => {
    for (const platform of defaultPlatforms) insert.run(platform[0], platform[1]);
  });
  transaction();
}

export function closeDatabase(): void {
  db?.close();
  db = null;
}
