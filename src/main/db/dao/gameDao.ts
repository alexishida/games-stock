/**
 * DAO de jogos.
 *
 * Gerencia todas as operações de leitura e escrita sobre a tabela `games` no SQLite.
 * Responsável por listagem paginada com filtros, CRUD, estatísticas de coleção,
 * sincronização de capas e operações em lote relacionadas a pastas de ROM.
 */

import type Database from "better-sqlite3";
import path from "node:path";
import { CollectionCounts, CollectionFilter, CoverSyncStats, Game, GameCreateInput, GameFilters, GameListResult, GameSortBy, GameUpdateInput } from "../../../shared/types";

/** Linha bruta do SQLite: `favorite` chega como 0|1 em vez de boolean. */
type GameRow = Omit<Game, "favorite"> & { favorite: 0 | 1 };

/**
 * Colunas da tabela `games` que podem ser escritas via INSERT ou UPDATE.
 * Mantida como constante para garantir consistência entre os statements.
 */
const writeColumns = [
  "title",
  "platform_id",
  "publisher",
  "year",
  "genre",
  "rating",
  "box_art_path",
  "background_path",
  "screenshot_path",
  "rom_path",
  "favorite",
  "play_status",
  "notes",
  "launchbox_id"
] as const;

export class GameDao {
  constructor(private readonly database: Database.Database) {}

  /**
   * Lista jogos com paginação, filtros e ordenação.
   *
   * Retorna o total geral de jogos no banco (`total`), o total após aplicar
   * os filtros (`filtered`) e a página corrente de itens (`items`).
   */
  list(filters: GameFilters = {}): GameListResult {
    const where = buildWhere(filters);
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = filters.pageSize ?? 50;
    const offset = (page - 1) * pageSize;

    // Contagem de jogos que passam pelos filtros ativos
    const filtered = (
      this.database
        .prepare(`SELECT COUNT(*) as count FROM games JOIN platforms ON platforms.id = games.platform_id ${where.sql}`)
        .get(...where.params) as { count: number }
    ).count;

    // Busca a página atual com filtros, ordenação e paginação
    const items = this.database
      .prepare(`${baseSelect()} ${where.sql} ${buildOrder(filters.sortBy)} LIMIT ? OFFSET ?`)
      .all(...where.params, pageSize, offset)
      .map((row) => mapGame(row as GameRow));

    // Contagem total sem filtros (usada para exibir estatísticas globais)
    const total = (this.database.prepare("SELECT COUNT(*) as count FROM games").get() as { count: number }).count;

    return { items, total, filtered };
  }

  /**
   * Busca um jogo pelo ID SQLite.
   * Retorna `null` se o registro não existir.
   */
  get(id: number): Game | null {
    const row = this.database.prepare(`${baseSelect()} WHERE games.id = ?`).get(id) as GameRow | undefined;
    return row ? mapGame(row) : null;
  }

  /**
   * Cria um novo jogo no banco de dados.
   * Aplica valores padrão para campos opcionais não fornecidos.
   *
   * @throws {Error} Se título ou plataforma não forem informados.
   */
  create(data: Partial<GameCreateInput>): Game {
    if (!data.title?.trim()) throw new Error("Título é obrigatório");
    if (!data.platform_id) throw new Error("Plataforma é obrigatória");

    // Mescla os dados fornecidos com os valores padrão de cada campo
    const values = normalizeInput({
      publisher: null,
      year: null,
      genre: null,
      rating: null,
      box_art_path: null,
      background_path: null,
      screenshot_path: null,
      rom_path: null,
      favorite: false,
      play_status: "unplayed",
      notes: null,
      launchbox_id: null,
      ...data
    });
    const result = this.database
      .prepare(`
        INSERT INTO games (${writeColumns.join(", ")})
        VALUES (${writeColumns.map(() => "?").join(", ")})
      `)
      .run(...writeColumns.map((column) => values[column]));

    return this.get(Number(result.lastInsertRowid))!;
  }

