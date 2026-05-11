/**
 * DAO de portabilidade de dados.
 *
 * Centraliza todas as queries SQLite envolvidas em exportação e importação de dados
 * do GameStock. Suporta as categorias: metadados de jogos, referências de mídia,
 * plataformas, emuladores e caminhos de ROM.
 *
 * As operações de importação são projetadas para rodar dentro de transações
 * controladas pela camada de repositório/orquestração.
 */

import type Database from "better-sqlite3";
import { DataPortabilityConflictCounts, DataPortabilityRomFolderEntry, PlayStatus } from "../../../shared/types";

/** Campo de mídia de um jogo que pode ser exportado/importado. */
export type PortableMediaField = "box_art_path" | "background_path" | "screenshot_path";

/**
 * Metadados portáveis de um jogo.
 * Referencia a plataforma pelo nome (não por ID SQLite) para portabilidade entre instâncias.
 */
export interface PortableGameMetadata {
  title: string;
  platformName: string;       // Nome da plataforma — chave estável entre instâncias
  platformCategory: string;
  publisher: string | null;
  year: number | null;
  genre: string | null;
  rating: string | null;
  favorite: boolean;
  play_status: PlayStatus;
  notes: string | null;
  launchbox_id: string | null; // ID do LaunchBox — chave primária de matching preferencial
}

/**
 * Referência a um arquivo de mídia associado a um jogo.
 * Contém apenas informações para localizar o arquivo na máquina de origem.
 */
export interface PortableMediaReference {
  title: string;
  platformName: string;
  launchbox_id: string | null;
  field: PortableMediaField;  // Qual campo de mídia (box art, background ou screenshot)
  sourcePath: string;          // Caminho absoluto na máquina de origem
}

/**
 * Entrada de mídia pronta para empacotamento no arquivo de backup.
 * Estende `PortableMediaReference` com metadados do pacote zip.
 */
export interface PortableMediaEntry extends PortableMediaReference {
  packagePath: string;      // Caminho dentro do arquivo zip
  relativePath?: string;    // Caminho relativo opcional
  originalPath: string;     // Caminho absoluto original na máquina de origem
  size: number;             // Tamanho do arquivo em bytes
}

/** Plataforma portável — identificada pelo nome, sem ID SQLite. */
export interface PortablePlatform {
  name: string;
  category: string;
  is_default: number; // 1 = plataforma padrão do sistema, 0 = criada pelo usuário
}

/** Alias do LaunchBox associado a uma plataforma, referenciado pelo nome. */
export interface PortablePlatformAlias {
  platformName: string;
  alias: string;
}

/** Extensão de ROM associada a uma plataforma, referenciada pelo nome. */
export interface PortableRomExtension {
  platformName: string;
  extension: string;  // Ex.: ".nes", ".sfc"
  kind: string;       // Tipo de arquivo (ex.: "ROM", "BIOS")
  is_primary: number; // 1 = extensão principal, 0 = extensão secundária
}

/** Emulador portável — identificado pelo nome. */
export interface PortableEmulator {
  name: string;
  executable: string; // Caminho do executável
  args: string;       // Argumentos de linha de comando
  is_retroarch: number; // 1 = é instância do RetroArch
}

/**
 * Vínculo emulador ↔ plataforma portável.
 * Usa nomes para garantir matching independente de IDs SQLite.
 */
export interface PortablePlatformEmulator {
  platformName: string;
  emulatorName: string;
  is_default: number;       // 1 = emulador padrão para a plataforma
  core_path: string | null; // Caminho do core RetroArch (somente para RetroArch)
}

/** Localização de ROM de um jogo, referenciada pelo nome da plataforma. */
export interface PortableRomLocation {
  title: string;
  platformName: string;
  launchbox_id: string | null;
  rom_path: string; // Caminho absoluto da ROM na máquina de origem
}

/**
 * Pacote completo de plataformas para exportação/importação.
 * Agrupa plataformas, aliases, extensões de ROM, emuladores e vínculos.
 */
export interface PortablePlatformBundle {
  platforms: PortablePlatform[];
  aliases: PortablePlatformAlias[];
  romExtensions: PortableRomExtension[];
  emulators: PortableEmulator[];
  platformEmulators: PortablePlatformEmulator[];
}

/** Resumo de importação de plataformas com contadores por categoria. */
export interface PortablePlatformImportSummary {
  created: number;   // Plataformas criadas
  updated: number;   // Plataformas atualizadas
  mappings: number;  // Aliases e extensões importados
  emulators: number; // Emuladores importados
  links: number;     // Vínculos plataforma ↔ emulador importados
}

