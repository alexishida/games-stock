/**
 * DAO de jogos.
 *
 * Gerencia todas as operações de leitura e escrita sobre a tabela `games` no SQLite.
 * Responsável por listagem paginada com filtros, CRUD, estatísticas de coleção,
 * sincronização de capas e operações em lote relacionadas a pastas de ROM.
 */

import type Database from "better-sqlite3";
import path from "node:path";
import { CollectionCounts, CollectionFilter, CoverSyncStats, Game, GameCreateInput, GameFilters, GameLaunchStats, GameListResult, GameUpdateInput, GameVersionOption } from "../../../shared/types";
import { buildStoredLibraryGroupKey } from "../libraryGrouping";

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
  "launchbox_id",
  "launch_count"
] as const;

/** Colunas do INSERT, incluindo chave derivada usada exclusivamente pela paginação da biblioteca. */
const insertColumns = [...writeColumns, "library_group_key"] as const;

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

    // O ranking escolhe representante de cada grupo antes do LIMIT/OFFSET.
    // Assim variantes não vazam entre páginas e só a página requisitada atravessa IPC.
    const items = this.database.prepare(`
      WITH ranked_games AS (
        SELECT
          games.*,
          platforms.name AS platform_name,
          ROW_NUMBER() OVER (
            PARTITION BY ${libraryGroupExpression("games")}
            ORDER BY ${buildOrderTerms(filters, "games")}
          ) AS library_rank
        FROM games
        JOIN platforms ON platforms.id = games.platform_id
        ${where.sql}
      )
      SELECT *
      FROM ranked_games
      WHERE library_rank = 1
      ORDER BY ${buildOrderTerms(filters, "ranked_games")}
      LIMIT ? OFFSET ?
    `).all(...where.params, pageSize, offset).map((row) => mapGame(row as GameRow));

    // Contagens usam mesma chave que a paginação, mantendo TopBar e páginas consistentes.
    const filtered = this.countLibraryGroups(where);
    const total = this.countLibraryGroups({ sql: "", params: [] });

    return { items, total, filtered };
  }

  /**
   * Lista categorias/gêneros únicos já presentes na biblioteca.
   * Divide campos compostos ("Ação; Plataforma") em opções separadas para o filtro.
   */
  listGenres(): string[] {
    const rows = this.database
      .prepare("SELECT genre FROM games WHERE genre IS NOT NULL AND TRIM(genre) != ''")
      .all() as Array<{ genre: string }>;

    const genreMap = new Map<string, string>();
    for (const row of rows) {
      for (const genre of splitGenres(row.genre)) {
        const normalizedGenre = normalizeGenre(genre);
        if (!normalizedGenre) continue;
        if (!genreMap.has(normalizedGenre)) genreMap.set(normalizedGenre, genre);
      }
    }

    return Array.from(genreMap.values()).sort((left, right) =>
      left.localeCompare(right, "pt-BR", { sensitivity: "base" })
    );
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
      launch_count: 0,
      ...data
    });
    const result = this.database
      .prepare(`
        INSERT INTO games (${insertColumns.join(", ")})
        VALUES (${insertColumns.map(() => "?").join(", ")})
      `)
      .run(
        ...writeColumns.map((column) => values[column]),
        buildStoredLibraryGroupKey({ title: values.title as string, rom_path: values.rom_path as string | null })
      );

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
    const normalized = normalizeInput(data);
    const entries = Object.entries(normalized).filter(([, value]) => value !== undefined);
    if (!entries.length) return this.get(id)!; // Sem campos para atualizar

    const changesLibraryGrouping = entries.some(([column]) => column === "title" || column === "rom_path");
    if (changesLibraryGrouping) {
      const current = this.get(id);
      if (!current) throw new Error("Jogo não encontrado");
      const nextTitle = typeof normalized.title === "string" ? normalized.title : current.title;
      const nextRomPath = normalized.rom_path === undefined ? current.rom_path : normalized.rom_path as string | null;
      // Chave derivada acompanha toda edição que altera título ou ROM.
      entries.push(["library_group_key", buildStoredLibraryGroupKey({ title: nextTitle, rom_path: nextRomPath })]);
    }

    const assignments = entries.map(([column]) => `${column} = ?`).join(", ");
    this.database
      .prepare(`UPDATE games SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(...entries.map(([, value]) => value), id);
    const updated = this.get(id);
    if (!updated) throw new Error("Jogo não encontrado");
    return updated;
  }

  /**
   * Retorna contadores agregados da coleção: favoritos, jogando, concluídos e já executados.
   * Usado para exibir estatísticas no painel lateral da UI.
   */
  collectionCounts(): CollectionCounts {
    const row = this.database.prepare(`
      SELECT
        SUM(CASE WHEN favorite = 1 THEN 1 ELSE 0 END) as favorites,
        SUM(CASE WHEN play_status = 'playing' THEN 1 ELSE 0 END) as playing,
        SUM(CASE WHEN play_status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN launch_count > 0 THEN 1 ELSE 0 END) as mostPlayed
      FROM games
    `).get() as { favorites: number; playing: number; completed: number; mostPlayed: number };
    return {
      favorites: row.favorites ?? 0,
      playing: row.playing ?? 0,
      completed: row.completed ?? 0,
      mostPlayed: row.mostPlayed ?? 0
    };
  }

  /**
   * Retorna estatísticas agregadas do histórico de partidas registradas.
   * A UI usa esses dados na seção dedicada de Configurações.
   */
  launchStats(): GameLaunchStats {
    const row = this.database.prepare(`
      SELECT
        SUM(launch_count) as totalLaunches,
        SUM(CASE WHEN launch_count > 0 THEN 1 ELSE 0 END) as playedGames
      FROM games
    `).get() as { totalLaunches: number | null; playedGames: number | null };

    return {
      totalLaunches: row.totalLaunches ?? 0,
      playedGames: row.playedGames ?? 0
    };
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
   * Conta jogos-base apos agrupar variantes, igual ao total exibido na biblioteca ("Todos").
   * Usado na aba Sobre para o contador de "Jogos na biblioteca" bater com a contagem da TopBar.
   */
  libraryGameCount(): number {
    return this.countLibraryGroups({ sql: "", params: [] });
  }

  /** Conta grupos visuais diretamente no SQLite, sem materializar todos os jogos no Node. */
  private countLibraryGroups(where: { sql: string; params: unknown[] }): number {
    const row = this.database.prepare(`
      SELECT COUNT(*) AS count
      FROM (
        SELECT ${libraryGroupExpression("games")}
        FROM games
        ${where.sql}
        GROUP BY ${libraryGroupExpression("games")}
      )
    `).get(...where.params) as { count: number };
    return row.count;
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
   * Incrementa o contador de partidas de um jogo após um launch bem-sucedido.
   * Mantém a contagem no SQLite para sobreviver ao fechamento do app.
   */
  incrementLaunchCount(id: number): Game {
    this.database.prepare(`
      UPDATE games
      SET launch_count = launch_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    const updated = this.get(id);
    if (!updated) throw new Error("Jogo não encontrado");
    return updated;
  }

  /**
   * Zera o histórico de partidas de todos os jogos da biblioteca.
   * Retorna quantos registros realmente precisaram ser atualizados.
   */
  resetLaunchCounts(): { success: true; updated: number } {
    const result = this.database.prepare(`
      UPDATE games
      SET launch_count = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE launch_count != 0
    `).run();

    return { success: true, updated: result.changes };
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
   * Lista os `rom_path` já cadastrados dentro de uma pasta específica.
   * Opcionalmente restringe o resultado a uma plataforma.
   *
   * Usado pelo sync incremental para importar apenas arquivos novos,
   * sem reprocessar ROMs que já entraram na biblioteca antes.
   */
  listRomPathsByFolder(folderPath: string, platformId?: number): string[] {
    const normalizedFolder = normalizeFsPath(folderPath);
    const rows = platformId
      ? this.database
        .prepare("SELECT rom_path FROM games WHERE platform_id = ? AND rom_path IS NOT NULL AND rom_path != ''")
        .all(platformId) as Array<{ rom_path: string }>
      : this.database
        .prepare("SELECT rom_path FROM games WHERE rom_path IS NOT NULL AND rom_path != ''")
        .all() as Array<{ rom_path: string }>;

    return rows
      .filter((row) => isPathInsideFolder(row.rom_path, normalizedFolder))
      .map((row) => row.rom_path);
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

    if (existing) {
      // Re-import de pasta/LaunchBox não pode zerar estado do usuário nem apagar
      // dados preenchidos manualmente. Estado ético (favorito/status) nunca é
      // tocado no update; campos de mídia/anotações só são preenchidos quando
      // o registro ainda não possui valor (importa apenas "gaps").
      const update: GameUpdateInput = { ...data };
      delete update.favorite;
      delete update.play_status;
      for (const field of ["notes", "box_art_path", "background_path", "screenshot_path"]) {
        const value = data[field as keyof typeof data];
        if (value === null || value === undefined || value === "") delete update[field as keyof GameUpdateInput];
      }
      return { game: this.update(existing.id, update), created: false };
    }
    return { game: this.create(data), created: true };
  }

  /**
   * Procura um jogo existente para o upsert do LaunchBox.
   * Ordem de preferência: launchbox_id → rom_path → fallback seguro por título.
   *
   * O fallback por título só é usado quando não há risco de colapsar variantes
   * diferentes do mesmo jogo dentro da mesma plataforma.
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

    // Tentativa 3: fallback pelo título apenas quando houver um alvo inequívoco.
    return this.findBySafeTitleFallback(data);
  }

  /**
   * Faz fallback por título sem sobrescrever variantes com ROMs diferentes.
   *
   * Regras:
   * - se a ROM de entrada já existir, ela teria sido encontrada antes;
   * - se houver exatamente um placeholder sem `rom_path`, ele pode ser reaproveitado;
   * - quando existir mais de uma variante plausível, não escolhe nenhuma.
   */
  private findBySafeTitleFallback(data: Partial<GameCreateInput> & { title: string; platform_id: number }): { id: number } | undefined {
    const rows = this.database
      .prepare(`
        SELECT id, rom_path, launchbox_id
        FROM games
        WHERE LOWER(title) = LOWER(?) AND platform_id = ?
        ORDER BY id
      `)
      .all(data.title, data.platform_id) as Array<{ id: number; rom_path: string | null; launchbox_id: string | null }>;

    if (!rows.length) return undefined;

    const rowsWithoutRom = rows.filter((row) => !row.rom_path?.trim());

    // Quando a entrada já possui ROM, só reaproveitamos placeholder único.
    if (data.rom_path?.trim()) {
      if (rowsWithoutRom.length === 1) return { id: rowsWithoutRom[0].id };
      return undefined;
    }

    // Sem ROM de entrada, só reaproveitamos título quando existe um único candidato.
    if (rows.length === 1) return { id: rows[0].id };

    // Se houver um único registro totalmente solto, ele ainda pode absorver metadados.
    const unlinkedPlaceholders = rows.filter((row) => !row.rom_path?.trim() && !row.launchbox_id?.trim());
    if (unlinkedPlaceholders.length === 1) return { id: unlinkedPlaceholders[0].id };

    return undefined;
  }

  /**
   * Busca um jogo já vinculado a um `launchbox_id` dentro da mesma plataforma.
   * Usado para evitar violar o índice único quando outra variante local recebe
   * os mesmos metadados do LaunchBox.
   */
  findByLaunchBoxId(launchboxId: string, platformId: number): Game | null {
    const row = this.database
      .prepare(`${baseSelect()} WHERE games.launchbox_id = ? AND games.platform_id = ? LIMIT 1`)
      .get(launchboxId, platformId) as GameRow | undefined;
    return row ? mapGame(row) : null;
  }

  /**
   * Lista variantes jogáveis relacionadas a um mesmo título-base dentro da plataforma.
   * Quando nenhum par adicional é encontrado, devolve a própria variante atual.
   */
  listVersions(id: number): GameVersionOption[] {
    const current = this.get(id);
    if (!current) return [];

    // Usa mesma chave visual da biblioteca para que o modal de launch
    // reflita exatamente o agrupamento visto pelo usuario.
    const currentBaseTitle = buildVersionGroupKey(current);
    const candidates = this.database
      .prepare(`${baseSelect()} WHERE games.platform_id = ? AND LOWER(games.title) = LOWER(?) AND games.rom_path IS NOT NULL AND TRIM(games.rom_path) != ''`)
      .all(current.platform_id, current.title)
      .map((row) => mapGame(row as GameRow));

    const matches = candidates
      .filter((candidate) => buildVersionGroupKey(candidate) === currentBaseTitle)
      .map(mapVersionOption)
      .sort(compareVersionOptions);

    return matches.length ? matches : [mapVersionOption(current)];
  }
}

