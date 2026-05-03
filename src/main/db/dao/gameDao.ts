import type Database from "better-sqlite3";
import path from "node:path";
import { CollectionCounts, CollectionFilter, CoverSyncStats, Game, GameCreateInput, GameFilters, GameListResult, GameSortBy, GameUpdateInput } from "../../../shared/types";

type GameRow = Omit<Game, "favorite"> & { favorite: 0 | 1 };

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

  list(filters: GameFilters = {}): GameListResult {
    const where = buildWhere(filters);
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = filters.pageSize ?? 50;
    const offset = (page - 1) * pageSize;

    const filtered = (
      this.database
        .prepare(`SELECT COUNT(*) as count FROM games JOIN platforms ON platforms.id = games.platform_id ${where.sql}`)
        .get(...where.params) as { count: number }
    ).count;

    const items = this.database
      .prepare(`${baseSelect()} ${where.sql} ${buildOrder(filters.sortBy)} LIMIT ? OFFSET ?`)
      .all(...where.params, pageSize, offset)
      .map((row) => mapGame(row as GameRow));

    const total = (this.database.prepare("SELECT COUNT(*) as count FROM games").get() as { count: number }).count;

    return { items, total, filtered };
  }

  get(id: number): Game | null {
    const row = this.database.prepare(`${baseSelect()} WHERE games.id = ?`).get(id) as GameRow | undefined;
    return row ? mapGame(row) : null;
  }

  create(data: Partial<GameCreateInput>): Game {
    if (!data.title?.trim()) throw new Error("Titulo e obrigatorio");
    if (!data.platform_id) throw new Error("Plataforma e obrigatoria");

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

  update(id: number, data: GameUpdateInput): Game {
    const entries = Object.entries(normalizeInput(data)).filter(([, value]) => value !== undefined);
    if (!entries.length) return this.get(id)!;

    const assignments = entries.map(([column]) => `${column} = ?`).join(", ");
    this.database
      .prepare(`UPDATE games SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(...entries.map(([, value]) => value), id);
    const updated = this.get(id);
    if (!updated) throw new Error("Jogo nao encontrado");
    return updated;
  }

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
      metadataDownloadedAt: null
    };
  }

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

  delete(id: number): { success: true } {
    this.database.prepare("DELETE FROM games WHERE id = ?").run(id);
    return { success: true };
  }

  deleteByRomFolder(folderPath: string): { success: true; deleted: number } {
    const normalizedFolder = normalizeFsPath(folderPath);
    const rows = this.database.prepare("SELECT id, rom_path FROM games WHERE rom_path IS NOT NULL").all() as Array<{ id: number; rom_path: string }>;
    const ids = rows
      .filter((row) => isPathInsideFolder(row.rom_path, normalizedFolder))
      .map((row) => row.id);

    if (!ids.length) return { success: true, deleted: 0 };

    const remove = this.database.prepare("DELETE FROM games WHERE id = ?");
    this.database.transaction((gameIds: number[]) => {
      for (const id of gameIds) remove.run(id);
    })(ids);
    return { success: true, deleted: ids.length };
  }

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

  deleteWithoutRomPathByPlatformAndTitles(platformId: number, titles: string[]): { success: true; deleted: number } {
    const normalizedTitles = new Set(titles.map(normalizeTitleForMatch).filter(Boolean));
    if (!normalizedTitles.size) return { success: true, deleted: 0 };

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

  upsertLaunchBox(data: Partial<GameCreateInput> & { title: string; platform_id: number }): { game: Game; created: boolean } {
    const existing = this.findExisting(data);

    if (existing) return { game: this.update(existing.id, data), created: false };
    return { game: this.create(data), created: true };
  }

  private findExisting(data: Partial<GameCreateInput> & { title: string; platform_id: number }): { id: number } | undefined {
    if (data.launchbox_id) {
      const byLaunchBoxId = this.database
        .prepare("SELECT id FROM games WHERE launchbox_id = ? AND platform_id = ?")
        .get(data.launchbox_id, data.platform_id) as { id: number } | undefined;
      if (byLaunchBoxId) return byLaunchBoxId;
    }

    if (data.rom_path) {
      const byRomPath = this.database
        .prepare("SELECT id FROM games WHERE rom_path = ? AND platform_id = ?")
        .get(data.rom_path, data.platform_id) as { id: number } | undefined;
      if (byRomPath) return byRomPath;
    }

    return this.database
      .prepare("SELECT id FROM games WHERE LOWER(title) = LOWER(?) AND platform_id = ?")
      .get(data.title, data.platform_id) as { id: number } | undefined;
  }
}

function mapGame(row: GameRow): Game {
  return { ...row, favorite: Boolean(row.favorite) };
}

function baseSelect(): string {
  return `
    SELECT games.*, platforms.name as platform_name
    FROM games
    JOIN platforms ON platforms.id = games.platform_id
  `;
}

function buildWhere(filters: GameFilters = {}): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];

  if (filters.platformId) {
    parts.push("games.platform_id = ?");
    params.push(filters.platformId);
  }
  if (filters.search?.trim()) {
    parts.push("LOWER(games.title) LIKE ?");
    params.push(`%${filters.search.trim().toLowerCase()}%`);
  }
  if (filters.collectionFilter) {
    const collection = buildCollectionFilter(filters.collectionFilter);
    if (collection) parts.push(collection);
  }

  return {
    sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "",
    params
  };
}

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
    favorite: has(data, "favorite") ? (data.favorite ? 1 : 0) : undefined,
    play_status: has(data, "play_status") ? data.play_status ?? "unplayed" : undefined,
    notes: has(data, "notes") ? data.notes ?? null : undefined,
    launchbox_id: has(data, "launchbox_id") ? data.launchbox_id ?? null : undefined
  };
}

function has(data: Partial<GameCreateInput>, key: keyof GameCreateInput): boolean {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function isPathInsideFolder(targetPath: string, normalizedFolder: string): boolean {
  const normalizedTarget = normalizeFsPath(targetPath);
  return normalizedTarget === normalizedFolder || normalizedTarget.startsWith(`${normalizedFolder}/`);
}

function normalizeFsPath(value: string): string {
  return path
    .resolve(value)
    .replace(/\\/g, "/")
    .replace(/\/+$/g, "")
    .toLowerCase();
}

function normalizeTitleForMatch(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
