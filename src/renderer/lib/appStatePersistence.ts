import { APP_STATE_KEYS } from "../../shared/appState";
import { DataPortabilityJob, DataPortabilityRomFolderEntry, RomFolderImportJob } from "../../shared/types";
import type { MediaSyncJob } from "../store";

type FolderEntry = DataPortabilityRomFolderEntry & { totalCount?: number };
type ImportSource = { path: string; type: "folder" | "file" };

export async function getPersistedRomFolderEntries(): Promise<FolderEntry[]> {
  const value = await getPersistedValue<unknown>(APP_STATE_KEYS.romImport.folderEntries);
  return Array.isArray(value) ? value.filter(isFolderEntry) : [];
}

export function setPersistedRomFolderEntries(entries: FolderEntry[]): Promise<void> {
  return setPersistedValue(APP_STATE_KEYS.romImport.folderEntries, entries);
}

export async function mergePersistedRomFolderEntries(entries: DataPortabilityRomFolderEntry[]): Promise<void> {
  if (!entries.length) return;
  const current = await getPersistedRomFolderEntries();
  const merged = new Map<string, FolderEntry>();
  for (const entry of [...current, ...entries]) {
    if (!isFolderEntry(entry)) continue;
    merged.set(`${entry.platformId}:${entry.folderPath}`, entry);
  }
  await setPersistedRomFolderEntries(Array.from(merged.values()));
}

export async function getPersistedRomImportPlatformId(): Promise<number | ""> {
  const value = await getPersistedValue<unknown>(APP_STATE_KEYS.romImport.platformId);
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : "";
}

export async function setPersistedRomImportPlatformId(platformId: number | ""): Promise<void> {
  if (!platformId) {
    await removePersistedValue(APP_STATE_KEYS.romImport.platformId);
    return;
  }
  await setPersistedValue(APP_STATE_KEYS.romImport.platformId, platformId);
}

export async function getPersistedLastRomImportJob(): Promise<RomFolderImportJob | null> {
  const value = await getPersistedValue<unknown>(APP_STATE_KEYS.media.lastRomImportJob);
  if (!isRomImportJob(value)) return null;
  if (value.status === "running") {
    return { ...value, status: "interrupted", progress: { ...value.progress, message: "Interrompido" } };
  }
  return value;
}

export async function setPersistedLastRomImportJob(job: RomFolderImportJob | null): Promise<void> {
  if (!job) {
    await removePersistedValue(APP_STATE_KEYS.media.lastRomImportJob);
    return;
  }
  await setPersistedValue(APP_STATE_KEYS.media.lastRomImportJob, job);
}

export async function getPersistedMediaSyncJobs(): Promise<MediaSyncJob[]> {
  const value = await getPersistedValue<unknown>(APP_STATE_KEYS.media.lastMediaSyncJobs);
  if (Array.isArray(value)) {
    return value.filter(isMediaSyncJob).map((job) =>
      job.status === "running" ? { ...job, status: "interrupted", progressLabel: "Interrompido" } : job
    );
  }

  const legacy = await getPersistedValue<unknown>(APP_STATE_KEYS.media.lastMediaSyncJob);
  return isMediaSyncJob(legacy) ? [legacy] : [];
}

export async function setPersistedMediaSyncJobs(jobs: MediaSyncJob[]): Promise<void> {
  if (!jobs.length) {
    await removePersistedValue(APP_STATE_KEYS.media.lastMediaSyncJobs);
    return;
  }
  await setPersistedValue(APP_STATE_KEYS.media.lastMediaSyncJobs, jobs);
}

export async function getPersistedDataPortabilityJobs(): Promise<DataPortabilityJob[]> {
  const value = await getPersistedValue<unknown>(APP_STATE_KEYS.dataPortability.jobs);
  if (!Array.isArray(value)) return [];
  return value.filter(isDataPortabilityJob).map((job) =>
    job.status === "running" ? { ...job, status: "interrupted", progress: { ...job.progress, message: "Interrompido" } } : job
  );
}

export async function setPersistedDataPortabilityJobs(jobs: DataPortabilityJob[]): Promise<void> {
  const recent = jobs.slice(0, 5);
  if (!recent.length) {
    await removePersistedValue(APP_STATE_KEYS.dataPortability.jobs);
    return;
  }
  await setPersistedValue(APP_STATE_KEYS.dataPortability.jobs, recent);
}

