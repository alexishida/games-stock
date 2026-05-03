import { getDatabase } from "../database";
import { EmulatorDao, EmulatorInput } from "../dao/emulatorDao";
import { PlatformEmulatorDao } from "../dao/platformEmulatorDao";
import { Emulator, PlatformEmulator } from "../../../shared/types";

export type { EmulatorInput };

function emulatorDao(): EmulatorDao {
  return new EmulatorDao(getDatabase());
}

function platformEmulatorDao(): PlatformEmulatorDao {
  return new PlatformEmulatorDao(getDatabase());
}

export function listEmulators(): Emulator[] {
  return emulatorDao().list();
}

export function createEmulator(data: EmulatorInput): Emulator {
  return emulatorDao().create(data);
}

export function updateEmulator(id: number, data: Partial<EmulatorInput>): Emulator {
  return emulatorDao().update(id, data);
}

export function deleteEmulator(id: number): { success: true } {
  return emulatorDao().delete(id);
}

export function listEmulatorsByPlatform(platformId: number): PlatformEmulator[] {
  return platformEmulatorDao().listByPlatform(platformId);
}

export function getDefaultEmulator(platformId: number): PlatformEmulator | undefined {
  return platformEmulatorDao().getDefault(platformId);
}

export function linkEmulatorToPlatform(
  emulatorId: number,
  platformId: number,
  isDefault: boolean,
  corePath?: string | null
): PlatformEmulator {
  return platformEmulatorDao().link(emulatorId, platformId, isDefault, corePath);
}

export function unlinkEmulatorFromPlatform(emulatorId: number, platformId: number): { success: true } {
  return platformEmulatorDao().unlink(emulatorId, platformId);
}
