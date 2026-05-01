import { getDatabase } from "../database";
import { Platform } from "../../shared/types";

export type PlatformInput = Pick<Platform, "name" | "category">;

export function listPlatforms(): Platform[] {
  return getDatabase()
    .prepare(`
      SELECT platforms.*, COUNT(games.id) as gameCount
      FROM platforms
      LEFT JOIN games ON games.platform_id = platforms.id
      GROUP BY platforms.id
      ORDER BY platforms.category COLLATE NOCASE, platforms.name COLLATE NOCASE
    `)
    .all() as Platform[];
}

export function createPlatform(data: PlatformInput): Platform {
  if (!data.name?.trim()) throw new Error("Nome da plataforma e obrigatorio");
  try {
    const result = getDatabase()
      .prepare("INSERT INTO platforms (name, category) VALUES (?, ?)")
      .run(data.name.trim(), data.category.trim() || "Outros");
    return getPlatform(Number(result.lastInsertRowid))!;
  } catch (error) {
    if (String(error).includes("UNIQUE")) throw new Error("Plataforma ja existe");
    throw error;
  }
}

export function updatePlatform(id: number, data: Partial<PlatformInput>): Platform {
  const current = getPlatform(id);
  if (!current) throw new Error("Plataforma nao encontrada");
  try {
    getDatabase()
      .prepare("UPDATE platforms SET name = ?, category = ? WHERE id = ?")
      .run(data.name?.trim() || current.name, data.category?.trim() || current.category, id);
    return getPlatform(id)!;
  } catch (error) {
    if (String(error).includes("UNIQUE")) throw new Error("Plataforma ja existe");
    throw error;
  }
}

export function deletePlatform(id: number): { success: true } {
  const count = getDatabase().prepare("SELECT COUNT(*) as count FROM games WHERE platform_id = ?").get(id) as { count: number };
  if (count.count > 0) throw new Error("Nao e possivel remover plataforma com jogos associados");
  getDatabase().prepare("DELETE FROM platforms WHERE id = ?").run(id);
  return { success: true };
}

export function findOrCreatePlatform(name: string, category = "Importadas"): Platform {
  const existing = getDatabase().prepare("SELECT * FROM platforms WHERE LOWER(name) = LOWER(?)").get(name) as Platform | undefined;
  return existing ?? createPlatform({ name, category });
}

function getPlatform(id: number): Platform | null {
  return (getDatabase().prepare("SELECT *, 0 as gameCount FROM platforms WHERE id = ?").get(id) as Platform | undefined) ?? null;
}
