import { getDatabase } from "../database";
import { PlatformDao, PlatformInput } from "../dao/platformDao";
import { Platform } from "../../../shared/types";

export type { PlatformInput };

function platformDao(): PlatformDao {
  return new PlatformDao(getDatabase());
}

export function listPlatforms(): Platform[] {
  return platformDao().list();
}

export function createPlatform(data: PlatformInput): Platform {
  return platformDao().create(data);
}

export function updatePlatform(id: number, data: Partial<PlatformInput>): Platform {
  return platformDao().update(id, data);
}

export function deletePlatform(id: number): { success: true } {
  return platformDao().delete(id);
}

export function findOrCreatePlatform(name: string, category = "Importadas"): Platform {
  return platformDao().findOrCreate(name, category);
}