  /**
   * Atualiza campos de um jogo existente.
   * Apenas os campos presentes em `data` são modificados.
   *
   * @throws {Error} Se o jogo não for encontrado após a atualização.
   */
  update(id: number, data: GameUpdateInput): Game {
    // Filtra apenas os campos presentes no objeto de entrada (exclui `undefined`)
    const entries = Object.entries(normalizeInput(data)).filter(([, value]) => value !== undefined);
    if (!entries.length) return this.get(id)!; // Sem campos para atualizar

    const assignments = entries.map(([column]) => `${column} = ?`).join(", ");
    this.database
      .prepare(`UPDATE games SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(...entries.map(([, value]) => value), id);
    const updated = this.get(id);
    if (!updated) throw new Error("Jogo não encontrado");
    return updated;
  }

  /**
   * Retorna contadores agregados da coleção: favoritos, jogando e concluídos.
   * Usado para exibir estatísticas no painel lateral da UI.
   */
  collectionCounts(): CollectionCounts {
    const row = this.database.prepare(`
      SELECT
        SUM(CASE WHEN favorite = 1 THEN 1 ELSE 0 END) as favorites,
        SUM(CASE WHEN play_status = 'playing' THEN 1 ELSE 0 END) as playing,
        SUM(CASE WHEN play_status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM games
    `).get() as { favorites: number; playing: number; completed: number };
    return { favorites: row.favorites ?? 0, playing: row.playing ?? 0, completed: row.completed ?? 0 };
  }

  /**
   * Retorna estatísticas de sincronização de capas (box art):
   * - total: jogos cadastrados
   * - downloaded: jogos com box art salva
   * - missing: jogos sem box art
   * - syncable: jogos sem box art mas com launchbox_id (podem ser sincronizados)
   * - metadataSyncable: jogos com launchbox_id (podem ter metadados atualizados)
   */
  coverStats(): CoverSyncStats {
    const row = this.database.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN box_art_path IS NOT NULL AND box_art_path != '' THEN 1 ELSE 0 END) as downloaded,
        SUM(CASE WHEN (box_art_path IS NULL OR box_art_path = '') AND launchbox_id IS NOT NULL AND launchbox_id != '' THEN 1 ELSE 0 END) as syncable,
        SUM(CASE WHEN launchbox_id IS NOT NULL AND launchbox_id != '' THEN 1 ELSE 0 END) as metadataSyncable
      FROM games
    `).get() as { total: number; downloaded: number | null; syncable: number | null; metadataSyncable: number | null };
    const downloaded = row.downloaded ?? 0;
    const total = row.total ?? 0;
    return {
      total,
      downloaded,
      missing: Math.max(0, total - downloaded),
      syncable: row.syncable ?? 0,
      metadataSyncable: row.metadataSyncable ?? 0,
      metadataDownloadedAt: null // Preenchido pela camada de repositório quando disponível
    };
  }

  /**
   * Lista jogos sem box art que possuem `launchbox_id` (candidatos à sincronização de capa).
   * Ordenados pelo título para facilitar revisão.
   */
  listMissingCovers(): Game[] {
    return this.database
      .prepare(`
        ${baseSelect()}
        WHERE (games.box_art_path IS NULL OR games.box_art_path = '')
          AND games.launchbox_id IS NOT NULL
          AND games.launchbox_id != ''
        ORDER BY games.title COLLATE NOCASE
      `)
      .all()
      .map((row) => mapGame(row as GameRow));
  }

  /**
   * Lista todos os jogos vinculados ao LaunchBox (possuem `launchbox_id` preenchido).
   * Usado para sincronização em lote de metadados e capas.
   */
  listLaunchBoxLinked(): Game[] {
    return this.database
      .prepare(`
        ${baseSelect()}
        WHERE games.launchbox_id IS NOT NULL
          AND games.launchbox_id != ''
        ORDER BY games.title COLLATE NOCASE
      `)
      .all()
      .map((row) => mapGame(row as GameRow));
  }

  /**
   * Remove um jogo pelo ID.
   * Não lança erro se o ID não existir.
   */
  delete(id: number): { success: true } {
    this.database.prepare("DELETE FROM games WHERE id = ?").run(id);
    return { success: true };
  }

  /**
   * Remove em lote todos os jogos cujo `rom_path` aponta para dentro de uma pasta específica.
   * Opcionalmente restringe a remoção a uma plataforma.
   *
   * O matching de caminho é feito em memória após normalização para evitar
   * diferenças de separador (/ vs \) e case.
   *
   * Retorna o número de jogos removidos.
   */
  deleteByRomFolder(folderPath: string, platformId?: number): { success: true; deleted: number } {
    const normalizedFolder = normalizeFsPath(folderPath);
    // Carrega todos os rom_paths relevantes para filtrar em memória
    const rows = platformId
      ? this.database
        .prepare("SELECT id, rom_path FROM games WHERE platform_id = ? AND rom_path IS NOT NULL")
        .all(platformId) as Array<{ id: number; rom_path: string }>
      : this.database.prepare("SELECT id, rom_path FROM games WHERE rom_path IS NOT NULL").all() as Array<{ id: number; rom_path: string }>;
    const ids = rows
      .filter((row) => isPathInsideFolder(row.rom_path, normalizedFolder))
      .map((row) => row.id);

    if (!ids.length) return { success: true, deleted: 0 };

    // Remove em transação para garantir atomicidade
    const remove = this.database.prepare("DELETE FROM games WHERE id = ?");
    this.database.transaction((gameIds: number[]) => {
      for (const id of gameIds) remove.run(id);
    })(ids);
    return { success: true, deleted: ids.length };
  }

  /**
   * Conta quantos jogos possuem `rom_path` dentro de uma pasta específica.
   * Usado para exibir o número de jogos que seriam removidos antes de confirmar a ação.
   */
  countByRomFolder(folderPath: string, platformId?: number): number {
    const normalizedFolder = normalizeFsPath(folderPath);
    const rows = platformId
      ? this.database
        .prepare("SELECT rom_path FROM games WHERE platform_id = ? AND rom_path IS NOT NULL AND rom_path != ''")
        .all(platformId) as Array<{ rom_path: string }>
      : this.database
        .prepare("SELECT rom_path FROM games WHERE rom_path IS NOT NULL AND rom_path != ''")
        .all() as Array<{ rom_path: string }>;

    return rows.filter((row) => isPathInsideFolder(row.rom_path, normalizedFolder)).length;
  }

  /**
   * Remove jogos sem `rom_path` de uma plataforma específica cujos títulos
   * correspondam à lista fornecida (case-insensitive, normalizado).
   *
   * Usado durante reimportação de pasta de ROM para limpar entradas órfãs
   * que não estão mais presentes no sistema de arquivos.
   */
  deleteWithoutRomPathByPlatformAndTitles(platformId: number, titles: string[]): { success: true; deleted: number } {
    const normalizedTitles = new Set(titles.map(normalizeTitleForMatch).filter(Boolean));
    if (!normalizedTitles.size) return { success: true, deleted: 0 };

    // Busca candidatos: jogos da plataforma sem rom_path
    const rows = this.database
      .prepare("SELECT id, title FROM games WHERE platform_id = ? AND (rom_path IS NULL OR rom_path = '')")
      .all(platformId) as Array<{ id: number; title: string }>;
    const ids = rows
      .filter((row) => normalizedTitles.has(normalizeTitleForMatch(row.title)))
      .map((row) => row.id);

    if (!ids.length) return { success: true, deleted: 0 };

    const remove = this.database.prepare("DELETE FROM games WHERE id = ?");
    this.database.transaction((gameIds: number[]) => {
      for (const id of gameIds) remove.run(id);
    })(ids);
    return { success: true, deleted: ids.length };
  }

  /**
   * Cria ou atualiza um jogo vindo do LaunchBox.
   *
   * Matching por `launchbox_id` → `rom_path` → título (case-insensitive).
   * Se encontrar correspondência, atualiza; caso contrário, cria.
   *
   * Retorna o jogo resultante e um flag indicando se foi criado.
   */
  upsertLaunchBox(data: Partial<GameCreateInput> & { title: string; platform_id: number }): { game: Game; created: boolean } {
    const existing = this.findExisting(data);

    if (existing) return { game: this.update(existing.id, data), created: false };
    return { game: this.create(data), created: true };
  }

  /**
   * Procura um jogo existente para o upsert do LaunchBox.
   * Ordem de preferência: launchbox_id → rom_path → título (case-insensitive).
   */
  private findExisting(data: Partial<GameCreateInput> & { title: string; platform_id: number }): { id: number } | undefined {
    // Tentativa 1: matching pelo launchbox_id (mais preciso)
    if (data.launchbox_id) {
      const byLaunchBoxId = this.database
        .prepare("SELECT id FROM games WHERE launchbox_id = ? AND platform_id = ?")
        .get(data.launchbox_id, data.platform_id) as { id: number } | undefined;
      if (byLaunchBoxId) return byLaunchBoxId;
    }

    // Tentativa 2: matching pelo caminho da ROM
    if (data.rom_path) {
      const byRomPath = this.database
        .prepare("SELECT id FROM games WHERE rom_path = ? AND platform_id = ?")
        .get(data.rom_path, data.platform_id) as { id: number } | undefined;
      if (byRomPath) return byRomPath;
    }

    // Tentativa 3: fallback pelo título case-insensitive
    return this.database
      .prepare("SELECT id FROM games WHERE LOWER(title) = LOWER(?) AND platform_id = ?")
      .get(data.title, data.platform_id) as { id: number } | undefined;
  }
}

/** Converte uma linha do SQLite para o tipo `Game`, convertendo `favorite` de 0|1 para boolean. */
function mapGame(row: GameRow): Game {
  return { ...row, favorite: Boolean(row.favorite) };
}

/**
 * SELECT base usado em múltiplas queries.
 * Inclui o nome da plataforma via JOIN para evitar consultas adicionais.
 */
function baseSelect(): string {
  return `
    SELECT games.*, platforms.name as platform_name
    FROM games
    JOIN platforms ON platforms.id = games.platform_id
  `;
}

/**
 * Constrói a cláusula WHERE e os parâmetros correspondentes a partir dos filtros recebidos.
 * Retorna SQL vazio e array de parâmetros vazio se nenhum filtro estiver ativo.
 */
function buildWhere(filters: GameFilters = {}): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];

  // Filtro por plataforma
  if (filters.platformId) {
    parts.push("games.platform_id = ?");
    params.push(filters.platformId);
  }
  // Filtro por busca textual no título (LIKE case-insensitive)
  if (filters.search?.trim()) {
    parts.push("LOWER(games.title) LIKE ?");
    params.push(`%${filters.search.trim().toLowerCase()}%`);
  }
  // Filtro de coleção (favoritos, jogando, concluídos, não jogados)
  if (filters.collectionFilter) {
    const collection = buildCollectionFilter(filters.collectionFilter);
    if (collection) parts.push(collection);
  }

  return {
    sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "",
    params
  };
}

