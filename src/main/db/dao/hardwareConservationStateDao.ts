/**
 * DAO para estados de conservação do inventário de hardware.
 *
 * Gerencia operações na tabela `conservation_states`: listagem, criação e exclusão.
 * Estados padrão têm `is_default = 1`; estados customizados têm `is_default = 0`.
 */

import type Database from "better-sqlite3";

/** Estado de conservação de um item de hardware conforme retornado pelo banco. */
export interface ConservationState {
  id: number;
  name: string;
  /** 1 = estado padrão do sistema; 0 = criado pelo usuário */
  is_default: number;
  created_at: string;
}

export class HardwareConservationStateDao {
  constructor(private readonly database: Database.Database) {}

  /** Lista todos os estados de conservação, ordenados por nome. */
  list(): ConservationState[] {
    return this.database
      .prepare("SELECT id, name, is_default, created_at FROM conservation_states ORDER BY name COLLATE NOCASE")
      .all() as ConservationState[];
  }

  /** Lista estados com contagem de itens associados (inclui estados com 0 itens). */
  listWithCounts(): Array<{ id: number; name: string; count: number }> {
    return this.database.prepare(`
      SELECT cs.id, cs.name, COUNT(hi.id) AS count
      FROM conservation_states cs
      LEFT JOIN hardware_items hi ON hi.conservation_state_id = cs.id
      GROUP BY cs.id, cs.name
      ORDER BY cs.name COLLATE NOCASE
    `).all() as Array<{ id: number; name: string; count: number }>;
  }

  /**
   * Cria um novo estado de conservação com `is_default = 0`.
   * Retorna o estado recém-criado, ou lança erro se o nome já existir.
   */
  create(name: string): ConservationState {
    const result = this.database
      .prepare("INSERT INTO conservation_states (name, is_default) VALUES (?, 0)")
      .run(name.trim());
    return this.database
      .prepare("SELECT id, name, is_default, created_at FROM conservation_states WHERE id = ?")
      .get(result.lastInsertRowid) as ConservationState;
  }

  /** Remove um estado de conservação pelo ID. */
  delete(id: number): void {
    this.database.prepare("DELETE FROM conservation_states WHERE id = ?").run(id);
  }
}
