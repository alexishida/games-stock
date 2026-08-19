/**
 * Repositório de emuladores e associações plataforma-emulador.
 *
 * Fachada fina sobre EmulatorDao e PlatformEmulatorDao. Expõe operações CRUD para emuladores
 * e operações de vínculo entre plataformas e emuladores (tabela `platform_emulators`).
 *
 * Código fora de `src/main/db` deve acessar emuladores exclusivamente por meio deste repositório.
 */

import { getDatabase } from "../database";
import { EmulatorDao, EmulatorInput } from "../dao/emulatorDao";
import { PlatformEmulatorDao } from "../dao/platformEmulatorDao";
import { Emulator, PlatformEmulator, PlatformEmulatorLinkInput } from "../../../shared/types";

// Re-exporta EmulatorInput para que consumidores externos não precisem importar do DAO diretamente.
export type { EmulatorInput };

/**
 * Cria uma instância do EmulatorDao conectada ao banco de dados ativo.
 */
function emulatorDao(): EmulatorDao {
  return new EmulatorDao(getDatabase());
}

/**
 * Cria uma instância do PlatformEmulatorDao conectada ao banco de dados ativo.
 */
function platformEmulatorDao(): PlatformEmulatorDao {
  return new PlatformEmulatorDao(getDatabase());
}

/**
 * Retorna a lista de todos os emuladores cadastrados.
 */
export function listEmulators(): Emulator[] {
  return emulatorDao().list();
}

/**
 * Cria um novo emulador no banco de dados.
 *
 * @param data - Dados do emulador a ser criado (nome, executável, args, flags).
 * @returns O emulador criado com o `id` gerado pelo banco.
 */
export function createEmulator(data: EmulatorInput): Emulator {
  return emulatorDao().create(data);
}

/**
 * Atualiza os dados de um emulador existente.
 *
 * @param id - ID do emulador a ser atualizado.
 * @param data - Campos a serem atualizados (parcial).
 * @returns O emulador com os dados atualizados.
 */
export function updateEmulator(id: number, data: Partial<EmulatorInput>): Emulator {
  return emulatorDao().update(id, data);
}

/**
 * Remove um emulador do banco de dados.
 * Vínculos com plataformas são removidos automaticamente via CASCADE.
 *
 * @param id - ID do emulador a ser removido.
 */
export function deleteEmulator(id: number): { success: true } {
  return emulatorDao().delete(id);
}

/**
 * Lista todos os emuladores vinculados a uma plataforma específica.
 *
 * @param platformId - ID da plataforma.
 * @returns Lista de PlatformEmulator com dados do vínculo (is_default, core_path).
 */
export function listEmulatorsByPlatform(platformId: number): PlatformEmulator[] {
  return platformEmulatorDao().listByPlatform(platformId);
}

/** Lista vínculos de várias plataformas em uma única consulta SQLite. */
export function listEmulatorsByPlatforms(platformIds: number[]): Record<number, PlatformEmulator[]> {
  return platformEmulatorDao().listByPlatforms(platformIds);
}

/**
 * Retorna o emulador marcado como padrão para uma plataforma.
 *
 * @param platformId - ID da plataforma.
 * @returns O PlatformEmulator padrão, ou `undefined` se nenhum estiver configurado.
 */
export function getDefaultEmulator(platformId: number): PlatformEmulator | undefined {
  return platformEmulatorDao().getDefault(platformId);
}

/**
 * Vincula um emulador a uma plataforma, com suporte a core path (RetroArch).
 * Se `isDefault` for `true`, o trigger do banco garante que os demais vínculos da
 * plataforma tenham `is_default = 0` automaticamente.
 *
 * @param emulatorId - ID do emulador a vincular.
 * @param platformId - ID da plataforma destino.
 * @param isDefault  - Se este emulador deve ser o padrão para a plataforma.
 * @param corePath   - Caminho do core RetroArch (apenas para emuladores RetroArch).
 * @returns O registro de vínculo criado ou atualizado.
 */
export function linkEmulatorToPlatform(
  emulatorId: number,
  platformId: number,
  isDefault: boolean,
  corePath?: string | null
): PlatformEmulator {
  return platformEmulatorDao().link(emulatorId, platformId, isDefault, corePath);
}

/**
 * Remove o vínculo entre um emulador e uma plataforma.
 *
 * @param emulatorId - ID do emulador.
 * @param platformId - ID da plataforma.
 */
export function unlinkEmulatorFromPlatform(emulatorId: number, platformId: number): { success: true } {
  return platformEmulatorDao().unlink(emulatorId, platformId);
}

/** Salva vários vínculos de emulador atomicamente. */
export function linkEmulatorsToPlatforms(changes: PlatformEmulatorLinkInput[]): { success: true } {
  return platformEmulatorDao().linkMany(changes);
}
