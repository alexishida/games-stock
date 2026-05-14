/**
 * DAO para itens de hardware do inventário físico.
 *
 * Gerencia CRUD completo na tabela `hardware_items`, incluindo listagem com filtros
 * combinados (plataforma, tipo, estado, busca por nome) e busca individual por ID.
 * Faz JOIN com plataformas, tipos de item e estados de conservação para retornar
 * dados completos sem que a camada superior precise fazer múltiplas queries.
 */

import type Database from "better-sqlite3";

/** Rotulo exibido quando o item serve varias plataformas, sem criar plataforma na biblioteca. */
const MULTIPLATFORM_LABEL = "Multiplataforma";

/** Criterios permitidos para ordenar o inventario fisico. */
type HardwareInventorySortBy = "name" | "type" | "recent";

/** Filtros opcionais para listagem de itens de hardware. */
export interface HardwareItemFilters {
  platformId?: number | null;
  itemTypeId?: number | null;
  conservationStateId?: number | null;
  search?: string | null;
  /** Ordenacao aplicada diretamente no SQLite para preservar a paginacao correta. */
  sortBy?: HardwareInventorySortBy;
  page?: number;
  pageSize?: number;
}

/** Item de hardware conforme retornado nas queries com JOIN. */
export interface HardwareItem {
  id: number;
  name: string;
  platform_id: number | null;
  /** 1 = item serve varias plataformas; 0 = usa plataforma real da biblioteca. */
  is_multiplatform: number;
  platform_name: string | null;
  item_type_id: number | null;
  item_type_name: string | null;
  conservation_state_id: number | null;
  conservation_state_name: string | null;
  description: string;
  acquisition_date: string | null;
  acquisition_url: string | null;
  color: string | null;
  value: number | null;
  serial_number: string | null;
  region: string | null;
  storage_location: string | null;
  loan_to: string | null;
  created_at: string;
  updated_at: string;
  /** Caminho da foto de capa (menor sort_order), ou null se sem fotos. */
  cover_photo_path: string | null;
}

/** Campos aceitos para criação de um item de hardware. */
export interface HardwareItemCreateInput {
  name: string;
  platform_id?: number | null;
  /** Mantem "Multiplataforma" restrito ao inventario, sem criar entrada em `platforms`. */
  is_multiplatform?: boolean | number | null;
  item_type_id?: number | null;
  conservation_state_id?: number | null;
  description: string;
  acquisition_date?: string | null;
  acquisition_url?: string | null;
  color?: string | null;
  value?: number | null;
  serial_number?: string | null;
  region?: string | null;
  storage_location?: string | null;
  loan_to?: string | null;
}

/** Campos aceitos para atualização de um item de hardware (todos opcionais). */
export type HardwareItemUpdateInput = Partial<HardwareItemCreateInput>;

/** Resultado paginado da listagem de itens de hardware. */
export interface HardwareItemListResult {
  items: HardwareItem[];
  total: number;
  filtered: number;
}

/** Query base com JOINs para retornar todos os campos de um item. */
function baseSelect(): string {
  return `
    SELECT
      hi.id,
      hi.name,
      hi.platform_id,
      hi.is_multiplatform,
      CASE
        WHEN hi.is_multiplatform = 1 THEN '${MULTIPLATFORM_LABEL}'
        ELSE p.name
      END AS platform_name,
      hi.item_type_id,
      it.name AS item_type_name,
      hi.conservation_state_id,
      cs.name AS conservation_state_name,
      hi.description,
      hi.acquisition_date,
      hi.acquisition_url,
      hi.color,
      hi.value,
      hi.serial_number,
      hi.region,
      hi.storage_location,
      hi.loan_to,
      hi.created_at,
      hi.updated_at,
      (SELECT file_path FROM hardware_item_photos
       WHERE item_id = hi.id ORDER BY sort_order ASC, id ASC LIMIT 1) AS cover_photo_path
    FROM hardware_items hi
    LEFT JOIN platforms            p  ON p.id  = hi.platform_id
    LEFT JOIN item_types           it ON it.id = hi.item_type_id
    LEFT JOIN conservation_states  cs ON cs.id = hi.conservation_state_id
  `;
}

/** Normaliza a plataforma do item para que "Multiplataforma" exista apenas no inventario. */
function normalizePlatformAssignment(data: Pick<HardwareItemCreateInput, "platform_id" | "is_multiplatform">): { platformId: number | null; isMultiplatform: 0 | 1 } {
  const isMultiplatform = data.is_multiplatform === true || data.is_multiplatform === 1;
  return {
    platformId: isMultiplatform ? null : data.platform_id ?? null,
    isMultiplatform: isMultiplatform ? 1 : 0
  };
}

/** Constroi clausula WHERE e array de parametros com base nos filtros fornecidos. */
function buildWhere(filters: HardwareItemFilters): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.platformId != null) {
    clauses.push("hi.is_multiplatform = 0");
    clauses.push("hi.platform_id = ?");
    params.push(filters.platformId);
  }
  if (filters.itemTypeId != null) {
    clauses.push("hi.item_type_id = ?");
    params.push(filters.itemTypeId);
  }
  if (filters.conservationStateId != null) {
    clauses.push("hi.conservation_state_id = ?");
    params.push(filters.conservationStateId);
  }
  if (filters.search?.trim()) {
    clauses.push("hi.name LIKE ? COLLATE NOCASE");
    params.push(`%${filters.search.trim()}%`);
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params
  };
}

/**
 * Constroi a ordenacao dos itens de hardware.
 * Mantem `name` como fallback estavel para evitar saltos entre paginas.
 */