/** Resumo de importação de metadados de jogos. */
export interface PortableGameImportSummary {
  created: number;  // Jogos criados
  updated: number;  // Jogos atualizados
  skipped: number;  // Registros ignorados (dados inválidos)
}

/** Resumo de importação de localizações de ROM. */
export interface PortableRomLocationImportSummary {
  updated: number;         // Jogos com rom_path atualizado
  skipped: number;         // Registros ignorados
  romFolderEntries: number; // Entradas de pasta de ROM importadas
}

export class DataPortabilityDao {
  constructor(private readonly database: Database.Database) {}

  /**
   * Lista metadados de todos os jogos para exportação.
   * Converte o campo `favorite` de inteiro SQLite para booleano TypeScript.
   */
  listGameMetadata(): PortableGameMetadata[] {
    const rows = this.database
      .prepare(`
        SELECT
          games.title,
          platforms.name as platformName,
          platforms.category as platformCategory,
          games.publisher,
          games.year,
          games.genre,
          games.rating,
          games.favorite,
          games.play_status,
          games.notes,
          games.launchbox_id
        FROM games
        JOIN platforms ON platforms.id = games.platform_id
        ORDER BY platforms.name COLLATE NOCASE, games.title COLLATE NOCASE
      `)
      .all() as Array<Omit<PortableGameMetadata, "favorite" | "play_status"> & { favorite: number; play_status: string }>;

    // Converte os campos do SQLite para os tipos TypeScript equivalentes
    return rows.map((row) => ({
      ...row,
      favorite: row.favorite === 1,
      play_status: normalizePlayStatus(row.play_status)
    }));
  }

  /**
   * Lista todas as referências de mídia (box art, background, screenshot) para exportação.
   * Apenas jogos com ao menos um campo de mídia preenchido são incluídos.
   * Expande cada linha em até 3 entradas — uma por campo de mídia presente.
   */
  listMediaReferences(): PortableMediaReference[] {
    const rows = this.database
      .prepare(`
        SELECT
          games.title,
          platforms.name as platformName,
          games.launchbox_id,
          games.box_art_path,
          games.background_path,
          games.screenshot_path
        FROM games
        JOIN platforms ON platforms.id = games.platform_id
        WHERE (games.box_art_path IS NOT NULL AND games.box_art_path != '')
           OR (games.background_path IS NOT NULL AND games.background_path != '')
           OR (games.screenshot_path IS NOT NULL AND games.screenshot_path != '')
        ORDER BY platforms.name COLLATE NOCASE, games.title COLLATE NOCASE
      `)
      .all() as Array<{
        title: string;
        platformName: string;
        launchbox_id: string | null;
        box_art_path: string | null;
        background_path: string | null;
        screenshot_path: string | null;
      }>;

    // Expande cada jogo em múltiplas entradas, uma por campo de mídia preenchido
    const refs: PortableMediaReference[] = [];
    for (const row of rows) {
      for (const field of ["box_art_path", "background_path", "screenshot_path"] as const) {
        const sourcePath = row[field]?.trim();
        if (!sourcePath) continue;
        refs.push({
          title: row.title,
          platformName: row.platformName,
          launchbox_id: row.launchbox_id,
          field,
          sourcePath
        });
      }
    }
    return refs;
  }

  /** Lista todas as plataformas para exportação, ordenadas pelo nome. */
  listPlatforms(): PortablePlatform[] {
    return this.database
      .prepare("SELECT name, category, is_default FROM platforms ORDER BY name COLLATE NOCASE")
      .all() as PortablePlatform[];
  }

  /** Lista todos os aliases do LaunchBox, com o nome da plataforma associada. */
  listPlatformAliases(): PortablePlatformAlias[] {
    return this.database
      .prepare(`
        SELECT platforms.name as platformName, platform_launchbox_aliases.alias
        FROM platform_launchbox_aliases
        JOIN platforms ON platforms.id = platform_launchbox_aliases.platform_id
        ORDER BY platforms.name COLLATE NOCASE, platform_launchbox_aliases.alias COLLATE NOCASE
      `)
      .all() as PortablePlatformAlias[];
  }