/** Converte uma linha do SQLite para o tipo `Game`, convertendo `favorite` de 0|1 para boolean. */
function mapGame(row: GameRow & { library_rank?: number }): Game {
  // Ranking existe só dentro da CTE; não deve atravessar o contrato IPC de Game.
  const { library_rank: _libraryRank, ...game } = row;
  return { ...game, favorite: Boolean(game.favorite) };
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
 * Monta expressão SQL da chave visual com plataforma, ROM e fallback seguro.
 * Chaves legadas vazias permanecem independentes até migration preencher registro.
 */
function libraryGroupExpression(tableAlias: string): string {
  return `
    CASE
      WHEN ${tableAlias}.rom_path IS NULL OR TRIM(${tableAlias}.rom_path) = '' THEN 'manual:' || ${tableAlias}.id
      WHEN ${tableAlias}.library_group_key IS NULL OR TRIM(${tableAlias}.library_group_key) = '' THEN 'legacy:' || ${tableAlias}.id
      ELSE 'rom:' || ${tableAlias}.platform_id || ':' || ${tableAlias}.library_group_key
    END
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
  // Função SQLite preserva separadores e normalização usados no filtro de gêneros anterior.
  if (filters.genre?.trim()) {
    parts.push("library_has_genre(games.genre, ?) = 1");
    params.push(filters.genre);
  }
  // Filtro de coleção (favoritos, jogando, concluídos, não jogados, mais jogados)
  if (filters.collectionFilter) {
    const collection = buildCollectionFilter(filters.collectionFilter);
    if (collection) parts.push(collection);
  }
  // Quando desativado, mantém somente registros que possuem caminho de capa válido.
  if (filters.includeMissingCovers === false) {
    parts.push("games.box_art_path IS NOT NULL AND TRIM(games.box_art_path) != ''");
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
    case "mostPlayed":
      return "games.launch_count > 0";
    case "all":
      return null;
  }
}

/**
 * Constrói a cláusula ORDER BY conforme o critério de ordenação solicitado.
 * - year: mais recentes primeiro, com nulos no final
 * - recent: por data de criação decrescente
 * - mostPlayed: jogos com maior `launch_count` no topo
 * - title: alfabético case-insensitive (padrão)
 */
function buildOrderTerms(filters: GameFilters = {}, tableAlias = "games"): string {
  if (filters.collectionFilter === "mostPlayed") {
    return `${tableAlias}.launch_count DESC, ${tableAlias}.title COLLATE NOCASE`;
  }

  const sortBy = filters.sortBy ?? "title";
  switch (sortBy) {
    case "year":
      return `${tableAlias}.year IS NULL, ${tableAlias}.year DESC, ${tableAlias}.title COLLATE NOCASE`;
    case "recent":
      return `${tableAlias}.created_at DESC, ${tableAlias}.id DESC`;
    case "mostPlayed":
      return `${tableAlias}.launch_count DESC, ${tableAlias}.title COLLATE NOCASE`;
    case "title":
      return `${tableAlias}.title COLLATE NOCASE`;
  }
}

/** Divide campo composto de gêneros em tokens individuais para montar opções de filtro. */
function splitGenres(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[;,/|]+/g)
    .map((genre) => genre.trim())
    .filter(Boolean);
}

/** Normaliza gênero apenas para comparação, sem alterar o rótulo salvo no banco. */
function normalizeGenre(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase("pt-BR") ?? "";
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
    launchbox_id: has(data, "launchbox_id") ? data.launchbox_id ?? null : undefined,
    launch_count: has(data, "launch_count") ? Math.max(0, data.launch_count ?? 0) : undefined
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
  let normalized = path
    .resolve(value)
    .replace(/\\/g, "/")  // Windows: \ → /
    .replace(/\/+$/g, "") // Remove barra final
    .toLowerCase();
  // Raiz do filesystem (ex.: "/"): sem barra final viraria string vazia.
  if (normalized === "") normalized = "/";
  // Raiz de drive Windows (ex.: "c:"): sem "/" final, isPathInsideFolder
  // compararia "c:/arquivo" contra "c:" e nunca casaria.
  else if (/^[a-z]:$/.test(normalized)) normalized = `${normalized}/`;
  return normalized;
}

/**
 * Normaliza um título de jogo para matching case-insensitive.
 * Remove espaços extras e converte para minúsculas.
 */
function normalizeTitleForMatch(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Gera a chave de agrupamento de versões removendo tags comuns do título e da ROM.
 * Isso aproxima variantes como regiões, revisões e traduções de um mesmo jogo-base.
 */
function buildVersionBaseTitle(game: Pick<Game, "title" | "rom_path">): string {
  const romFileName = game.rom_path ? path.basename(game.rom_path, path.extname(game.rom_path)) : "";
  const romBase = stripVersionTags(romFileName);
  const titleBase = stripVersionTags(game.title);
  const candidate = romBase.length >= Math.max(6, titleBase.length - 4) ? romBase : titleBase;
  return normalizeTitleForMatch(candidate);
}

/**
 * Define chave de grupo priorizando o titulo salvo na biblioteca.
 * Quando varias ROMs compartilham o mesmo titulo exibido, elas ficam em um
 * unico card e a escolha real acontece apenas na hora do launch.
 */
function buildVersionGroupKey(game: Pick<Game, "title" | "rom_path">): string {
  // Quando a ROM carrega um subtitulo real ausente no titulo salvo
  // (ex.: "GP-1 RS - Rapid Stream"), agrupamos pela ROM para nao
  // colapsar continuacoes ou edicoes substantivas no mesmo card.
  if (game.rom_path && detectVariantDescriptor(path.basename(game.rom_path), game.title)) {
    return buildVersionBaseTitle(game);
  }
  const normalizedTitleBase = normalizeTitleForMatch(stripVersionTags(game.title));
  return normalizedTitleBase || buildVersionBaseTitle(game);
}

/**
 * Remove tags entre delimitadores e marcadores frequentes de revisão/versão.
 */
function stripVersionTags(value: string): string {
  return value
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ")
    .replace(/\b(?:rev(?:ision)?\.?\s*[a-z0-9.]+|v\d[\w.]*)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converte um jogo salvo em opção de variante pronta para a UI de seleção.
 */
function mapVersionOption(game: Game): GameVersionOption {
  const romFileName = game.rom_path ? path.basename(game.rom_path) : game.title;
  const tags = extractRomTags(romFileName);
  const regionLabel = detectRegionLabel(tags);
  const variantDescriptor = detectVariantDescriptor(romFileName, game.title);
  const typeLabel = detectTypeLabel(tags);
  const variantParts = [regionLabel, variantDescriptor, typeLabel].filter(Boolean);

  return {
    id: game.id,
    title: game.title,
    platformName: game.platform_name ?? null,
    launchCount: game.launch_count,
    romFileName,
    baseTitle: stripVersionTags(game.title) || game.title,
    regionLabel,
    typeLabel,
    variantLabel: variantParts.join(" · ") || "Versão padrão",
    boxArtPath: game.box_art_path ?? null,
    backgroundPath: game.background_path ?? null,
    screenshotPath: game.screenshot_path ?? null
  };
}

/**
 * Ordena variantes priorizando as mais jogadas e, em seguida, nome do arquivo.
 */
function compareVersionOptions(left: GameVersionOption, right: GameVersionOption): number {
  if (right.launchCount !== left.launchCount) return right.launchCount - left.launchCount;
  return left.romFileName.localeCompare(right.romFileName, undefined, { sensitivity: "base" });
}

/**
 * Extrai tags textuais do nome do arquivo ROM para inferir região e tipo.
 */
function extractRomTags(romFileName: string): string[] {
  return Array.from(romFileName.matchAll(/\(([^)]*)\)|\[([^\]]*)\]|\{([^}]*)\}/g))
    .map((match) => match[1] ?? match[2] ?? match[3] ?? "")
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Extrai um subtitulo util da ROM quando o arquivo traz detalhe adicional
 * alem do titulo-base salvo na biblioteca, como "RS - Rapid Stream".
 */
function detectVariantDescriptor(romFileName: string, title: string): string | null {
  const romStem = stripVersionTags(path.basename(romFileName, path.extname(romFileName)));
  const titleStem = stripVersionTags(title);

  if (!romStem || !titleStem) return null;
  if (normalizeTitleForMatch(romStem) === normalizeTitleForMatch(titleStem)) return null;

  const prefixPattern = new RegExp(`^${escapeRegExp(titleStem)}(?:\\s*[-:]+\\s*|\\s+)`, "i");
  const descriptor = romStem.replace(prefixPattern, "").trim();
  return descriptor && normalizeTitleForMatch(descriptor) !== normalizeTitleForMatch(romStem) ? descriptor : null;
}

/**
 * Detecta rótulo curto de região a partir das tags conhecidas do arquivo.
 */
function detectRegionLabel(tags: string[]): string | null {
  const normalizedTags = tags.map((tag) => tag.toLowerCase());
  if (normalizedTags.some((tag) => /\b(japan|jpn|jap|ntsc-j)\b/.test(tag))) return "JAP";
  if (normalizedTags.some((tag) => /\b(usa|north america|ntsc-u)\b/.test(tag))) return "USA";
  if (normalizedTags.some((tag) => /\b(europe|eur|pal)\b/.test(tag))) return "EUR";
  if (normalizedTags.some((tag) => /\b(brazil|br)\b/.test(tag))) return "BRA";
  return null;
}

/**
 * Detecta categoria especial de variante para exibição no modal.
 */
function detectTypeLabel(tags: string[]): string | null {
  for (const tag of tags) {
    if (/hack/i.test(tag)) return "Hack";
    if (/translat/i.test(tag)) return "Tradução";
    if (/prototype|proto/i.test(tag)) return "Prototype";
    if (/beta/i.test(tag)) return "Beta";
    if (/revision|rev\b/i.test(tag)) return "Revision";
    if (/demo/i.test(tag)) return "Demo";
  }
  return null;
}

/**
 * Escapa texto dinamico antes de montar RegExp com prefixo baseado no titulo.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