/**
 * Converte um `CollectionFilter` em fragmento SQL para a cláusula WHERE.
 * Retorna `null` para o filtro "all" (sem restrição).
 */
function buildCollectionFilter(filter: CollectionFilter): string | null {
  switch (filter) {
    case "favorites":
      return "games.favorite = 1";
    case "playing":
      return "games.play_status = 'playing'";
    case "completed":
      return "games.play_status = 'completed'";
    case "unplayed":
      return "games.play_status = 'unplayed'";
    case "all":
      return null;
  }
}

/**
 * Constrói a cláusula ORDER BY conforme o critério de ordenação solicitado.
 * - year: mais recentes primeiro, com nulos no final
 * - recent: por data de criação decrescente
 * - title: alfabético case-insensitive (padrão)
 */
function buildOrder(sortBy: GameSortBy = "title"): string {
  switch (sortBy) {
    case "year":
      return "ORDER BY games.year IS NULL, games.year DESC, games.title COLLATE NOCASE";
    case "recent":
      return "ORDER BY games.created_at DESC, games.id DESC";
    case "title":
      return "ORDER BY games.title COLLATE NOCASE";
  }
}

/**
 * Normaliza os dados de entrada para o formato esperado pelo SQLite.
 * - Converte `favorite` de boolean para 0|1
 * - Garante `null` para campos opcionais não preenchidos
 * - Retorna `undefined` para campos não presentes em `data` (para UPDATE parcial)
 */
