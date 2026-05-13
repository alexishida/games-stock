/**
 * DAO para tipos de item do inventário de hardware.
 *
 * Gerencia operações na tabela `item_types`: listagem, criação e exclusão.
 * Tipos padrão têm `is_default = 1` (inseridos via seed); tipos do usuário têm `is_default = 0`.
 */

import type Database from "better-sqlite3";

/** Tipo de item de hardware conforme retornado pelo banco de dados. */
export interface HardwareItemType {
  id: number;
  name: string;
  /** 1 = tipo padrão do sistema; 0 = criado pelo usuário */
  is_default: number;
  created_at: string;
}

export class HardwareItemTypeDao {
  constructor(private readonly database: Database.Database) {}

  /** Lista todos os tipos de item, ordenados por nome. */
  list(): HardwareItemType[] {
    return this.database
      .prepare("SELECT id, name, is_default, created_at FROM item_types ORDER BY name COLLATE NOCASE")
      .all() as HardwareItemType[];
  }

  /** Lista tipos com contagem de itens associados (inclui tipos com 0 itens). */
  listWithCounts(): Array<{ id: number; name: string; count: number }> {
    return this.database.prepare(`
      SELECT it.id, it.name, COUNT(hi.id) AS count
      FROM item_types it
      LEFT JOIN hardware_items hi ON hi.item_type_id = it.id
      GROUP BY it.id, it.name
      ORDER BY it.name COLLATE NOCASE
    `).all() as Array<{ id: number; name: string; count: number }>;
  }

  /**
   * Cria um novo tipo de item com `is_default = 0` (criado pelo usuário).
   * Retorna o tipo recém-criado, ou lança erro se o nome já existir.
   */
  create(name: string): HardwareItemType {
    const result = this.database
      .prepare("INSERT INTO item_types (name, is_default) VALUES (?, 0)")
      .run(name.trim());
    return this.database
      .prepare("SELECT id, name, is_default, created_at FROM item_types WHERE id = ?")
      .get(result.lastInsertRowid) as HardwareItemType;
  }

  /**
   * Remove um tipo de item pelo ID.
   * Tipos padrão não devem ser removidos via UI, mas a validação fica na camada de handler.
   */
  delete(id: number): void {
    this.database.prepare("DELETE FROM item_types WHERE id = ?").run(id);
  }
}
