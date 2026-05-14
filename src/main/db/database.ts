/**
 * Módulo principal do banco de dados SQLite do GameStock.
 *
 * Responsável por:
 * - Inicializar e retornar a instância singleton do banco de dados.
 * - Aplicar o schema e executar migrations simples na inicialização.
 * - Realizar seeds de plataformas, aliases LaunchBox, extensões de ROM e emuladores padrão.
 * - Deduplicar jogos com o mesmo launchbox_id por plataforma.
 * - Preencher (backfill) caminhos de capa ausentes para jogos já cadastrados.
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { getAppUserDataDir } from "../appPaths";
import { LEGACY_PLATFORM_ALIASES, PLATFORM_CATALOG } from "./platformCatalog";

// Instância singleton do banco de dados — null enquanto não inicializado.
let db: Database.Database | null = null;

/**
 * Retorna o diretório de dados do usuário para o app (onde o banco e imagens ficam).
 */
export function getUserDataDir(): string {
  return getAppUserDataDir();
}

/**
 * Retorna o diretório onde as imagens dos jogos são armazenadas.
 * Fica dentro do diretório de dados do usuário.
 */
export function getImagesDir(): string {
  return path.join(getUserDataDir(), "images");
}

/**
 * Retorna a instância singleton do banco de dados SQLite.
 *
 * Na primeira chamada, cria os diretórios necessários, abre o arquivo SQLite,
 * ativa foreign keys, aplica o schema, executa migrations e seeds.
 * Chamadas subsequentes retornam a mesma instância.
 */
export function getDatabase(): Database.Database {
  if (db) return db;

  const dataDir = getUserDataDir();
  // Garante que os diretórios de dados e imagens existam antes de abrir o banco.
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(getImagesDir(), { recursive: true });

  db = new Database(path.join(dataDir, "gamestock.db"));
  // Ativa integridade referencial (foreign keys) — desabilitada por padrão no SQLite.
  db.pragma("foreign_keys = ON");

  // Garante que o diretório de fotos do inventário existe.
  fs.mkdirSync(getInventarioImagesDir(), { recursive: true });

  // Sequência de inicialização: schema → migrations → deduplicação → seed.
  applySchema(db);
  migratePlatformAliases(db);
  dedupeGamesByLaunchBoxId(db);
  ensureGamesLaunchBoxUniqueIndex(db);
  seedPlatforms(db);
  seedPlatformMappings(db);
  seedEmulators(db);
  seedHardwareInventoryDefaults(db);
  backfillCachedCoverPaths(db);
  return db;
}

