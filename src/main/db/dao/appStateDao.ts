/**
 * DAO de estado da aplicação.
 *
 * Persiste pares chave/valor arbitrários no SQLite via tabela `app_state`.
 * Usado para salvar preferências, flags e estados de UI que precisam sobreviver
 * a reinicializações da aplicação. Os valores são serializados como JSON.
 */

import type Database from "better-sqlite3";

/** Linha bruta retornada pela tabela `app_state`. */
interface AppStateRow {
  key: string;
  value_json: string; // Valor serializado em JSON
}

export class AppStateDao {
  constructor(private readonly database: Database.Database) {}

  /**
   * Lê um valor pelo nome da chave.
   * Retorna `null` se a chave não existir.
   */
  get(key: string): unknown | null {
    const row = this.database
      .prepare("SELECT key, value_json FROM app_state WHERE key = ?")
      .get(key) as AppStateRow | undefined;
    if (!row) return null;
    // Desserializa o JSON armazenado na coluna value_json
    return JSON.parse(row.value_json);
  }

  /**
   * Lê múltiplos valores de uma só vez.
   * Remove duplicatas e chaves vazias antes de consultar o banco.
   * Retorna um mapa chave → valor para as chaves encontradas.
   */
  getMany(keys: string[]): Record<string, unknown> {
    // Deduplica e sanitiza as chaves recebidas
    const normalized = Array.from(new Set(keys.map((key) => key.trim()).filter(Boolean)));
    if (!normalized.length) return {};

    // Monta placeholders dinâmicos para o IN (?, ?, ...)
    const placeholders = normalized.map(() => "?").join(", ");
    const rows = this.database
      .prepare(`SELECT key, value_json FROM app_state WHERE key IN (${placeholders})`)
      .all(...normalized) as AppStateRow[];

    // Reduz as linhas para um mapa chave → valor desserializado
    return rows.reduce<Record<string, unknown>>((acc, row) => {
      acc[row.key] = JSON.parse(row.value_json);
      return acc;
    }, {});
  }

  /**
   * Grava ou atualiza um valor para a chave informada.
   * Usa upsert (INSERT … ON CONFLICT DO UPDATE) para garantir idempotência.
   */
  set(key: string, value: unknown): void {
    this.database
      .prepare(`
        INSERT INTO app_state (key, value_json, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value_json = excluded.value_json,
          updated_at = CURRENT_TIMESTAMP
      `)
      .run(key, JSON.stringify(value));
  }

  /**
   * Grava múltiplos pares chave/valor em uma única transação SQLite.
   *
   * @param entries  Lista de entradas `{ key, value }` a persistir.
   * @param onlyIfMissing  Quando `true`, ignora chaves que já existem no banco
   *                       (INSERT OR IGNORE). Quando `false` (padrão), faz upsert.
   */
  setMany(entries: Array<{ key: string; value: unknown }>, onlyIfMissing = false): void {
    if (!entries.length) return;

    // Seleciona o statement adequado conforme a política de conflito
    const upsert = onlyIfMissing
      ? this.database.prepare(`
        INSERT INTO app_state (key, value_json, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO NOTHING
      `)
      : this.database.prepare(`
        INSERT INTO app_state (key, value_json, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value_json = excluded.value_json,
          updated_at = CURRENT_TIMESTAMP
      `);

    // Executa todas as gravações dentro de uma transação para atomicidade e performance
    this.database.transaction((items: Array<{ key: string; value: unknown }>) => {
      for (const entry of items) {
        const key = entry.key.trim();
        if (!key) continue; // Ignora chaves vazias
        upsert.run(key, JSON.stringify(entry.value));
      }
    })(entries);
  }

  /**
   * Remove uma chave do estado persistido.
   * Silencioso caso a chave não exista.
   */
  remove(key: string): void {
    this.database.prepare("DELETE FROM app_state WHERE key = ?").run(key);
  }
}
