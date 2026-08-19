/**
 * DAO de vínculos plataforma ↔ emulador.
 *
 * Gerencia a tabela de associação `platform_emulators`, que define quais emuladores
 * estão disponíveis para cada plataforma e qual deles é o emulador padrão.
 * Inclui o caminho do core RetroArch quando aplicável.
 */

import type Database from "better-sqlite3";
import { Emulator, PlatformEmulator, PlatformEmulatorLinkInput } from "../../../shared/types";

/**
 * Linha bruta retornada pelo JOIN entre `platform_emulators` e `emulators`.
 * Os campos do emulador são prefixados com `em_` para evitar colisão de nomes.
 */
interface PlatformEmulatorRow {
  platform_id: number;
  emulator_id: number;
  is_default: number;        // 1 = emulador padrão para a plataforma
  core_path: string | null;  // Caminho do core RetroArch (nulo para emuladores standalone)
  em_id: number;
  em_name: string;
  em_executable: string;
  em_args: string;
  em_is_retroarch: number;
  em_created_at: string;
}

/**
 * Converte uma linha bruta do JOIN para o tipo `PlatformEmulator`,
 * reconstruindo o objeto `emulator` embutido a partir dos campos prefixados `em_`.
 */
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

  /**
   * Lista todos os emuladores vinculados a uma plataforma específica.
   * Ordena o emulador padrão primeiro, depois por nome (case-insensitive).
   */
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

  /**
   * Lista vínculos para várias plataformas em uma única query.
   * Retorna também plataformas sem vínculo para simplificar consumo no renderer.
   */
  listByPlatforms(platformIds: number[]): Record<number, PlatformEmulator[]> {
    const uniqueIds = [...new Set(platformIds.filter((id) => Number.isInteger(id) && id > 0))];
    const grouped = Object.fromEntries(uniqueIds.map((id) => [id, []])) as Record<number, PlatformEmulator[]>;
    if (!uniqueIds.length) return grouped;

    const placeholders = uniqueIds.map(() => "?").join(", ");
    const rows = this.database
      .prepare(`
        SELECT pe.*, e.id as em_id, e.name as em_name, e.executable as em_executable,
               e.args as em_args, e.is_retroarch as em_is_retroarch, e.created_at as em_created_at
        FROM platform_emulators pe
        JOIN emulators e ON e.id = pe.emulator_id
        WHERE pe.platform_id IN (${placeholders})
        ORDER BY pe.platform_id, pe.is_default DESC, e.name COLLATE NOCASE
      `)
      .all(...uniqueIds) as PlatformEmulatorRow[];

    for (const row of rows) grouped[row.platform_id].push(rowToRecord(row));
    return grouped;
  }

  /**
   * Retorna o emulador padrão de uma plataforma.
   * Retorna `undefined` se nenhum emulador padrão estiver configurado.
   */
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

  /**
   * Vincula um emulador a uma plataforma (ou atualiza o vínculo existente).
   * Usa upsert para garantir idempotência: se o par (platform_id, emulator_id)
   * já existir, atualiza `is_default` e `core_path`.
   *
   * @param emulatorId  ID do emulador a vincular.
   * @param platformId  ID da plataforma de destino.
   * @param isDefault   Se `true`, define este emulador como padrão da plataforma.
   * @param corePath    Caminho do core RetroArch (necessário apenas para RetroArch).
   *
   * Retorna o registro de vínculo atualizado com os dados do emulador embutidos.
   */
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
    // Relê o registro após o upsert para retornar o estado atual com dados do emulador
    const linked = this.listByPlatform(platformId).find((pe) => pe.emulator_id === emulatorId);
    return linked!;
  }

  /**
   * Remove o vínculo entre um emulador e uma plataforma.
   * Silencioso caso o vínculo não exista.
   */
  unlink(emulatorId: number, platformId: number): { success: true } {
    this.database
      .prepare("DELETE FROM platform_emulators WHERE emulator_id = ? AND platform_id = ?")
      .run(emulatorId, platformId);
    return { success: true };
  }

  /**
   * Aplica vários upserts de vínculos em uma única transação SQLite.
   * Qualquer chave estrangeira inválida ou falha no trigger desfaz lote inteiro.
   */
  linkMany(changes: PlatformEmulatorLinkInput[]): { success: true } {
    const upsert = this.database.prepare(`
      INSERT INTO platform_emulators (platform_id, emulator_id, is_default, core_path)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(platform_id, emulator_id) DO UPDATE SET
        is_default = excluded.is_default,
        core_path = excluded.core_path
    `);
    const apply = this.database.transaction((items: PlatformEmulatorLinkInput[]) => {
      for (const item of items) {
        if (!Number.isInteger(item.platformId) || item.platformId <= 0 || !Number.isInteger(item.emulatorId) || item.emulatorId <= 0) {
          throw new Error("Vínculo de emulador inválido");
        }
        upsert.run(item.platformId, item.emulatorId, item.isDefault ? 1 : 0, item.corePath?.trim() || null);
      }
    });
    apply(changes);
    return { success: true };
  }
}