/**
 * Cria as tabelas, índices e triggers do banco caso ainda não existam.
 * Também adiciona colunas que possam ter sido introduzidas em versões posteriores
 * (migration incremental via `addColumnIfMissing`).
 */
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

    -- Tabela de aliases LaunchBox por plataforma, usada na importação de metadados.
    CREATE TABLE IF NOT EXISTS platform_launchbox_aliases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform_id INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
      alias TEXT NOT NULL COLLATE NOCASE UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabela de extensões de ROM suportadas por plataforma.
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

    -- Tabela de associação entre plataformas e emuladores (N:M).
    -- Suporta emulador padrão por plataforma e core path (RetroArch).
    CREATE TABLE IF NOT EXISTS platform_emulators (
      platform_id  INTEGER NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
      emulator_id  INTEGER NOT NULL REFERENCES emulators(id) ON DELETE CASCADE,
      is_default   INTEGER NOT NULL DEFAULT 0,
      core_path    TEXT,
      PRIMARY KEY (platform_id, emulator_id)
    );

    -- Tabela de estado persistido da aplicação (chave-valor em JSON).
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Trigger: garante que apenas um emulador seja o padrão por plataforma ao inserir.
    CREATE TRIGGER IF NOT EXISTS trg_platform_emulators_single_default_insert
    BEFORE INSERT ON platform_emulators
    WHEN NEW.is_default = 1
    BEGIN
      UPDATE platform_emulators SET is_default = 0 WHERE platform_id = NEW.platform_id;
    END;

    -- Trigger: garante que apenas um emulador seja o padrão por plataforma ao atualizar.
    CREATE TRIGGER IF NOT EXISTS trg_platform_emulators_single_default_update
    BEFORE UPDATE OF is_default ON platform_emulators
    WHEN NEW.is_default = 1
    BEGIN
      UPDATE platform_emulators SET is_default = 0
      WHERE platform_id = NEW.platform_id AND emulator_id != NEW.emulator_id;
    END;
  `);

  // Migration incremental: adiciona colunas introduzidas após a criação inicial da tabela.
  addColumnIfMissing(database, "games", "favorite", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(database, "games", "play_status", "TEXT NOT NULL DEFAULT 'unplayed'");
  addColumnIfMissing(database, "games", "background_path", "TEXT");
  addColumnIfMissing(database, "games", "screenshot_path", "TEXT");
  addColumnIfMissing(database, "games", "rom_path", "TEXT");
  addColumnIfMissing(database, "games", "launchbox_id", "TEXT");
  addColumnIfMissing(database, "platforms", "is_default", "INTEGER NOT NULL DEFAULT 0");

  // Índices adicionais para campos de filtro comuns na listagem de jogos.
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_games_favorite ON games(favorite);
    CREATE INDEX IF NOT EXISTS idx_games_play_status ON games(play_status);
    CREATE INDEX IF NOT EXISTS idx_games_rom_path ON games(rom_path);
  `);

  // ── Inventário de hardware físico ──────────────────────────────────────────

  database.exec(`
    -- Tipos de item de hardware configuráveis pelo usuário (ex: Console, Controle).
    CREATE TABLE IF NOT EXISTS item_types (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Estados de conservação dos itens de hardware (ex: Novo, Bom, Ruim).
    CREATE TABLE IF NOT EXISTS conservation_states (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL UNIQUE,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- Itens físicos de hardware cadastrados no inventário.
    CREATE TABLE IF NOT EXISTS hardware_items (
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

    CREATE INDEX IF NOT EXISTS idx_hardware_items_platform  ON hardware_items(platform_id);
    CREATE INDEX IF NOT EXISTS idx_hardware_items_type      ON hardware_items(item_type_id);
    CREATE INDEX IF NOT EXISTS idx_hardware_items_state     ON hardware_items(conservation_state_id);

    -- Fotos associadas a um item de hardware, com ordenação configurável.
    CREATE TABLE IF NOT EXISTS hardware_item_photos (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id    INTEGER NOT NULL REFERENCES hardware_items(id) ON DELETE CASCADE,
      file_path  TEXT    NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_hardware_item_photos_item ON hardware_item_photos(item_id, sort_order);
  `);

  // Migration incremental: marcador interno para itens que servem varias plataformas
  // sem criar uma plataforma visivel na biblioteca de jogos.
  addColumnIfMissing(database, "hardware_items", "is_multiplatform", "INTEGER NOT NULL DEFAULT 0");
  database.exec("CREATE INDEX IF NOT EXISTS idx_hardware_items_multi ON hardware_items(is_multiplatform)");
}

/**
 * Cria o índice único composto (platform_id, launchbox_id) na tabela de jogos,
 * garantindo que não existam duplicatas com mesmo launchbox_id por plataforma.
 * O índice é parcial: ignora linhas onde launchbox_id é NULL ou string vazia.
 */
