/**
 * DAO de plataformas.
 *
 * Gerencia operações CRUD sobre a tabela `platforms` e as tabelas relacionadas
 * `platform_launchbox_aliases` e `platform_rom_extensions` no SQLite.
 *
 * Plataformas padrão (`is_default = 1`) não podem ser removidas.
 * Plataformas com jogos associados também não podem ser removidas.
 */

import type Database from "better-sqlite3";
import { Platform, PlatformLaunchBoxAlias, PlatformMappingsInput, PlatformRomExtension } from "../../../shared/types";

/**
 * Dados de entrada para criação ou atualização de uma plataforma.
 * Subconjunto dos campos de `Platform` — exclui campos gerados pelo banco.
 */
export type PlatformInput = Pick<Platform, "name" | "category">;

export class PlatformDao {
  constructor(private readonly database: Database.Database) {}

  /**
   * Lista todas as plataformas com o contador de jogos associados.
   * Ordenadas pelo nome (case-insensitive).
   */
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

  /**
   * Cria uma nova plataforma no banco de dados.
   * Usa "Outros" como categoria padrão se a categoria fornecida for vazia.
   *
   * @throws {Error} Se o nome estiver vazio.
   * @throws {Error} Se já existir uma plataforma com o mesmo nome (violação UNIQUE).
   */
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

  /**
   * Atualiza nome e/ou categoria de uma plataforma existente.
   * Mantém os valores atuais para campos não fornecidos.
   *
   * @throws {Error} Se a plataforma não for encontrada.
   * @throws {Error} Se o novo nome colidir com outra plataforma existente.
   */
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

  /**
   * Remove uma plataforma do banco de dados.
   *
   * @throws {Error} Se a plataforma não for encontrada.
   * @throws {Error} Se for uma plataforma padrão (`is_default = 1`).
   * @throws {Error} Se houver jogos associados à plataforma.
   */
  delete(id: number): { success: true } {
    const platform = this.database.prepare("SELECT is_default FROM platforms WHERE id = ?").get(id) as { is_default: number } | undefined;
    if (!platform) throw new Error("Plataforma não encontrada");
    // Protege plataformas padrão do sistema contra remoção acidental
    if (platform.is_default) throw new Error("Não é possível remover plataformas padrão");
    // Protege contra remoção de plataformas com jogos cadastrados
    const count = this.database.prepare("SELECT COUNT(*) as count FROM games WHERE platform_id = ?").get(id) as { count: number };
    if (count.count > 0) throw new Error("Não é possível remover plataforma com jogos associados");
    // Protege contra remoção de plataformas com itens físicos no inventário,
    // que ficariam órfãos com platform_id = NULL (ON DELETE SET NULL), invisíveis.
    const inventoryCount = this.database.prepare("SELECT COUNT(*) as count FROM hardware_items WHERE platform_id = ?").get(id) as { count: number };
    if (inventoryCount.count > 0) throw new Error("Não é possível remover plataforma com itens de inventário associados");
    this.database.prepare("DELETE FROM platforms WHERE id = ?").run(id);
    return { success: true };
  }

  /**
   * Busca uma plataforma pelo nome (case-insensitive) ou cria uma nova
   * com a categoria informada se não existir.
   *
   * Usado durante importações onde a plataforma pode ou não estar cadastrada.
   */
  findOrCreate(name: string, category = "Importadas"): Platform {
    const existing = this.database.prepare("SELECT * FROM platforms WHERE LOWER(name) = LOWER(?)").get(name) as Platform | undefined;
    return existing ?? this.create({ name, category });
  }

  /**
   * Lista os aliases do LaunchBox.
   * Se `platformId` for fornecido, filtra apenas os aliases da plataforma informada.
   * Inclui o nome da plataforma via JOIN para exibição na UI.
   */
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

  /**
   * Lista as extensões de ROM registradas.
   *
   * @param platformId   Quando fornecido, filtra extensões de uma plataforma específica.
   * @param primaryOnly  Quando `true`, retorna apenas extensões marcadas como primárias.
   */
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

  /**
   * Busca uma plataforma pelo ID SQLite.
   * Retorna `null` se o registro não existir.
   * O campo `gameCount` é retornado como 0 (sem JOIN com games).
   */
  get(id: number): Platform | null {
    return (this.database.prepare("SELECT *, 0 as gameCount FROM platforms WHERE id = ?").get(id) as Platform | undefined) ?? null;
  }

  /**
   * Salva os mapeamentos de uma plataforma (aliases e extensões de ROM) em uma
   * única transação atômica.
   *
   * Apaga todos os aliases e extensões existentes da plataforma antes de reinserir,
   * garantindo que o estado gravado reflita exatamente o input fornecido.
   *
   * Validações:
   * - Plataforma deve existir
   * - Ao menos um alias deve ser fornecido
   * - Ao menos uma extensão de ROM deve ser fornecida
   * - Ao menos uma extensão deve ser marcada como primária
   *
   * Extensões duplicadas (após normalização) são removidas automaticamente via Map.
   */
  saveMappings(platformId: number, input: PlatformMappingsInput): void {
    const platform = this.get(platformId);
    if (!platform) throw new Error("Plataforma não encontrada");

    // Deduplica e sanitiza os aliases fornecidos
    const normalizedAliases = Array.from(
      new Set(
        input.aliases
          .map((alias) => alias.trim())
          .filter(Boolean)
      )
    );
    if (!normalizedAliases.length) throw new Error("Informe ao menos um alias do LaunchBox");

    // Normaliza extensões e remove duplicatas usando o nome da extensão como chave do Map
    const normalizedExtensions = Array.from(
      new Map(
        input.romExtensions
          .map((entry) => ({
            extension: normalizeExtension(entry.extension),
            kind: entry.kind.trim(),
            is_primary: entry.is_primary ? 1 : 0
          }))
          .filter((entry) => entry.extension) // Remove extensões com valor vazio
          .map((entry) => [entry.extension, entry]) // Usa a extensão como chave para deduplicação
      ).values()
    );
    if (!normalizedExtensions.length) throw new Error("Informe ao menos uma extensão principal de ROM");
    if (!normalizedExtensions.some((entry) => entry.is_primary === 1)) throw new Error("Marque ao menos uma extensão principal");

    const insertAlias = this.database.prepare("INSERT INTO platform_launchbox_aliases (platform_id, alias) VALUES (?, ?)");
    const insertExtension = this.database.prepare(`
      INSERT INTO platform_rom_extensions (platform_id, extension, kind, is_primary)
      VALUES (?, ?, ?, ?)
    `);

    // Executa limpeza e reinserção em transação para garantir atomicidade
    this.database.transaction(() => {
      // Remove registros antigos antes de reinserir
      this.database.prepare("DELETE FROM platform_launchbox_aliases WHERE platform_id = ?").run(platformId);
      this.database.prepare("DELETE FROM platform_rom_extensions WHERE platform_id = ?").run(platformId);

      // Reinsere aliases normalizados
      for (const alias of normalizedAliases) {
        insertAlias.run(platformId, alias);
      }

      // Reinsere extensões normalizadas
      for (const extension of normalizedExtensions) {
        insertExtension.run(platformId, extension.extension, extension.kind, extension.is_primary);
      }
    })();
  }
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