function normalizeInput(data: Partial<GameCreateInput>): Record<string, unknown> {
  return {
    title: has(data, "title") ? data.title?.trim() : undefined,
    platform_id: has(data, "platform_id") ? data.platform_id : undefined,
    publisher: has(data, "publisher") ? data.publisher ?? null : undefined,
    year: has(data, "year") ? data.year ?? null : undefined,
    genre: has(data, "genre") ? data.genre ?? null : undefined,
    rating: has(data, "rating") ? data.rating ?? null : undefined,
    box_art_path: has(data, "box_art_path") ? data.box_art_path ?? null : undefined,
    background_path: has(data, "background_path") ? data.background_path ?? null : undefined,
    screenshot_path: has(data, "screenshot_path") ? data.screenshot_path ?? null : undefined,
    rom_path: has(data, "rom_path") ? data.rom_path ?? null : undefined,
    favorite: has(data, "favorite") ? (data.favorite ? 1 : 0) : undefined, // boolean → 0|1
    play_status: has(data, "play_status") ? data.play_status ?? "unplayed" : undefined,
    notes: has(data, "notes") ? data.notes ?? null : undefined,
    launchbox_id: has(data, "launchbox_id") ? data.launchbox_id ?? null : undefined
  };
}

/** Verifica se uma chave existe diretamente no objeto `data` (sem herança). */
function has(data: Partial<GameCreateInput>, key: keyof GameCreateInput): boolean {
  return Object.prototype.hasOwnProperty.call(data, key);
}

/**
 * Verifica se um caminho de arquivo está dentro de uma pasta específica.
 * Ambos os caminhos são normalizados antes da comparação para garantir
 * consistência entre sistemas operacionais.
 */
function isPathInsideFolder(targetPath: string, normalizedFolder: string): boolean {
  const normalizedTarget = normalizeFsPath(targetPath);
  // Corresponde ao próprio caminho da pasta ou a qualquer subpath dentro dela
  return normalizedTarget === normalizedFolder || normalizedTarget.startsWith(`${normalizedFolder}/`);
}

/**
 * Normaliza um caminho do sistema de arquivos para comparação cross-platform:
 * - Resolve para caminho absoluto
 * - Converte separadores para /
 * - Remove barra final
 * - Converte para minúsculas
 */
function normalizeFsPath(value: string): string {
  return path
    .resolve(value)
    .replace(/\\/g, "/")  // Windows: \ → /
    .replace(/\/+$/g, "") // Remove barra final
    .toLowerCase();
}

/**
 * Normaliza um título de jogo para matching case-insensitive.
 * Remove espaços extras e converte para minúsculas.
 */
function normalizeTitleForMatch(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