  /** Lista todas as extensões de ROM registradas, com o nome da plataforma associada. */
  listRomExtensions(): PortableRomExtension[] {
    return this.database
      .prepare(`
        SELECT
          platforms.name as platformName,
          platform_rom_extensions.extension,
          platform_rom_extensions.kind,
          platform_rom_extensions.is_primary
        FROM platform_rom_extensions
        JOIN platforms ON platforms.id = platform_rom_extensions.platform_id
        ORDER BY platforms.name COLLATE NOCASE, platform_rom_extensions.extension COLLATE NOCASE
      `)
      .all() as PortableRomExtension[];
  }

  /** Lista todos os emuladores cadastrados para exportação. */
  listEmulators(): PortableEmulator[] {
    return this.database
      .prepare("SELECT name, executable, args, is_retroarch FROM emulators ORDER BY name COLLATE NOCASE")
      .all() as PortableEmulator[];
  }

  /** Lista todos os vínculos plataforma ↔ emulador para exportação. */
  listPlatformEmulators(): PortablePlatformEmulator[] {
    return this.database
      .prepare(`
        SELECT
          platforms.name as platformName,
          emulators.name as emulatorName,
          platform_emulators.is_default,
          platform_emulators.core_path
        FROM platform_emulators
        JOIN platforms ON platforms.id = platform_emulators.platform_id
        JOIN emulators ON emulators.id = platform_emulators.emulator_id
        ORDER BY platforms.name COLLATE NOCASE, emulators.name COLLATE NOCASE
      `)
      .all() as PortablePlatformEmulator[];
  }

  /**
   * Lista os caminhos de ROM de todos os jogos que possuem `rom_path` preenchido.
   * Usado na exportação da categoria `romLocations`.
   */
  listRomLocations(): PortableRomLocation[] {
    return this.database
      .prepare(`
        SELECT
          games.title,
          platforms.name as platformName,
          games.launchbox_id,
          games.rom_path
        FROM games
        JOIN platforms ON platforms.id = games.platform_id
        WHERE games.rom_path IS NOT NULL AND games.rom_path != ''
        ORDER BY platforms.name COLLATE NOCASE, games.title COLLATE NOCASE
      `)
      .all() as PortableRomLocation[];
  }

  /**
   * Conta quantos registros de jogos resultariam em criação ou atualização
   * caso o backup fosse importado. Usado para exibir prévia de conflitos na UI.
   */
  countGameConflicts(records: PortableGameMetadata[]): DataPortabilityConflictCounts {
    const result: DataPortabilityConflictCounts = { create: 0, update: 0 };
    for (const record of records) {
      // Registros sem título ou plataforma são inválidos — contam como criação (serão ignorados)
      if (!record.title?.trim() || !record.platformName?.trim()) {
        result.create += 1;
        continue;
      }
      const platformId = this.getPlatformIdByName(record.platformName);
      if (!platformId) {
        // Plataforma não existe no banco local → jogo seria criado
        result.create += 1;
        continue;
      }
      // Verifica se já existe um jogo com identidade equivalente
      if (this.findGameIdByIdentity(record, platformId)) result.update += 1;
      else result.create += 1;
    }
    return result;
  }

  /**
   * Conta quantas plataformas resultariam em criação ou atualização
   * caso o backup fosse importado.
   */
  countPlatformConflicts(records: PortablePlatform[]): DataPortabilityConflictCounts {
    const result: DataPortabilityConflictCounts = { create: 0, update: 0 };
    for (const record of records) {
      if (!record.name?.trim()) continue;
      if (this.getPlatformIdByName(record.name)) result.update += 1;
      else result.create += 1;
    }
    return result;
  }

  /**
   * Conta quantos emuladores resultariam em criação ou atualização
   * caso o backup fosse importado.
   */
  countEmulatorConflicts(records: PortableEmulator[]): DataPortabilityConflictCounts {
    const result: DataPortabilityConflictCounts = { create: 0, update: 0 };
    for (const record of records) {
      if (!record.name?.trim()) continue;
      if (this.getEmulatorIdByName(record.name)) result.update += 1;
      else result.create += 1;
    }
    return result;
  }

