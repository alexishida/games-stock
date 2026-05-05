import type Database from "better-sqlite3";
import { Platform, PlatformLaunchBoxAlias, PlatformMappingsInput, PlatformRomExtension } from "../../../shared/types";

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
    if (!data.name?.trim()) throw new Error("Nome da plataforma é obrigatório");
    try {
      const result = this.database
        .prepare("INSERT INTO platforms (name, category) VALUES (?, ?)")
        .run(data.name.trim(), data.category.trim() || "Outros");
      return this.get(Number(result.lastInsertRowid))!;
    } catch (error) {
      if (String(error).includes("UNIQUE")) throw new Error("Plataforma já existe");
      throw error;
    }
  }

  update(id: number, data: Partial<PlatformInput>): Platform {
    const current = this.get(id);
    if (!current) throw new Error("Plataforma não encontrada");
    try {
      this.database
        .prepare("UPDATE platforms SET name = ?, category = ? WHERE id = ?")
        .run(data.name?.trim() || current.name, data.category?.trim() || current.category, id);
      return this.get(id)!;
    } catch (error) {
      if (String(error).includes("UNIQUE")) throw new Error("Plataforma já existe");
      throw error;
    }
  }

  delete(id: number): { success: true } {
    const platform = this.database.prepare("SELECT is_default FROM platforms WHERE id = ?").get(id) as { is_default: number } | undefined;
    if (!platform) throw new Error("Plataforma não encontrada");
    if (platform.is_default) throw new Error("Não é possível remover plataformas padrão");
    const count = this.database.prepare("SELECT COUNT(*) as count FROM games WHERE platform_id = ?").get(id) as { count: number };
    if (count.count > 0) throw new Error("Não é possível remover plataforma com jogos associados");
    this.database.prepare("DELETE FROM platforms WHERE id = ?").run(id);
    return { success: true };
  }

  findOrCreate(name: string, category = "Importadas"): Platform {
    const existing = this.database.prepare("SELECT * FROM platforms WHERE LOWER(name) = LOWER(?)").get(name) as Platform | undefined;
    return existing ?? this.create({ name, category });
  }

  listLaunchBoxAliases(platformId?: number): PlatformLaunchBoxAlias[] {
    const sql = `
      SELECT
        platform_launchbox_aliases.id,
        platform_launchbox_aliases.platform_id,
        platforms.name as platform_name,
        platform_launchbox_aliases.alias
      FROM platform_launchbox_aliases
      JOIN platforms ON platforms.id = platform_launchbox_aliases.platform_id
      ${platformId ? "WHERE platform_launchbox_aliases.platform_id = ?" : ""}
      ORDER BY platforms.name COLLATE NOCASE, platform_launchbox_aliases.alias COLLATE NOCASE
    `;
    return (platformId
      ? this.database.prepare(sql).all(platformId)
      : this.database.prepare(sql).all()) as PlatformLaunchBoxAlias[];
  }

  listRomExtensions(platformId?: number, primaryOnly = false): PlatformRomExtension[] {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (platformId) {
      clauses.push("platform_rom_extensions.platform_id = ?");
      params.push(platformId);
    }
    if (primaryOnly) {
      clauses.push("platform_rom_extensions.is_primary = 1");
    }

    const sql = `
      SELECT
        platform_rom_extensions.id,
        platform_rom_extensions.platform_id,
        platforms.name as platform_name,
        platform_rom_extensions.extension,
        platform_rom_extensions.kind,
        platform_rom_extensions.is_primary
      FROM platform_rom_extensions
      JOIN platforms ON platforms.id = platform_rom_extensions.platform_id
      ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
      ORDER BY platforms.name COLLATE NOCASE, platform_rom_extensions.extension COLLATE NOCASE
    `;

    return this.database.prepare(sql).all(...params) as PlatformRomExtension[];
  }

  get(id: number): Platform | null {
    return (this.database.prepare("SELECT *, 0 as gameCount FROM platforms WHERE id = ?").get(id) as Platform | undefined) ?? null;
  }

  saveMappings(platformId: number, input: PlatformMappingsInput): void {
    const platform = this.get(platformId);
    if (!platform) throw new Error("Plataforma não encontrada");

    const normalizedAliases = Array.from(
      new Set(
        input.aliases
          .map((alias) => alias.trim())
          .filter(Boolean)
      )
    );
    if (!normalizedAliases.length) throw new Error("Informe ao menos um alias do LaunchBox");

    const normalizedExtensions = Array.from(
      new Map(
        input.romExtensions
          .map((entry) => ({
            extension: normalizeExtension(entry.extension),
            kind: entry.kind.trim(),
            is_primary: entry.is_primary ? 1 : 0
          }))
          .filter((entry) => entry.extension)
          .map((entry) => [entry.extension, entry])
      ).values()
    );
    if (!normalizedExtensions.length) throw new Error("Informe ao menos uma extensão principal de ROM");
    if (!normalizedExtensions.some((entry) => entry.is_primary === 1)) throw new Error("Marque ao menos uma extensão principal");

    const insertAlias = this.database.prepare("INSERT INTO platform_launchbox_aliases (platform_id, alias) VALUES (?, ?)");
    const insertExtension = this.database.prepare(`
      INSERT INTO platform_rom_extensions (platform_id, extension, kind, is_primary)
      VALUES (?, ?, ?, ?)
    `);

    this.database.transaction(() => {
      this.database.prepare("DELETE FROM platform_launchbox_aliases WHERE platform_id = ?").run(platformId);
      this.database.prepare("DELETE FROM platform_rom_extensions WHERE platform_id = ?").run(platformId);

      for (const alias of normalizedAliases) {
        insertAlias.run(platformId, alias);
      }

      for (const extension of normalizedExtensions) {
        insertExtension.run(platformId, extension.extension, extension.kind, extension.is_primary);
      }
    })();
  }
}

function normalizeExtension(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}
