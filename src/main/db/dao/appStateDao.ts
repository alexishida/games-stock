import type Database from "better-sqlite3";

interface AppStateRow {
  key: string;
  value_json: string;
}

export class AppStateDao {
  constructor(private readonly database: Database.Database) {}

  get(key: string): unknown | null {
    const row = this.database
      .prepare("SELECT key, value_json FROM app_state WHERE key = ?")
      .get(key) as AppStateRow | undefined;
    if (!row) return null;
    return JSON.parse(row.value_json);
  }

  getMany(keys: string[]): Record<string, unknown> {
    const normalized = Array.from(new Set(keys.map((key) => key.trim()).filter(Boolean)));
    if (!normalized.length) return {};

    const placeholders = normalized.map(() => "?").join(", ");
    const rows = this.database
      .prepare(`SELECT key, value_json FROM app_state WHERE key IN (${placeholders})`)
      .all(...normalized) as AppStateRow[];

    return rows.reduce<Record<string, unknown>>((acc, row) => {
      acc[row.key] = JSON.parse(row.value_json);
      return acc;
    }, {});
  }

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

  setMany(entries: Array<{ key: string; value: unknown }>, onlyIfMissing = false): void {
    if (!entries.length) return;

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

    this.database.transaction((items: Array<{ key: string; value: unknown }>) => {
      for (const entry of items) {
        const key = entry.key.trim();
        if (!key) continue;
        upsert.run(key, JSON.stringify(entry.value));
      }
    })(entries);
  }

  remove(key: string): void {
    this.database.prepare("DELETE FROM app_state WHERE key = ?").run(key);
  }
}