  /**
   * Importa o pacote completo de plataformas: plataformas, aliases, extensões de ROM,
   * emuladores e vínculos plataforma ↔ emulador.
   *
   * Para cada plataforma com aliases ou extensões, apaga os registros existentes antes
   * de reinserir, garantindo que o estado importado seja autoritativo.
   *
   * Retorna um resumo com contadores de cada categoria processada.
   */
  importPlatforms(bundle: PortablePlatformBundle): PortablePlatformImportSummary {
    const summary: PortablePlatformImportSummary = { created: 0, updated: 0, mappings: 0, emulators: 0, links: 0 };
    // Rastreia quais plataformas serão afetadas para limpar aliases/extensões antes de reinserir
    const platformNames = new Set<string>();

    // Garante que cada plataforma existe e contabiliza criações/atualizações
    for (const platform of bundle.platforms) {
      if (!platform.name?.trim()) continue;
      const result = this.ensurePlatform(platform.name, platform.category);
      if (result.created) summary.created += 1;
      else if (result.updated) summary.updated += 1;
      platformNames.add(normalizeName(platform.name));
    }

    // Garante que plataformas referenciadas por aliases e extensões também existam
    for (const item of [...bundle.aliases, ...bundle.romExtensions]) {
      if (!item.platformName?.trim()) continue;
      platformNames.add(normalizeName(item.platformName));
      this.ensurePlatform(item.platformName, "Importadas");
    }

    // Limpa aliases e extensões das plataformas afetadas antes de reinserir
    for (const platformName of platformNames) {
      const platformId = this.getPlatformIdByNormalizedName(platformName);
      if (!platformId) continue;
      this.database.prepare("DELETE FROM platform_launchbox_aliases WHERE platform_id = ?").run(platformId);
      this.database.prepare("DELETE FROM platform_rom_extensions WHERE platform_id = ?").run(platformId);
    }

    // Reinsere os aliases do LaunchBox
    const insertAlias = this.database.prepare("INSERT OR IGNORE INTO platform_launchbox_aliases (platform_id, alias) VALUES (?, ?)");
    for (const alias of bundle.aliases) {
      const platformId = this.getPlatformIdByName(alias.platformName);
      const value = alias.alias?.trim();
      if (!platformId || !value) continue;
      insertAlias.run(platformId, value);
      summary.mappings += 1;
    }

    // Reinsere as extensões de ROM
    const insertExtension = this.database.prepare(`
      INSERT OR IGNORE INTO platform_rom_extensions (platform_id, extension, kind, is_primary)
      VALUES (?, ?, ?, ?)
    `);
    for (const extension of bundle.romExtensions) {
      const platformId = this.getPlatformIdByName(extension.platformName);
      const value = normalizeExtension(extension.extension);
      if (!platformId || !value) continue;
      insertExtension.run(platformId, value, extension.kind?.trim() ?? "", extension.is_primary ? 1 : 0);
      summary.mappings += 1;
    }

    // Importa emuladores via upsert por nome
    for (const emulator of bundle.emulators) {
      if (!emulator.name?.trim()) continue;
      this.upsertEmulator(emulator);
      summary.emulators += 1;
    }

    // Importa vínculos plataforma ↔ emulador via upsert
    const link = this.database.prepare(`
      INSERT INTO platform_emulators (platform_id, emulator_id, is_default, core_path)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(platform_id, emulator_id) DO UPDATE SET
        is_default = excluded.is_default,
        core_path = excluded.core_path
    `);
    for (const platformEmulator of bundle.platformEmulators) {
      const platformId = this.getPlatformIdByName(platformEmulator.platformName);
      const emulatorId = this.getEmulatorIdByName(platformEmulator.emulatorName);
      if (!platformId || !emulatorId) continue;
      link.run(platformId, emulatorId, platformEmulator.is_default ? 1 : 0, platformEmulator.core_path ?? null);
      summary.links += 1;
    }

    return summary;
  }

