-- Fixture sintética congelada do Electron; não contém dados pessoais.
BEGIN TRANSACTION;
CREATE TABLE games (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
        platform_id INTEGER NOT NULL REFERENCES platforms(id), publisher TEXT,
        year INTEGER, genre TEXT, rating TEXT, box_art_path TEXT,
        background_path TEXT, screenshot_path TEXT, rom_path TEXT,
        favorite INTEGER NOT NULL DEFAULT 0, play_status TEXT NOT NULL DEFAULT 'unplayed',
        notes TEXT, launchbox_id TEXT, launch_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
INSERT INTO "games" VALUES(90001,'Aventura Legada',90001,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,'unplayed','Anotação preservada: ação e coleção',NULL,7,'2026-11-05 01:27:37','2026-11-05 01:27:37');
CREATE TABLE platforms (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
INSERT INTO "platforms" VALUES(90001,'Fixture Console','Console','2026-11-05 01:27:37');
DELETE FROM "sqlite_sequence";
INSERT INTO "sqlite_sequence" VALUES('platforms',90001);
INSERT INTO "sqlite_sequence" VALUES('games',90001);
COMMIT;