function buildOrder(sortBy: HardwareInventorySortBy = "name"): string {
  switch (sortBy) {
    case "type":
      return "ORDER BY it.name IS NULL, it.name COLLATE NOCASE, hi.name COLLATE NOCASE";
    case "recent":
      return "ORDER BY hi.created_at DESC, hi.id DESC";
    case "name":
      return "ORDER BY hi.name COLLATE NOCASE";
  }
}

export class HardwareItemDao {
  constructor(private readonly database: Database.Database) {}

  /**
   * Lista itens com paginação e filtros combinados.
   * Retorna `total` (sem filtros), `filtered` (com filtros) e a página de `items`.
   */
  list(filters: HardwareItemFilters = {}): HardwareItemListResult {
    const where = buildWhere(filters);
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = filters.pageSize ?? 50;
    const offset = (page - 1) * pageSize;

    const total = (
      this.database.prepare("SELECT COUNT(*) AS count FROM hardware_items").get() as { count: number }
    ).count;

    const filtered = (
      this.database
        .prepare(`SELECT COUNT(*) AS count FROM hardware_items hi ${where.sql}`)
        .get(...where.params) as { count: number }
    ).count;

    const items = this.database
      .prepare(`${baseSelect()} ${where.sql} ${buildOrder(filters.sortBy)} LIMIT ? OFFSET ?`)
      .all(...where.params, pageSize, offset) as HardwareItem[];

    return { items, total, filtered };
  }

  /**
   * Busca um item pelo ID.
   * Retorna `null` se não encontrado.
   */
  get(id: number): HardwareItem | null {
    const row = this.database
      .prepare(`${baseSelect()} WHERE hi.id = ?`)
      .get(id) as HardwareItem | undefined;
    return row ?? null;
  }

  /**
   * Cria um novo item de hardware e retorna o registro completo.
   */
  create(data: HardwareItemCreateInput): HardwareItem {
    const platform = normalizePlatformAssignment(data);
    const result = this.database.prepare(`
      INSERT INTO hardware_items
        (name, platform_id, is_multiplatform, item_type_id, conservation_state_id, description,
         acquisition_date, acquisition_url, color, value, serial_number,
         region, storage_location, loan_to)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.name,
      platform.platformId,
      platform.isMultiplatform,
      data.item_type_id ?? null,
      data.conservation_state_id ?? null,
      data.description,
      data.acquisition_date ?? null,
      data.acquisition_url ?? null,
      data.color ?? null,
      data.value ?? null,
      data.serial_number ?? null,
      data.region ?? null,
      data.storage_location ?? null,
      data.loan_to ?? null
    );
    return this.get(result.lastInsertRowid as number)!;
  }

  /**
   * Atualiza campos de um item existente.
   * Apenas os campos presentes em `data` são alterados.
   */
  update(id: number, data: HardwareItemUpdateInput): HardwareItem {
    const fields: string[] = [];
    const params: unknown[] = [];

    const addField = (col: string, value: unknown) => {
      fields.push(`${col} = ?`);
      params.push(value);
    };

    if ("name" in data)                  addField("name",                  data.name);
    if ("platform_id" in data || "is_multiplatform" in data) {
      // Atualiza plataforma e flag juntas para manter o marcador restrito ao inventario.
      const platform = normalizePlatformAssignment(data);
      addField("platform_id", platform.platformId);
      addField("is_multiplatform", platform.isMultiplatform);
    }
    if ("item_type_id" in data)          addField("item_type_id",          data.item_type_id ?? null);
    if ("conservation_state_id" in data) addField("conservation_state_id", data.conservation_state_id ?? null);
    if ("description" in data)           addField("description",           data.description);
    if ("acquisition_date" in data)      addField("acquisition_date",      data.acquisition_date ?? null);
    if ("acquisition_url" in data)       addField("acquisition_url",       data.acquisition_url ?? null);
    if ("color" in data)                 addField("color",                 data.color ?? null);
    if ("value" in data)                 addField("value",                 data.value ?? null);
    if ("serial_number" in data)         addField("serial_number",         data.serial_number ?? null);
    if ("region" in data)                addField("region",                data.region ?? null);
    if ("storage_location" in data)      addField("storage_location",      data.storage_location ?? null);
    if ("loan_to" in data)               addField("loan_to",               data.loan_to ?? null);

    if (fields.length === 0) return this.get(id)!;

    fields.push("updated_at = datetime('now')");
    params.push(id);

    this.database
      .prepare(`UPDATE hardware_items SET ${fields.join(", ")} WHERE id = ?`)
      .run(...params);

    return this.get(id)!;
  }

  /**
   * Remove um item pelo ID.
   * A exclusão em cascata das fotos fica a cargo do handler IPC,
   * que também remove os arquivos do disco.
   */
  delete(id: number): void {
    this.database.prepare("DELETE FROM hardware_items WHERE id = ?").run(id);
  }

  /**
   * Lista plataformas que possuem ao menos um item de hardware cadastrado.
   * Usado para construir os filtros da sidebar no modo inventário.
   */
  listPlatformsWithItems(): Array<{ id: number; name: string; count: number }> {
    return this.database.prepare(`
      SELECT p.id, p.name, COUNT(*) AS count
      FROM hardware_items hi
      JOIN platforms p ON p.id = hi.platform_id
      GROUP BY p.id, p.name
      ORDER BY p.name COLLATE NOCASE
    `).all() as Array<{ id: number; name: string; count: number }>;
  }
}
