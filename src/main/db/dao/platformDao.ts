import type Database from "better-sqlite3";
import { Platform } from "../../../shared/types";

export type PlatformInput = Pick<Platform, "name" | "category">;

export class PlatformDao {
  constructor(private readonly database: Database.Database) {}

  list(): Platform[] {
    return this.database
      .prepare(`
        SELECT platforms.*, COUNT(games.id) as gameCount
        FROM platforms
        LEFT JOIN games ON games.platform_id = platforms.id
        GROUP BY platforms.id
        ORDER BY platforms.name COLLATE NOCASE
      `)
      .all() as Platform[];
  }

  create(data: PlatformInput): Platform {
    if (!data.name?.trim()) throw new Error("Nome da plataforma e obrigatorio");
    try {
      const result = this.database
        .prepare("INSERT INTO platforms (name, category) VALUES (?, ?)")
        .run(data.name.trim(), data.category.trim() || "Outros");
      return this.get(Number(result.lastInsertRowid))!;
    } catch (error) {
      if (String(error).includes("UNIQUE")) throw new Error("Plataforma ja existe");
      throw error;
    }
  }

  update(id: number, data: Partial<PlatformInput>): Platform {
    const current = this.get(id);
    if (!current) throw new Error("Plataforma nao encontrada");
    try {
      this.database
        .prepare("UPDATE platforms SET name = ?, category = ? WHERE id = ?")
        .run(data.name?.trim() || current.name, data.category?.trim() || current.category, id);
      return this.get(id)!;
    } catch (error) {
      if (String(error).includes("UNIQUE")) throw new Error("Plataforma ja existe");
      throw error;
    }
  }

  delete(id: number): { success: true } {
    const platform = this.database.prepare("SELECT is_default FROM platforms WHERE id = ?").get(id) as { is_default: number } | undefined;
    if (!platform) throw new Error("Plataforma nao encontrada");
    if (platform.is_default) throw new Error("Nao e possivel remover plataformas padrao");
    const count = this.database.prepare("SELECT COUNT(*) as count FROM games WHERE platform_id = ?").get(id) as { count: number };
    if (count.count > 0) throw new Error("Nao e possivel remover plataforma com jogos associados");
    this.database.prepare("DELETE FROM platforms WHERE id = ?").run(id);
    return { success: true };
  }

  findOrCreate(name: string, category = "Importadas"): Platform {
    const existing = this.database.prepare("SELECT * FROM platforms WHERE LOWER(name) = LOWER(?)").get(name) as Platform | undefined;
    return existing ?? this.create({ name, category });
  }

  get(id: number): Platform | null {
    return (this.database.prepare("SELECT *, 0 as gameCount FROM platforms WHERE id = ?").get(id) as Platform | undefined) ?? null;
  }
}
