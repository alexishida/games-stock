-- Fixture sintética congelada do Electron; não contém dados pessoais.
BEGIN TRANSACTION;
CREATE TABLE app_state (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
INSERT INTO "app_state" VALUES('gamestock.romImport.folderEntries','[{"folderPath":"__FIXTURE_PROFILE__\\ROMs com espaço\\Ação","platformId":90001,"platformName":"Fixture Console","indexedCount":2}]','2026-11-05 01:27:37');
INSERT INTO "app_state" VALUES('gamestock.media.lastRomImportJob','{"jobId":"fixture-rom-running","folderPaths":["__FIXTURE_PROFILE__\\ROMs com espaço\\Ação"],"romFilePaths":[],"platformId":90001,"platformName":"Fixture Console","status":"running","startedAt":"2026-01-01T00:00:00.000Z","progress":{"jobId":"fixture-rom-running","current":1,"total":2,"stage":"matching","message":"Processando"}}','2026-11-05 01:27:37');
INSERT INTO "app_state" VALUES('gamestock.dataPortability.jobs','[{"jobId":"fixture-backup-running","kind":"export","status":"running","startedAt":"2026-01-01T00:00:00.000Z","progress":{"jobId":"fixture-backup-running","kind":"export","current":1,"total":5,"stage":"metadata","message":"Exportando"}}]','2026-11-05 01:27:37');
CREATE TABLE conservation_states (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
INSERT INTO "conservation_states" VALUES(1,'Novo',1,'2026-11-05 01:27:37');
INSERT INTO "conservation_states" VALUES(2,'Ótimo',1,'2026-11-05 01:27:37');
INSERT INTO "conservation_states" VALUES(3,'Bom',1,'2026-11-05 01:27:37');
INSERT INTO "conservation_states" VALUES(4,'Ruim',1,'2026-11-05 01:27:37');
INSERT INTO "conservation_states" VALUES(5,'Com Defeito',1,'2026-11-05 01:27:37');
CREATE TABLE emulators (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL UNIQUE,
      executable   TEXT    NOT NULL DEFAULT '',
      args         TEXT    NOT NULL DEFAULT '',
      is_retroarch INTEGER NOT NULL DEFAULT 0,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );
INSERT INTO "emulators" VALUES(1,'RetroArch','','',1,'2026-11-05 01:27:37');
INSERT INTO "emulators" VALUES(2,'TeknoParrot','','--profile={romFileName} --startMinimized',0,'2026-11-05 01:27:37');
INSERT INTO "emulators" VALUES(3,'Emulador sintético','__FIXTURE_EMULATOR__','',0,'2026-11-05 01:27:38');
CREATE TABLE games (
        id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
        platform_id INTEGER NOT NULL REFERENCES platforms(id), publisher TEXT,
        year INTEGER, genre TEXT, rating TEXT, box_art_path TEXT,
        background_path TEXT, screenshot_path TEXT, rom_path TEXT,
        favorite INTEGER NOT NULL DEFAULT 0, play_status TEXT NOT NULL DEFAULT 'unplayed',
        notes TEXT, launchbox_id TEXT, launch_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      , library_group_key TEXT);
INSERT INTO "games" VALUES(90001,'Aventura Legada',90001,NULL,1990,'Action; Platform',NULL,'__FIXTURE_PROFILE__\images\fixture\cover.png',NULL,NULL,'__FIXTURE_PROFILE__\ROMs com espaço\Ação\Aventura (Brasil).nes',1,'unplayed','Anotação preservada: ação e coleção',NULL,7,'2026-11-05 01:27:37','2026-11-05 01:27:37','aventura legada');
INSERT INTO "games" VALUES(90002,'Aventura Legada',90001,NULL,1991,'Platform',NULL,NULL,NULL,NULL,'__FIXTURE_PROFILE__\ROMs com espaço\Ação\Aventura (Europa).nes',0,'completed',NULL,NULL,0,'2026-11-05 01:27:37','2026-11-05 01:27:37','aventura legada');
INSERT INTO "games" VALUES(90003,'Jogo sem capa',90001,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,'playing','Sem mídia é um estado válido',NULL,0,'2026-11-05 01:27:37','2026-11-05 01:27:37',NULL);
CREATE TABLE hardware_item_photos (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id    INTEGER NOT NULL REFERENCES hardware_items(id) ON DELETE CASCADE,
      file_path  TEXT    NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
INSERT INTO "hardware_item_photos" VALUES(1,1,'__FIXTURE_PROFILE__\inventario\images\controle.png',0,'2026-11-05 01:27:37');
CREATE TABLE hardware_items (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      name                  TEXT    NOT NULL,
      platform_id           INTEGER REFERENCES platforms(id) ON DELETE SET NULL,
      is_multiplatform      INTEGER NOT NULL DEFAULT 0,
      item_type_id          INTEGER REFERENCES item_types(id) ON DELETE SET NULL,
      conservation_state_id INTEGER REFERENCES conservation_states(id) ON DELETE SET NULL,
      description           TEXT    NOT NULL DEFAULT '',
      acquisition_date      TEXT,
      acquisition_url       TEXT,
      color                 TEXT,
      value                 REAL,
      serial_number         TEXT,
      region                TEXT,
      storage_location      TEXT,
      loan_to               TEXT,
      created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
    );
INSERT INTO "hardware_items" VALUES(1,'Controle de teste',90001,0,NULL,NULL,'Item sintético com foto',NULL,NULL,'Preto',123.45,NULL,NULL,NULL,NULL,'2026-11-05 01:27:37','2026-11-05 01:27:37');
INSERT INTO "hardware_items" VALUES(2,'Cabo multiplataforma',NULL,1,NULL,NULL,'Não cria plataforma na biblioteca',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-11-05 01:27:37','2026-11-05 01:27:37');
CREATE TABLE item_types (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
INSERT INTO "item_types" VALUES(1,'Console',1,'2026-11-05 01:27:37');
INSERT INTO "item_types" VALUES(2,'Controle',1,'2026-11-05 01:27:37');
INSERT INTO "item_types" VALUES(3,'Cabo de Energia',1,'2026-11-05 01:27:37');
INSERT INTO "item_types" VALUES(4,'Cabo de Vídeo',1,'2026-11-05 01:27:37');
INSERT INTO "item_types" VALUES(5,'Cartucho/Mídia',1,'2026-11-05 01:27:37');
INSERT INTO "item_types" VALUES(6,'Memória/Memory Card',1,'2026-11-05 01:27:37');
INSERT INTO "item_types" VALUES(7,'Acessório',1,'2026-11-05 01:27:37');
INSERT INTO "item_types" VALUES(8,'Outros',1,'2026-11-05 01:27:37');
CREATE TABLE platform_emulators (
      platform_id  INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
      emulator_id  INTEGER NOT NULL REFERENCES emulators(id) ON DELETE CASCADE,
      is_default   INTEGER NOT NULL DEFAULT 0,
      core_path    TEXT,
      PRIMARY KEY (platform_id, emulator_id)
    );
INSERT INTO "platform_emulators" VALUES(90035,2,1,NULL);
INSERT INTO "platform_emulators" VALUES(90001,3,1,NULL);
CREATE TABLE platform_launchbox_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
      alias TEXT NOT NULL COLLATE NOCASE UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
INSERT INTO "platform_launchbox_aliases" VALUES(1,90002,'Arcade','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(3,90002,'MAME','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(4,90003,'Capcom CPS-1','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(5,90003,'Arcade - Capcom CPS-1','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(7,90004,'Capcom CPS-2','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(8,90004,'Arcade - Capcom CPS-2','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(10,90005,'Capcom CPS-3','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(11,90005,'Arcade - Capcom CPS-3','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(13,90006,'Atari 2600','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(15,90007,'Atari 7800','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(17,90008,'Commodore 64','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(19,90008,'Commodore C64','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(20,90008,'C64','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(21,90009,'Commodore Amiga','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(23,90009,'Amiga','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(24,90010,'Game Boy','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(25,90010,'Nintendo Game Boy','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(27,90011,'Game Boy Advance','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(28,90011,'Nintendo Game Boy Advance','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(30,90011,'GBA','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(31,90012,'Game Boy Color','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(32,90012,'Nintendo Game Boy Color','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(34,90012,'GBC','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(35,90013,'Nintendo 64','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(37,90013,'N64','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(38,90014,'Nintendo DS','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(40,90014,'NDS','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(41,90015,'Nintendo NES','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(42,90015,'Nintendo Entertainment System','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(43,90015,'Nintendo NES / Famicom','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(44,90015,'NES','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(45,90015,'Famicom','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(46,90016,'Nintendo GameCube','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(48,90016,'GameCube','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(49,90017,'Nintendo Wii','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(51,90017,'Wii','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(52,90018,'Sony PlayStation','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(53,90018,'PlayStation','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(56,90018,'PS1','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(57,90019,'Sony PlayStation 2','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(58,90019,'PlayStation 2','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(61,90019,'PS2','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(62,90020,'Sega CD','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(64,90020,'Mega-CD','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(65,90020,'Mega CD','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(66,90021,'Sega Dreamcast','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(68,90021,'Dreamcast','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(69,90022,'Sega Game Gear','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(71,90022,'Game Gear','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(72,90023,'Sega Master System','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(74,90023,'Master System','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(75,90024,'Sega Mega Drive','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(77,90024,'Sega Genesis','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(78,90024,'Mega Drive','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(79,90024,'Sega Mega Drive / Genesis','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(80,90025,'Sega Saturn','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(82,90025,'Saturn','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(83,90026,'Super Nintendo','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(85,90026,'Super Nintendo Entertainment System','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(86,90026,'SNES','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(87,90026,'Super Famicom','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(88,90026,'Nintendo Super Famicom','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(90,90027,'Game Engine','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(91,90027,'Game Engine (SCUMM/etc.)','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(92,90027,'ScummVM','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(93,90028,'Sammy Atomiswave','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(95,90028,'Atomiswave','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(96,90029,'Sega Model 2','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(98,90029,'Arcade - Sega Model 2','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(99,90030,'Sega Model 3','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(101,90030,'Arcade - Sega Model 3','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(102,90031,'Sega Naomi','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(104,90031,'Naomi','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(105,90032,'Sega Naomi 2','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(107,90032,'Naomi 2','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(108,90033,'SNK Neo Geo MVS','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(110,90033,'Neo Geo MVS','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(111,90034,'Taito Type X','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(113,90034,'Taito Type X2','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(114,90034,'Taito Type X3','2026-11-05 01:27:37');
INSERT INTO "platform_launchbox_aliases" VALUES(115,90035,'TeknoParrot','2026-11-05 01:27:37');
CREATE TABLE platform_rom_extensions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
      extension TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT '',
      is_primary INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(platform_id, extension)
    );
INSERT INTO "platform_rom_extensions" VALUES(1,90002,'.chd','Imagem de disco arcade',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(2,90002,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(3,90002,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(4,90003,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(5,90003,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(6,90004,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(7,90004,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(8,90005,'.chd','Imagem de disco CPS-3',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(9,90005,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(10,90005,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(11,90006,'.a26','Cartucho ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(12,90006,'.bin','Binario generico',0,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(13,90006,'.rom','ROM generica',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(14,90006,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(15,90006,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(16,90007,'.a78','Cartucho ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(17,90007,'.bin','Binario generico',0,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(18,90007,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(19,90007,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(20,90008,'.d64','Imagem de disquete 1541',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(21,90008,'.t64','Tape archive',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(22,90008,'.prg','Programa executavel',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(23,90008,'.crt','Imagem de cartucho',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(24,90008,'.tap','Imagem de fita',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(25,90008,'.g64','Imagem de disquete',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(26,90008,'.nib','Imagem de disquete',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(27,90008,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(28,90008,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(29,90009,'.adf','Amiga Disk File',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(30,90009,'.dms','Disk Masher System',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(31,90009,'.lha','Arquivo LHA',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(32,90009,'.ipf','Preservation format',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(33,90009,'.hdf','Hard Disk File',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(34,90009,'.adz','ADF comprimido',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(35,90009,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(36,90009,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(37,90010,'.gb','Cartucho ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(38,90010,'.sgb','Super Game Boy ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(39,90010,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(40,90010,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(41,90011,'.gba','Cartucho ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(42,90011,'.agb','Cartucho ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(43,90011,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(44,90011,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(45,90012,'.gbc','Cartucho ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(46,90012,'.cgb','Cartucho ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(47,90012,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(48,90012,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(49,90013,'.n64','Cartucho ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(50,90013,'.z64','Cartucho ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(51,90013,'.v64','Cartucho ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(52,90013,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(53,90013,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(54,90014,'.nds','Cartucho ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(55,90014,'.dsi','Cartucho DSi Enhanced',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(56,90014,'.ids','Cartucho ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(57,90014,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(58,90014,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(59,90015,'.nes','iNES format',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(60,90015,'.unf','UNIF format',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(61,90015,'.unif','UNIF format',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(62,90015,'.fds','Famicom Disk System',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(63,90015,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(64,90015,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(65,90016,'.iso','Imagem de disco',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(66,90016,'.gcm','GameCube Master Disc Image',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(67,90016,'.rvz','RVZ compressed image',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(68,90016,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(69,90016,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(70,90017,'.iso','Imagem de disco',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(71,90017,'.wbfs','Wii Backup File System',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(72,90017,'.rvz','RVZ compressed image',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(73,90017,'.wad','Wii Channel package',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(74,90017,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(75,90017,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(76,90018,'.cue','Imagem de CD',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(77,90018,'.img','Imagem de CD',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(78,90018,'.iso','Imagem ISO',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(79,90018,'.pbp','Eboot comprimido',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(80,90018,'.chd','Compressed Hunks of Data',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(81,90018,'.bin','BIN de faixa',0,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(82,90018,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(83,90018,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(84,90019,'.iso','Imagem ISO',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(85,90019,'.cue','Imagem de CD/DVD',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(86,90019,'.chd','Compressed Hunks of Data',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(87,90019,'.cso','Compressed ISO',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(88,90019,'.bin','BIN de faixa',0,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(89,90019,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(90,90019,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(91,90020,'.cue','Imagem de CD',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(92,90020,'.iso','Imagem ISO',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(93,90020,'.chd','Compressed Hunks of Data',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(94,90020,'.img','Imagem de CD',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(95,90020,'.bin','BIN de faixa',0,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(96,90020,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(97,90020,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(98,90021,'.gdi','GD-ROM dump',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(99,90021,'.cdi','DiscJuggler image',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(100,90021,'.chd','Compressed Hunks of Data',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(101,90021,'.iso','Imagem ISO',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(102,90021,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(103,90021,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(104,90022,'.gg','Cartucho ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(105,90022,'.bin','Binario generico',0,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(106,90022,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(107,90022,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(108,90023,'.sms','Cartucho ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(109,90023,'.bin','Binario generico',0,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(110,90023,'.sg','SG format',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(111,90023,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(112,90023,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(113,90024,'.md','Cartucho ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(114,90024,'.gen','Cartucho ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(115,90024,'.smd','Super Magic Drive format',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(116,90024,'.68k','Cartucho ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(117,90024,'.bin','Binario generico',0,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(118,90024,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(119,90024,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(120,90025,'.cue','Imagem de CD',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(121,90025,'.iso','Imagem ISO',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(122,90025,'.chd','Compressed Hunks of Data',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(123,90025,'.mds','Alcohol 120% image',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(124,90025,'.bin','BIN de faixa',0,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(125,90025,'.mdf','Arquivo de dados MDS',0,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(126,90025,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(127,90025,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(128,90026,'.sfc','Cartucho ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(129,90026,'.smc','Super Magic Card format',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(130,90026,'.fig','Cartucho ROM',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(131,90026,'.bin','Binario generico',0,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(132,90026,'.swc','Super Wild Card format',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(133,90026,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(134,90026,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(135,90027,'.dat','Arquivo de dados',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(136,90027,'.pak','Pacote de assets',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(137,90027,'.wad','WAD',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(138,90027,'.grp','Build Engine Group File',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(139,90027,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(140,90027,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(141,90028,'.bin','Imagem de cartucho arcade',0,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(142,90028,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(143,90028,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(144,90029,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(145,90029,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(146,90030,'.zip','Conjunto de ROM Model 3',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(147,90031,'.bin','Imagem de cartucho arcade',0,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(148,90031,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(149,90031,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(150,90032,'.bin','Imagem de cartucho arcade',0,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(151,90032,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(152,90032,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(153,90033,'.7z','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(154,90033,'.zip','Arquivo compactado',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(155,90034,'.exe','Executavel do jogo arcade',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(156,90034,'.bat','Script de inicializacao arcade',1,'2026-11-05 01:27:37');
INSERT INTO "platform_rom_extensions" VALUES(157,90035,'.xml','Perfil de jogo TeknoParrot',1,'2026-11-05 01:27:37');
CREATE TABLE platforms (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      , is_default INTEGER NOT NULL DEFAULT 0);
INSERT INTO "platforms" VALUES(90001,'Fixture Console','Console','2026-11-05 01:27:37',0);
INSERT INTO "platforms" VALUES(90002,'Arcade','Arcade','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90003,'Capcom CPS-1','Arcade','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90004,'Capcom CPS-2','Arcade','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90005,'Capcom CPS-3','Arcade','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90006,'Atari 2600','Consoles','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90007,'Atari 7800','Consoles','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90008,'Commodore 64','PC','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90009,'Commodore Amiga','PC','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90010,'Game Boy','Portateis','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90011,'Game Boy Advance','Portateis','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90012,'Game Boy Color','Portateis','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90013,'Nintendo 64','Consoles','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90014,'Nintendo DS','Portateis','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90015,'Nintendo NES','Consoles','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90016,'Nintendo GameCube','Consoles','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90017,'Nintendo Wii','Consoles','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90018,'Sony PlayStation','Consoles','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90019,'Sony PlayStation 2','Consoles','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90020,'Sega CD','Consoles','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90021,'Sega Dreamcast','Consoles','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90022,'Sega Game Gear','Portateis','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90023,'Sega Master System','Consoles','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90024,'Sega Mega Drive','Consoles','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90025,'Sega Saturn','Consoles','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90026,'Super Nintendo','Consoles','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90027,'Game Engine','PC','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90028,'Sammy Atomiswave','Arcade','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90029,'Sega Model 2','Arcade','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90030,'Sega Model 3','Arcade','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90031,'Sega Naomi','Arcade','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90032,'Sega Naomi 2','Arcade','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90033,'SNK Neo Geo MVS','Arcade','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90034,'Taito Type X','Arcade','2026-11-05 01:27:37',1);
INSERT INTO "platforms" VALUES(90035,'TeknoParrot','Arcade','2026-11-05 01:27:37',1);
CREATE TABLE schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
INSERT INTO "schema_migrations" VALUES('platform-aliases-v1','2026-11-05 01:27:37');
INSERT INTO "schema_migrations" VALUES('dedupe-launchbox-games-v1','2026-11-05 01:27:37');
INSERT INTO "schema_migrations" VALUES('hardware-conservation-states-v1','2026-11-05 01:27:37');
INSERT INTO "schema_migrations" VALUES('teknoparrot-profile-filename-v1','2026-11-05 01:27:37');
INSERT INTO "schema_migrations" VALUES('rom-variant-titles-v1','2026-11-05 01:27:37');
INSERT INTO "schema_migrations" VALUES('cached-cover-paths-v1','2026-11-05 01:27:37');
INSERT INTO "schema_migrations" VALUES('library-group-key-v1','2026-11-05 01:27:37');
CREATE INDEX idx_games_title ON games(title);
CREATE INDEX idx_games_platform ON games(platform_id);
CREATE INDEX idx_games_platform_title ON games(platform_id, title COLLATE NOCASE);
CREATE INDEX idx_games_launchbox ON games(launchbox_id);
CREATE TRIGGER trg_platform_emulators_single_default_insert
    BEFORE INSERT ON platform_emulators
    WHEN NEW.is_default = 1
    BEGIN
      UPDATE platform_emulators SET is_default = 0 WHERE platform_id = NEW.platform_id;
    END;
CREATE TRIGGER trg_platform_emulators_single_default_update
    BEFORE UPDATE OF is_default ON platform_emulators
    WHEN NEW.is_default = 1
    BEGIN
      UPDATE platform_emulators SET is_default = 0
      WHERE platform_id = NEW.platform_id AND emulator_id != NEW.emulator_id;
    END;
CREATE INDEX idx_games_favorite ON games(favorite);
CREATE INDEX idx_games_play_status ON games(play_status);
CREATE INDEX idx_games_rom_path ON games(rom_path);
CREATE INDEX idx_games_launch_count ON games(launch_count DESC);
CREATE INDEX idx_games_library_group_title ON games(platform_id, library_group_key, title COLLATE NOCASE)
      WHERE library_group_key IS NOT NULL AND library_group_key != '';
CREATE INDEX idx_games_recent ON games(created_at DESC, id DESC);
CREATE INDEX idx_hardware_items_platform  ON hardware_items(platform_id);
CREATE INDEX idx_hardware_items_type      ON hardware_items(item_type_id);
CREATE INDEX idx_hardware_items_state     ON hardware_items(conservation_state_id);
CREATE INDEX idx_hardware_item_photos_item ON hardware_item_photos(item_id, sort_order);
CREATE INDEX idx_hardware_items_multi ON hardware_items(is_multiplatform);
CREATE UNIQUE INDEX idx_games_platform_launchbox_unique
    ON games(platform_id, launchbox_id)
    WHERE launchbox_id IS NOT NULL AND TRIM(launchbox_id) != '';
DELETE FROM "sqlite_sequence";
INSERT INTO "sqlite_sequence" VALUES('platforms',90273);
INSERT INTO "sqlite_sequence" VALUES('games',90003);
INSERT INTO "sqlite_sequence" VALUES('platform_launchbox_aliases',928);
INSERT INTO "sqlite_sequence" VALUES('platform_rom_extensions',1256);
INSERT INTO "sqlite_sequence" VALUES('emulators',17);
INSERT INTO "sqlite_sequence" VALUES('item_types',64);
INSERT INTO "sqlite_sequence" VALUES('conservation_states',40);
INSERT INTO "sqlite_sequence" VALUES('hardware_items',2);
INSERT INTO "sqlite_sequence" VALUES('hardware_item_photos',1);
COMMIT;