export async function migrateLegacyLocalStorageToDb(): Promise<void> {
  if (typeof window === "undefined") return;

  const keys = [
    APP_STATE_KEYS.romImport.sources,
    APP_STATE_KEYS.romImport.platformId,
    APP_STATE_KEYS.romImport.folderEntries,
    APP_STATE_KEYS.media.lastRomImportJob,
    APP_STATE_KEYS.media.lastMediaSyncJob,
    APP_STATE_KEYS.media.lastMediaSyncJobs,
    APP_STATE_KEYS.dataPortability.jobs
  ];

  const existing = await window.gameStockAPI.appState.getMany(keys);
  const entries: Array<{ key: string; value: unknown }> = [];

  const legacyFolderEntries = readLegacyJson(APP_STATE_KEYS.romImport.folderEntries);
  if (!(APP_STATE_KEYS.romImport.folderEntries in existing)) {
    const migratedFolders = Array.isArray(legacyFolderEntries)
      ? legacyFolderEntries.filter(isFolderEntry)
      : buildFolderEntriesFromLegacySources(
        readLegacyJson(APP_STATE_KEYS.romImport.sources),
        readLegacyRaw(APP_STATE_KEYS.romImport.platformId)
      );
    if (migratedFolders.length) entries.push({ key: APP_STATE_KEYS.romImport.folderEntries, value: migratedFolders });
  }

  if (!(APP_STATE_KEYS.romImport.platformId in existing)) {
    const rawPlatformId = readLegacyRaw(APP_STATE_KEYS.romImport.platformId);
    const platformId = Number(rawPlatformId);
    if (Number.isFinite(platformId) && platformId > 0) {
      entries.push({ key: APP_STATE_KEYS.romImport.platformId, value: platformId });
    }
  }

  const directJsonKeys = [
    APP_STATE_KEYS.media.lastRomImportJob,
    APP_STATE_KEYS.media.lastMediaSyncJob,
    APP_STATE_KEYS.media.lastMediaSyncJobs,
    APP_STATE_KEYS.dataPortability.jobs
  ];

  for (const key of directJsonKeys) {
    if (key in existing) continue;
    const parsed = readLegacyJson(key);
    if (parsed !== null) entries.push({ key, value: parsed });
  }

  if (entries.length) {
    await window.gameStockAPI.appState.setMany(entries, true);
  }

  for (const key of keys) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore cleanup failures. DB already becomes source of truth.
    }
  }
}

async function getPersistedValue<T>(key: string): Promise<T | null> {
  if (typeof window === "undefined") return null;
  return window.gameStockAPI.appState.get<T>(key);
}

async function setPersistedValue(key: string, value: unknown): Promise<void> {
  if (typeof window === "undefined") return;
  await window.gameStockAPI.appState.set(key, value);
}

async function removePersistedValue(key: string): Promise<void> {
  if (typeof window === "undefined") return;
  await window.gameStockAPI.appState.remove(key);
}

function readLegacyRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readLegacyJson(key: string): unknown | null {
  const raw = readLegacyRaw(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildFolderEntriesFromLegacySources(rawSources: unknown, rawPlatformId: string | null): FolderEntry[] {
  const platformId = Number(rawPlatformId);
  if (!Number.isFinite(platformId) || platformId <= 0 || !Array.isArray(rawSources)) return [];
  return rawSources
    .filter((item): item is ImportSource => Boolean(item && typeof item === "object" && "path" in item && "type" in item))
    .filter((source) => source.path && source.type === "folder")
    .map((source) => ({
      folderPath: source.path,
      platformId,
      platformName: "Plataforma",
      indexedCount: 0
    }));
}

function isFolderEntry(value: unknown): value is FolderEntry {
  return Boolean(
    value &&
    typeof value === "object" &&
    "folderPath" in value &&
    "platformId" in value &&
    typeof (value as FolderEntry).folderPath === "string"
  );
}

function isRomImportJob(value: unknown): value is RomFolderImportJob {
  return Boolean(value && typeof value === "object" && "jobId" in value && "progress" in value);
}

function isMediaSyncJob(value: unknown): value is MediaSyncJob {
  return Boolean(value && typeof value === "object" && "jobId" in value && "title" in value && "status" in value);
}

function isDataPortabilityJob(value: unknown): value is DataPortabilityJob {
  return Boolean(value && typeof value === "object" && "jobId" in value && "kind" in value && "progress" in value);
}