function ensureGamesLaunchBoxUniqueIndex(database: Database.Database): void {
  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_games_platform_launchbox_unique
    ON games(platform_id, launchbox_id)
    WHERE launchbox_id IS NOT NULL AND TRIM(launchbox_id) != '';
  `);
}

/**
 * Remove duplicatas de jogos com o mesmo `launchbox_id` dentro de uma mesma plataforma.
 *
 * Para cada grupo de duplicatas:
 * - O registro mais recente (por `updated_at`, `created_at`, `id`) é mantido como sobrevivente.
 * - Os demais são mesclados nele (campos não nulos do candidato preenchem campos vazios do sobrevivente).
 * - Registros duplicados são deletados ao final.
 *
 * Executa como uma transaction para garantir atomicidade.
 */
function dedupeGamesByLaunchBoxId(database: Database.Database): void {
  // Busca todos os grupos com launchbox_id duplicado dentro de uma plataforma.
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

  // Seleciona todos os registros de um grupo, do mais recente para o mais antigo.
  const selectDuplicates = database.prepare(`
    SELECT *
    FROM games
    WHERE platform_id = ? AND launchbox_id = ?
    ORDER BY updated_at DESC, created_at DESC, id DESC
  `);
  // Atualiza o sobrevivente com os dados mesclados.
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

      // O primeiro registro (mais recente) é o sobrevivente.
      const survivor = duplicates[0];
      // Mescla todos os candidatos sobre o sobrevivente, campo a campo.
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

      // Remove os registros duplicados que foram absorvidos pelo sobrevivente.
      for (const duplicate of duplicates.slice(1)) {
        deleteGame.run(duplicate.id);
      }
    }
  })();
}

/**
 * Representa uma linha da tabela `games` retornada diretamente pelo SQLite.
 * Usado internamente durante a deduplicação por launchbox_id.
 */
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
  favorite: number; // 0 = false, 1 = true (SQLite não tem tipo booleano nativo)
  play_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Mescla dois GameRecords, priorizando o `preferred` e usando `candidate` como fallback
 * para campos nulos ou vazios. O campo `favorite` é OR lógico entre os dois registros.
 * O campo `play_status` mantém o preferred, a não ser que ele seja "unplayed".
 */
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
    // Qualquer um dos registros marcado como favorito mantém o jogo como favorito.
    favorite: preferred.favorite || candidate.favorite ? 1 : 0,
    // Preserva o status mais avançado: se o preferred já é "unplayed", tenta usar o candidate.
    play_status: preferred.play_status !== "unplayed" ? preferred.play_status : candidate.play_status,
    notes: pickPreferredString(preferred.notes, candidate.notes)
  };
}

/**
 * Retorna `primary` se não for nulo/vazio; caso contrário retorna `fallback`.
 * Garante que strings de espaço em branco sejam tratadas como ausentes.
 */
function pickPreferredString(primary: string | null, fallback: string | null): string | null {
  if (primary && primary.trim()) return primary;
  if (fallback && fallback.trim()) return fallback;
  return null;
}

/**
 * Adiciona uma coluna a uma tabela SQLite somente se ela ainda não existir.
 * Usado para migrations incrementais sem recriar a tabela inteira.
 */
function addColumnIfMissing(database: Database.Database, table: string, column: string, definition: string): void {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/**
 * Migration: renomeia plataformas legadas para seus nomes canônicos definidos em
 * `LEGACY_PLATFORM_ALIASES`. Se já existir a plataforma canônica, migra os jogos
 * para ela e apaga a legada. Caso contrário, apenas renomeia a plataforma existente.
 *
 * Executa dentro de uma transaction para garantir consistência.
 */
function migratePlatformAliases(database: Database.Database): void {
  const transaction = database.transaction(() => {
    for (const [oldName, canonicalName] of LEGACY_PLATFORM_ALIASES) {
      const old = database.prepare("SELECT id FROM platforms WHERE name = ?").get(oldName) as { id: number } | undefined;
      if (!old) continue;
      const canonical = database.prepare("SELECT id FROM platforms WHERE name = ?").get(canonicalName) as { id: number } | undefined;
      if (canonical) {
        // Plataforma canônica já existe: migra jogos e apaga a entrada legada.
        database.prepare("UPDATE games SET platform_id = ? WHERE platform_id = ?").run(canonical.id, old.id);
        database.prepare("DELETE FROM platforms WHERE id = ?").run(old.id);
      } else {
        // Plataforma canônica não existe: apenas renomeia e marca como padrão.
        database.prepare("UPDATE platforms SET name = ?, is_default = 1 WHERE id = ?").run(canonicalName, old.id);
      }
    }
  });
  transaction();
}

/**
 * Seed: insere todas as plataformas do catálogo (`PLATFORM_CATALOG`) no banco,
 * ignorando as que já existem. Marca todas as plataformas do catálogo como `is_default = 1`.
 */
function seedPlatforms(database: Database.Database): void {
  const insert = database.prepare("INSERT OR IGNORE INTO platforms (name, category, is_default) VALUES (?, ?, 1)");
  const update = database.prepare("UPDATE platforms SET is_default = 1 WHERE name = ? AND is_default = 0");
  const transaction = database.transaction(() => {
    for (const platform of PLATFORM_CATALOG) {
      insert.run(platform.name, platform.category);
      // Garante que plataformas pré-existentes também sejam marcadas como padrão.
      update.run(platform.name);
    }
  });
  transaction();
}

/**
 * Seed: popula aliases LaunchBox e extensões de ROM para todas as plataformas do catálogo.
 * Usa `INSERT OR IGNORE` para ser idempotente — pode ser executado a cada inicialização.
 */
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

      // O próprio nome da plataforma também é registrado como alias.
      insertAlias.run(row.id, platform.name);
      for (const alias of platform.launchboxAliases) {
        insertAlias.run(row.id, alias);
      }

      // Insere extensões de ROM, normalizando para minúsculas.
      for (const extension of platform.romExtensions) {
        insertExtension.run(row.id, extension.extension.toLowerCase(), extension.kind, extension.isPrimary ? 1 : 0);
      }
    }
  });

  transaction();
}

/**
 * Seed: insere o emulador RetroArch como entrada padrão, se ainda não existir.
 * O campo `executable` fica vazio para o usuário configurar depois.
 */
function seedEmulators(database: Database.Database): void {
  database.prepare("INSERT OR IGNORE INTO emulators (name, executable, is_retroarch) VALUES ('RetroArch', '', 1)").run();
}

/**
 * Backfill: para jogos sem `box_art_path`, tenta localizar a capa no diretório de imagens
 * usando o caminho derivado do nome da plataforma e do título do jogo.
 *
 * Esse processo roda na inicialização para corrigir jogos importados antes da persistência
 * automática de caminho de capa ser implementada.
 */
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
      // Monta o caminho esperado da capa: images/<plataforma>/<titulo>/cover.jpg
      const coverPath = path.join(getImagesDir(), sanitizeMediaPath(item.platform_name), sanitizeMediaPath(item.title), "cover.jpg");
      if (fs.existsSync(coverPath)) update.run(coverPath, item.id);
    }
  });

  repair(rows);
}

/**
 * Normaliza uma string para uso como segmento de caminho de arquivo de mídia.
 * Remove caracteres especiais, converte para minúsculas, substitui espaços por hífens
 * e limita a 120 caracteres para evitar caminhos excessivamente longos.
 */
function sanitizeMediaPath(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

/**
 * Seed: insere os tipos de item e estados de conservação padrão do inventário de hardware.
 * Usa `INSERT OR IGNORE` para ser idempotente — pode ser executado a cada inicialização.
 */
function seedHardwareInventoryDefaults(database: Database.Database): void {
  const insertType = database.prepare("INSERT OR IGNORE INTO item_types (name, is_default) VALUES (?, 1)");
  const insertState = database.prepare("INSERT OR IGNORE INTO conservation_states (name, is_default) VALUES (?, 1)");

  const defaultTypes = [
    "Console",
    "Controle",
    "Cabo de Energia",
    "Cabo de Vídeo",
    "Cartucho/Mídia",
    "Memória/Memory Card",
    "Acessório",
    "Outros"
  ];

  const defaultStates = [
    "Novo",
    "Ótimo",
    "Bom",
    "Ruim",
    "Necessita Reparo"
  ];

  const transaction = database.transaction(() => {
    for (const name of defaultTypes) insertType.run(name);
    for (const name of defaultStates) insertState.run(name);
  });
  transaction();
}

/**
 * Retorna o diretório raiz onde as fotos do inventário de hardware são armazenadas.
 * Estrutura: <userData>/inventario/images/<item_id>/
 */
export function getInventarioImagesDir(): string {
  return path.join(getUserDataDir(), "inventario", "images");
}

/**
 * Fecha a conexão com o banco de dados e reseta a instância singleton para null.
 * Deve ser chamado no encerramento do processo Electron (evento `before-quit`).
 */
export function closeDatabase(): void {
  db?.close();
  db = null;
}