  /**
   * Importa metadados de jogos a partir de um array de registros portáveis.
   *
   * Matching de identidade: prefere `launchbox_id + platform_id`; fallback por
   * título (case-insensitive) + platform_id. Registros sem título ou plataforma
   * são ignorados.
   *
   * Retorna contadores de criações, atualizações e registros ignorados.
   */
  importGameMetadata(records: PortableGameMetadata[]): PortableGameImportSummary {
    const summary: PortableGameImportSummary = { created: 0, updated: 0, skipped: 0 };
    const insert = this.database.prepare(`
      INSERT INTO games (
        title, platform_id, publisher, year, genre, rating,
        favorite, play_status, notes, launchbox_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const update = this.database.prepare(`
      UPDATE games SET
        title = ?,
        platform_id = ?,
        publisher = ?,
        year = ?,
        genre = ?,
        rating = ?,
        favorite = ?,
        play_status = ?,
        notes = ?,
        launchbox_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    for (const record of records) {
      const title = record.title?.trim();
      const platformName = record.platformName?.trim();
      // Registros sem título ou plataforma são inválidos e ignorados
      if (!title || !platformName) {
        summary.skipped += 1;
        continue;
      }
      // Garante que a plataforma exista; cria com categoria "Importadas" se necessário
      const platform = this.ensurePlatform(platformName, record.platformCategory || "Importadas");
      const values = [
        title,
        platform.id,
        nullableText(record.publisher),
        nullableNumber(record.year),
        nullableText(record.genre),
        nullableText(record.rating),
        record.favorite ? 1 : 0,
        normalizePlayStatus(record.play_status),
        nullableText(record.notes),
        nullableText(record.launchbox_id)
      ];
      // Verifica se o jogo já existe pelo launchbox_id ou pelo título
      const existingId = this.findGameIdByIdentity(record, platform.id);
      if (existingId) {
        update.run(...values, existingId);
        summary.updated += 1;
      } else {
        insert.run(...values);
        summary.created += 1;
      }
    }

    return summary;
  }

  /**
   * Atualiza o `rom_path` dos jogos a partir de registros portáveis de localização de ROM.
   *
   * Matching idêntico ao de metadados: `launchbox_id` preferido, fallback por título.
   * Registros sem jogo correspondente ou sem caminho são ignorados.
   */
  importRomLocations(records: PortableRomLocation[]): PortableRomLocationImportSummary {
    const summary: PortableRomLocationImportSummary = { updated: 0, skipped: 0, romFolderEntries: 0 };
    const update = this.database.prepare("UPDATE games SET rom_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    for (const record of records) {
      const platformId = this.getPlatformIdByName(record.platformName);
      const gameId = platformId ? this.findGameIdByIdentity(record, platformId) : null;
      if (!gameId || !record.rom_path?.trim()) {
        summary.skipped += 1;
        continue;
      }
      update.run(record.rom_path, gameId);
      summary.updated += 1;
    }
    return summary;
  }

  /**
   * Encontra o ID SQLite de um jogo a partir de título e plataforma portáveis.
   * Retorna `null` se o jogo não for encontrado no banco local.
   */
  findGameId(entry: { title: string; platformName: string; launchbox_id: string | null }): number | null {
    const platformId = this.getPlatformIdByName(entry.platformName);
    return platformId ? this.findGameIdByIdentity(entry, platformId) : null;
  }

  /**
   * Atualiza o caminho de um campo de mídia específico de um jogo.
   * Usado após a extração e reescrita dos arquivos de imagem do backup.
   */
  updateGameMedia(gameId: number, field: PortableMediaField, filePath: string): void {
    this.database.prepare(`UPDATE games SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(filePath, gameId);
  }

  /**
   * Conta entradas de pasta de ROM válidas (com `folderPath` preenchido).
   * Usado para compor o resumo de importação.
   */
  countRomFolderEntries(entries: DataPortabilityRomFolderEntry[]): number {
    return entries.filter((entry) => entry.folderPath?.trim()).length;
  }

  /**
   * Garante que uma plataforma com o nome fornecido exista no banco.
   * Se não existir, cria com a categoria informada.
   * Se existir e a categoria divergir, atualiza a categoria.
   *
   * Usa comparação case-insensitive para o nome.
   * Retorna o ID da plataforma e flags indicando se foi criada ou atualizada.
   */
  private ensurePlatform(name: string, category: string): { id: number; created: boolean; updated: boolean } {
    const existing = this.database.prepare("SELECT id, category FROM platforms WHERE LOWER(name) = LOWER(?)").get(name.trim()) as
      | { id: number; category: string }
      | undefined;
    const normalizedCategory = category?.trim() || "Importadas";
    if (existing) {
      // Atualiza a categoria se divergir da registrada
      const updated = existing.category !== normalizedCategory;
      if (updated) {
        this.database.prepare("UPDATE platforms SET category = ? WHERE id = ?").run(normalizedCategory, existing.id);
      }
      return { id: existing.id, created: false, updated };
    }

    // Plataforma não existe — cria uma nova
    const result = this.database
      .prepare("INSERT INTO platforms (name, category) VALUES (?, ?)")
      .run(name.trim(), normalizedCategory);
    return { id: Number(result.lastInsertRowid), created: true, updated: false };
  }

  /**
   * Cria ou atualiza um emulador pelo nome.
   * Usado durante a importação de plataformas.
   */
  private upsertEmulator(emulator: PortableEmulator): void {
    const existingId = this.getEmulatorIdByName(emulator.name);
    if (existingId) {
      // Emulador já existe — atualiza campos editáveis
      this.database
        .prepare("UPDATE emulators SET executable = ?, args = ?, is_retroarch = ? WHERE id = ?")
        .run(emulator.executable?.trim() ?? "", emulator.args?.trim() ?? "", emulator.is_retroarch ? 1 : 0, existingId);
      return;
    }

    // Emulador não existe — insere novo registro
    this.database
      .prepare("INSERT INTO emulators (name, executable, args, is_retroarch) VALUES (?, ?, ?, ?)")
      .run(emulator.name.trim(), emulator.executable?.trim() ?? "", emulator.args?.trim() ?? "", emulator.is_retroarch ? 1 : 0);
  }

  /**
   * Busca o ID SQLite de uma plataforma pelo nome (case-insensitive).
   * Delega para `getPlatformIdByNormalizedName` após normalizar o nome.
   */
  private getPlatformIdByName(name: string): number | null {
    return this.getPlatformIdByNormalizedName(normalizeName(name));
  }

  /**
   * Busca o ID SQLite de uma plataforma pelo nome já normalizado.
   *
   * Tenta primeiro via LOWER() no SQLite. Se não encontrar,
   * realiza comparação normalizada em memória para lidar com diferenças de acentuação.
   */
  private getPlatformIdByNormalizedName(normalizedName: string): number | null {
    const row = this.database
      .prepare("SELECT id FROM platforms WHERE LOWER(name) = LOWER(?)")
      .get(normalizedName) as { id: number } | undefined;
    if (row) return row.id;

    // Fallback: compara nomes normalizados (sem acentos) em memória
    const rows = this.database.prepare("SELECT id, name FROM platforms").all() as Array<{ id: number; name: string }>;
    return rows.find((item) => normalizeName(item.name) === normalizedName)?.id ?? null;
  }

  /** Busca o ID SQLite de um emulador pelo nome (case-insensitive). */
  private getEmulatorIdByName(name: string): number | null {
    const row = this.database
      .prepare("SELECT id FROM emulators WHERE LOWER(name) = LOWER(?)")
      .get(name.trim()) as { id: number } | undefined;
    return row?.id ?? null;
  }

  /**
   * Localiza um jogo existente no banco pelo `launchbox_id` (preferencial) ou
   * pelo título (case-insensitive) dentro de uma plataforma específica.
   *
   * Retorna o ID SQLite do jogo ou `null` se não encontrado.
   */
  private findGameIdByIdentity(entry: { title: string; platformName?: string; launchbox_id: string | null }, platformId: number): number | null {
    // Tentativa 1: matching por launchbox_id + platform_id (mais confiável)
    const launchboxId = entry.launchbox_id?.trim();
    if (launchboxId) {
      const row = this.database
        .prepare("SELECT id FROM games WHERE launchbox_id = ? AND platform_id = ? ORDER BY id LIMIT 1")
        .get(launchboxId, platformId) as { id: number } | undefined;
      if (row) return row.id;
    }

    // Tentativa 2: fallback por título case-insensitive + platform_id
    const row = this.database
      .prepare("SELECT id FROM games WHERE LOWER(title) = LOWER(?) AND platform_id = ? ORDER BY id LIMIT 1")
      .get(entry.title.trim(), platformId) as { id: number } | undefined;
    return row?.id ?? null;
  }
}

/**
 * Normaliza um valor de `play_status` vindo do backup para os valores aceitos pelo sistema.
 * Valores desconhecidos são convertidos para "unplayed".
 */
function normalizePlayStatus(value: string): PlayStatus {
  if (value === "playing" || value === "completed") return value;
  return "unplayed";
}

/**
 * Normaliza um nome de plataforma para comparação resistente a maiúsculas/minúsculas
 * e diferenças de acentuação (NFD + remoção de diacríticos).
 */
function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Remove diacríticos (acentos)
    .replace(/\s+/g, " ");            // Normaliza espaços múltiplos
}

/**
 * Normaliza uma extensão de arquivo de ROM:
 * - Remove espaços e converte para minúsculas
 * - Garante que comece com ponto (ex.: "nes" → ".nes")
 */
function normalizeExtension(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

/**
 * Converte um valor de texto para `null` se estiver vazio após trim.
 * Garante que strings em branco não sejam persistidas como texto vazio.
 */
function nullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Converte um valor numérico para `null` se não for um número finito.
 * Protege contra NaN e Infinity vindos de dados malformados.
 */
function nullableNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
