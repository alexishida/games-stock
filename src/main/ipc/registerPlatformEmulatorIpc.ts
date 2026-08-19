/**
 * Registradores IPC dos domínios de plataformas e emuladores.
 *
 * Mantém `index.ts` dedicado ao ciclo de vida da aplicação e deixa cada grupo
 * de handlers próximo de suas dependências de repositório.
 */

import type { IpcMain } from "electron";
import { IPC_CHANNELS } from "../../shared/ipc-channels";
import type { PlatformEmulatorLinkInput } from "../../shared/types";
import type * as emulators from "../db/repositories/emulators";
import type * as platforms from "../db/repositories/platforms";

/** Dependências explícitas dos handlers de plataformas. */
interface PlatformIpcDependencies {
  platforms: typeof platforms;
}

/** Dependências explícitas dos handlers de emuladores. */
interface EmulatorIpcDependencies {
  emulators: typeof emulators;
  listRetroArchCores(emulatorId: number): unknown;
}

/** Registra operações CRUD e mapeamentos de plataformas. */
export function registerPlatformIpc(ipcMain: IpcMain, { platforms }: PlatformIpcDependencies): void {
  ipcMain.handle(IPC_CHANNELS.platforms.list, () => platforms.listPlatforms());
  ipcMain.handle(IPC_CHANNELS.platforms.create, (_event, data: platforms.PlatformInput) => platforms.createPlatform(data));
  ipcMain.handle(IPC_CHANNELS.platforms.update, (_event, id: number, data: Partial<platforms.PlatformInput>) => platforms.updatePlatform(id, data));
  ipcMain.handle(IPC_CHANNELS.platforms.delete, (_event, id: number) => platforms.deletePlatform(id));
  ipcMain.handle(IPC_CHANNELS.platforms.getMappings, (_event, platformId: number) => platforms.getPlatformMappings(platformId));
  ipcMain.handle(IPC_CHANNELS.platforms.saveMappings, (_event, platformId: number, data) => platforms.savePlatformMappings(platformId, data));
}

/** Registra CRUD e vínculos plataforma-emulador. */
export function registerEmulatorIpc(ipcMain: IpcMain, { emulators, listRetroArchCores }: EmulatorIpcDependencies): void {
  ipcMain.handle(IPC_CHANNELS.emulators.list, () => emulators.listEmulators());
  ipcMain.handle(IPC_CHANNELS.emulators.create, (_event, data: emulators.EmulatorInput) => emulators.createEmulator(data));
  ipcMain.handle(IPC_CHANNELS.emulators.update, (_event, id: number, data: Partial<emulators.EmulatorInput>) => emulators.updateEmulator(id, data));
  ipcMain.handle(IPC_CHANNELS.emulators.delete, (_event, id: number) => emulators.deleteEmulator(id));
  ipcMain.handle(IPC_CHANNELS.emulators.listByPlatform, (_event, platformId: number) => emulators.listEmulatorsByPlatform(platformId));
  ipcMain.handle(IPC_CHANNELS.emulators.listByPlatforms, (_event, platformIds: number[]) => emulators.listEmulatorsByPlatforms(platformIds));
  ipcMain.handle(IPC_CHANNELS.emulators.listRetroArchCores, (_event, emulatorId: number) => listRetroArchCores(emulatorId));
  ipcMain.handle(IPC_CHANNELS.emulators.linkPlatform, (_event, emulatorId: number, platformId: number, isDefault: boolean, corePath?: string | null) =>
    emulators.linkEmulatorToPlatform(emulatorId, platformId, isDefault, corePath)
  );
  ipcMain.handle(IPC_CHANNELS.emulators.unlinkPlatform, (_event, emulatorId: number, platformId: number) =>
    emulators.unlinkEmulatorFromPlatform(emulatorId, platformId)
  );
  ipcMain.handle(IPC_CHANNELS.emulators.savePlatformLinks, (_event, changes: PlatformEmulatorLinkInput[]) => emulators.linkEmulatorsToPlatforms(changes));
}
