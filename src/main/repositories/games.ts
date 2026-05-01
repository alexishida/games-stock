import { getDatabase } from "../database";
import { Game, GameCreateInput, GameFilters, GameListResult, GameUpdateInput } from "../../shared/types";

type GameRow = Omit<Game, "owned_physical"> & { owned_physical: 0 | 1 };

const writeColumns = [
  "title",
  "platform_id",
  "publisher",
  "year",
  "genre",
  "rating",
  "box_art_path",
  "rom_path",
  "owned_physical",
  "physical_condition",
  "notes",
  "launchbox_id"
] as const;

function mapGame(row: GameRow): Game {
  return { ...row, owned_physical: Boolean(row.owned_physical) };
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
  if (filters.ownedPhysical) {
    parts.push("games.owned_physical = 1");
  }

  return {
    sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "",
    params
  };
}

export function listGames(filters: GameFilters = {}): GameListResult {
  const database = getDatabase();
  const where = buildWhere(filters);
  const items = database
    .prepare(`${baseSelect()} ${where.sql} ORDER BY games.title COLLATE NOCASE`)
    .all(...where.params)
    .map((row) => mapGame(row as GameRow));
  const total = (database.prepare("SELECT COUNT(*) as count FROM games").get() as { count: number }).count;

  return { items, total, filtered: items.length };
}

export function getGame(id: number): Game | null {
  const row = getDatabase().prepare(`${baseSelect()} WHERE games.id = ?`).get(id) as GameRow | undefined;
  return row ? mapGame(row) : null;
}

export function createGame(data: Partial<GameCreateInput>): Game {
  if (!data.title?.trim()) throw new Error("Titulo e obrigatorio");
  if (!data.platform_id) throw new Error("Plataforma e obrigatoria");

  const values = normalizeInput(data);
  const result = getDatabase()
    .prepare(`
      INSERT INTO games (${writeColumns.join(", ")})
      VALUES (${writeColumns.map(() => "?").join(", ")})
    `)
    .run(...writeColumns.map((column) => values[column]));

  return getGame(Number(result.lastInsertRowid))!;
}

export function updateGame(id: number, data: GameUpdateInput): Game {
  const entries = Object.entries(normalizeInput(data)).filter(([, value]) => value !== undefined);
  if (!entries.length) return getGame(id)!;

  const assignments = entries.map(([column]) => `${column} = ?`).join(", ");
  getDatabase()
    .prepare(`UPDATE games SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(...entries.map(([, value]) => value), id);
  const updated = getGame(id);
  if (!updated) throw new Error("Jogo nao encontrado");
  return updated;
}

export function deleteGame(id: number): { success: true } {
  getDatabase().prepare("DELETE FROM games WHERE id = ?").run(id);
  return { success: true };
}

export function upsertLaunchBoxGame(data: Partial<GameCreateInput> & { title: string; platform_id: number }): { game: Game; created: boolean } {
  const existing = getDatabase()
    .prepare("SELECT id FROM games WHERE LOWER(title) = LOWER(?) AND platform_id = ?")
    .get(data.title, data.platform_id) as { id: number } | undefined;

  if (existing) return { game: updateGame(existing.id, data), created: false };
  return { game: createGame(data), created: true };
}

function normalizeInput(data: Partial<GameCreateInput>): Record<string, unknown> {
  return {
    title: data.title?.trim(),
    platform_id: data.platform_id,
    publisher: data.publisher ?? null,
    year: data.year ?? null,
    genre: data.genre ?? null,
    rating: data.rating ?? null,
    box_art_path: data.box_art_path ?? null,
    rom_path: data.rom_path ?? null,
    owned_physical: data.owned_physical ? 1 : 0,
    physical_condition: data.owned_physical ? data.physical_condition ?? null : null,
    notes: data.notes ?? null,
    launchbox_id: data.launchbox_id ?? null
  };
}
