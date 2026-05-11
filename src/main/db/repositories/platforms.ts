import { getDatabase } from "../database";
import { PlatformDao, PlatformInput } from "../dao/platformDao";
import { Platform, PlatformMappings, PlatformMappingsInput, PlatformRomExtension } from "../../../shared/types";

export type { PlatformInput };

function platformDao(): PlatformDao {
  return new PlatformDao(getDatabase());
}

function normalizePlatformName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

export function getLaunchBoxAliasesForPlatformId(platformId: number): string[] {
  const aliases = platformDao().listLaunchBoxAliases(platformId).map((entry) => entry.alias);
  const platform = listPlatforms().find((entry) => entry.id === platformId);
  if (platform && !aliases.some((alias) => normalizePlatformName(alias) === normalizePlatformName(platform.name))) {
    aliases.unshift(platform.name);
  }
  return aliases;
}

export function getLaunchBoxAliasesForPlatformName(name: string): string[] {
  const platform = listPlatforms().find((entry) => normalizePlatformName(entry.name) === normalizePlatformName(name));
  return platform ? getLaunchBoxAliasesForPlatformId(platform.id) : [name];
}

export function resolvePlatformByLaunchBoxName(launchBoxPlatform: string): Platform | null {
  const normalizedLaunchBox = normalizePlatformName(launchBoxPlatform);
  const aliases = platformDao().listLaunchBoxAliases();
  const sorted = aliases.sort((a, b) => b.alias.length - a.alias.length);

  for (const entry of sorted) {
    const normalizedAlias = normalizePlatformName(entry.alias);
    if (!normalizedAlias) continue;
    if (normalizedLaunchBox === normalizedAlias) {
      return listPlatforms().find((platform) => platform.id === entry.platform_id) ?? null;
    }
    if (normalizedAlias.length > 4 && normalizedLaunchBox.includes(normalizedAlias)) {
      return listPlatforms().find((platform) => platform.id === entry.platform_id) ?? null;
    }
  }

  return listPlatforms().find((entry) => normalizePlatformName(entry.name) === normalizedLaunchBox) ?? null;
}

export function getPrimaryRomExtensionsForPlatform(platformId: number): string[] {
  return platformDao()
    .listRomExtensions(platformId, true)
    .map((entry) => entry.extension.toLowerCase());
}

export function listPrimaryRomExtensionMappings(): PlatformRomExtension[] {
  return platformDao().listRomExtensions(undefined, true);
}

export function listSupportedRomExtensions(): string[] {
  return Array.from(
    new Set(
      platformDao()
        .listRomExtensions(undefined, true)
        .map((entry) => entry.extension.toLowerCase())
    )
  ).sort((a, b) => a.localeCompare(b));
}

export function getPlatformMappings(platformId: number): PlatformMappings {
  return {
    aliases: platformDao().listLaunchBoxAliases(platformId),
    romExtensions: platformDao().listRomExtensions(platformId)
  };
}

export function savePlatformMappings(platformId: number, input: PlatformMappingsInput): PlatformMappings {
  platformDao().saveMappings(platformId, input);
  return getPlatformMappings(platformId);
}
