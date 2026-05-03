import type Database from "better-sqlite3";
import { Emulator, PlatformEmulator } from "../../../shared/types";

interface PlatformEmulatorRow {
  platform_id: number;
  emulator_id: number;
  is_default: number;
  core_path: string | null;
  em_id: number;
  em_name: string;
  em_executable: string;
  em_args: string;
  em_is_retroarch: number;
  em_created_at: string;
}

function rowToRecord(row: PlatformEmulatorRow): PlatformEmulator {
  return {
    platform_id: row.platform_id,
    emulator_id: row.emulator_id,
    is_default: row.is_default,
    core_path: row.core_path,
    emulator: {
      id: row.em_id,
      name: row.em_name,
      executable: row.em_executable,
      args: row.em_args,
      is_retroarch: row.em_is_retroarch,
      created_at: row.em_created_at
    } as Emulator
  };
}

export class PlatformEmulatorDao {
  constructor(private readonly database: Database.Database) {}

  listByPlatform(platformId: number): PlatformEmulator[] {
    const rows = this.database
      .prepare(`
        SELECT pe.*, e.id as em_id, e.name as em_name, e.executable as em_executable,
               e.args as em_args, e.is_retroarch as em_is_retroarch, e.created_at as em_created_at
        FROM platform_emulators pe
        JOIN emulators e ON e.id = pe.emulator_id
        WHERE pe.platform_id = ?
        ORDER BY pe.is_default DESC, e.name COLLATE NOCASE
      `)
      .all(platformId) as PlatformEmulatorRow[];
    return rows.map(rowToRecord);
  }

  getDefault(platformId: number): PlatformEmulator | undefined {
    const row = this.database
      .prepare(`
        SELECT pe.*, e.id as em_id, e.name as em_name, e.executable as em_executable,
               e.args as em_args, e.is_retroarch as em_is_retroarch, e.created_at as em_created_at
        FROM platform_emulators pe
        JOIN emulators e ON e.id = pe.emulator_id
        WHERE pe.platform_id = ? AND pe.is_default = 1
      `)
      .get(platformId) as PlatformEmulatorRow | undefined;
    return row ? rowToRecord(row) : undefined;
  }

  link(emulatorId: number, platformId: number, isDefault: boolean, corePath?: string | null): PlatformEmulator {
    this.database
      .prepare(`
        INSERT INTO platform_emulators (platform_id, emulator_id, is_default, core_path)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(platform_id, emulator_id) DO UPDATE SET
          is_default = excluded.is_default,
          core_path = excluded.core_path
      `)
      .run(platformId, emulatorId, isDefault ? 1 : 0, corePath ?? null);
    const linked = this.listByPlatform(platformId).find((pe) => pe.emulator_id === emulatorId);
    return linked!;
  }

  unlink(emulatorId: number, platformId: number): { success: true } {
    this.database
      .prepare("DELETE FROM platform_emulators WHERE emulator_id = ? AND platform_id = ?")
      .run(emulatorId, platformId);
    return { success: true };
  }
}
