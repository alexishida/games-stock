/**
 * Camada de persistência de estado da aplicação no renderer.
 *
 * Abstrai operações de leitura/escrita/remoção de estado persistido no SQLite
 * via IPC (`window.gameStockAPI.appState`). Também inclui a lógica de migração
 * de dados legados do `localStorage` para o SQLite.
 *
 * Dados gerenciados:
 * - Entradas de pastas de ROM configuradas pelo usuário.
 * - Último job de importação de ROM.
 * - Jobs de sincronização de mídia (LaunchBox).
 * - Jobs de portabilidade de dados (backup/restore).
 *
 * Regra de conversão de status "running" → "interrupted":
 * Qualquer job lido do SQLite com status "running" indica que o app foi fechado
 * ou travou durante a execução. Esses jobs são convertidos para "interrupted"
 * para que a UI possa exibir a situação corretamente ao usuário.
 */
import { APP_STATE_KEYS } from "../../shared/appState";
import { CollectionFilter, DataPortabilityJob, DataPortabilityRomFolderEntry, GameSortBy, RomFolderImportJob, ViewMode } from "../../shared/types";
import type { MediaSyncJob } from "../store";

/** Entrada de pasta de ROM persistida, com contagem total de ROMs (opcional). */
export type PersistedRomFolderEntry = DataPortabilityRomFolderEntry & { totalCount?: number };

/** Filtros da biblioteca persistidos no SQLite para restaurar a preferência do usuário. */
export interface PersistedLibraryFilters {
  selectedCategory: string;
  collectionFilter: CollectionFilter;
  showGamesWithoutCover: boolean;
  sortBy: GameSortBy;
  viewMode: ViewMode;
}

/** Fonte de importação legada (antes de migrar para o formato de entradas de pasta). */
type ImportSource = { path: string; type: "folder" | "file" };

// ─── Entradas de pastas de ROM ───────────────────────────────────────────────

/**
 * Lê as entradas de pastas de ROM persistidas no SQLite.
 * Retorna array vazio se não houver dados ou se o formato for inválido.
 */
export async function getPersistedRomFolderEntries(): Promise<PersistedRomFolderEntry[]> {
  const value = await getPersistedValue<unknown>(APP_STATE_KEYS.romImport.folderEntries);
  return Array.isArray(value) ? value.filter(isFolderEntry) : [];
}

/**
 * Persiste as entradas de pastas de ROM no SQLite.
 */
export function setPersistedRomFolderEntries(entries: PersistedRomFolderEntry[]): Promise<void> {
  return setPersistedValue(APP_STATE_KEYS.romImport.folderEntries, entries);
}

/**
 * Mescla novas entradas de pasta de ROM com as existentes, sem duplicar.
 * A chave de deduplicação é a combinação `platformId:folderPath`.
 * Usada após importação de backup para incorporar pastas do pacote importado.
 */
export async function mergePersistedRomFolderEntries(entries: DataPortabilityRomFolderEntry[]): Promise<void> {
  if (!entries.length) return;
  const current = await getPersistedRomFolderEntries();
  const merged = new Map<string, PersistedRomFolderEntry>();
  // Entradas existentes primeiro; novas entradas sobrescrevem se a chave coincidir
  for (const entry of [...current, ...entries]) {
    if (!isFolderEntry(entry)) continue;
    merged.set(`${entry.platformId}:${entry.folderPath}`, entry);
  }
  await setPersistedRomFolderEntries(Array.from(merged.values()));
}

// ─── ID de plataforma para importação de ROM ─────────────────────────────────

/**
 * Lê o ID de plataforma selecionado para importação de ROM.
 * Retorna string vazia se não houver valor válido.
 */
export async function getPersistedRomImportPlatformId(): Promise<number | ""> {
  const value = await getPersistedValue<unknown>(APP_STATE_KEYS.romImport.platformId);
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : "";
}

/**
 * Persiste o ID de plataforma selecionado para importação de ROM.
 * Remove a entrada se o valor for vazio ou inválido.
 */
export async function setPersistedRomImportPlatformId(platformId: number | ""): Promise<void> {
  if (!platformId) {
    await removePersistedValue(APP_STATE_KEYS.romImport.platformId);
    return;
  }
  await setPersistedValue(APP_STATE_KEYS.romImport.platformId, platformId);
}

// ─── Último job de importação de ROM ─────────────────────────────────────────

/**
 * Lê o último job de importação de ROM do SQLite.
 * Converte status "running" para "interrupted" se o app foi fechado durante a importação.
 */
export async function getPersistedLastRomImportJob(): Promise<RomFolderImportJob | null> {
  const value = await getPersistedValue<unknown>(APP_STATE_KEYS.media.lastRomImportJob);
  if (!isRomImportJob(value)) return null;
  if (value.status === "running") {
    // Job estava em execução quando o app fechou: marca como interrompido
    return { ...value, status: "interrupted", progress: { ...value.progress, message: "Interrompido" } };
  }
  return value;
}

/**
 * Persiste o último job de importação de ROM.
 * Remove a entrada se o job for null.
 */
export async function setPersistedLastRomImportJob(job: RomFolderImportJob | null): Promise<void> {
  if (!job) {
    await removePersistedValue(APP_STATE_KEYS.media.lastRomImportJob);
    return;
  }
  await setPersistedValue(APP_STATE_KEYS.media.lastRomImportJob, job);
}

// ─── Jobs de sincronização de mídia (LaunchBox) ──────────────────────────────

/**
 * Lê a lista de MediaSyncJobs do SQLite.
 * - Converte jobs com status "running" para "interrupted".
 * - Inclui fallback para o formato legado de job único (antes da lista).
 */
export async function getPersistedMediaSyncJobs(): Promise<MediaSyncJob[]> {
  const value = await getPersistedValue<unknown>(APP_STATE_KEYS.media.lastMediaSyncJobs);
  if (Array.isArray(value)) {
    return value.filter(isMediaSyncJob).map((job) =>
      // Jobs em execução ao fechar o app são marcados como interrompidos
      job.status === "running" ? { ...job, status: "interrupted", progressLabel: "Interrompido" } : job
    );
  }

  // Compatibilidade com versão anterior que persistia apenas um job (não uma lista)
  const legacy = await getPersistedValue<unknown>(APP_STATE_KEYS.media.lastMediaSyncJob);
  return isMediaSyncJob(legacy)
    ? [legacy.status === "running" ? { ...legacy, status: "interrupted", progressLabel: "Interrompido" } : legacy]
    : [];
}

/**
 * Persiste a lista de MediaSyncJobs no SQLite.
 * Remove a entrada se a lista estiver vazia.
 */
export async function setPersistedMediaSyncJobs(jobs: MediaSyncJob[]): Promise<void> {
  if (!jobs.length) {
    await removePersistedValue(APP_STATE_KEYS.media.lastMediaSyncJobs);
    return;
  }
  await setPersistedValue(APP_STATE_KEYS.media.lastMediaSyncJobs, jobs);
}

// ─── Jobs de portabilidade de dados (backup/restore) ─────────────────────────

/**
 * Lê a lista de DataPortabilityJobs do SQLite.
 * Converte jobs com status "running" para "interrupted".
 */
export async function getPersistedDataPortabilityJobs(): Promise<DataPortabilityJob[]> {
  const value = await getPersistedValue<unknown>(APP_STATE_KEYS.dataPortability.jobs);
  if (!Array.isArray(value)) return [];
  return value.filter(isDataPortabilityJob).map((job) =>
    job.status === "running" ? { ...job, status: "interrupted", progress: { ...job.progress, message: "Interrompido" } } : job
  );
}

/**
 * Persiste a lista de DataPortabilityJobs no SQLite.
 * Limita a 5 entradas mais recentes e remove a chave se a lista estiver vazia.
 */
export async function setPersistedDataPortabilityJobs(jobs: DataPortabilityJob[]): Promise<void> {
  // Mantém apenas os 5 jobs mais recentes para não acumular histórico indefinidamente
  const recent = jobs.slice(0, 5);
  if (!recent.length) {
    await removePersistedValue(APP_STATE_KEYS.dataPortability.jobs);
    return;
  }
  await setPersistedValue(APP_STATE_KEYS.dataPortability.jobs, recent);
}

// ─── Filtros da biblioteca ───────────────────────────────────────────────────

/**
 * Lê os filtros da biblioteca persistidos no SQLite.
 * Valida cada campo e aplica defaults quando ausente ou inválido;
 * retorna null quando o valor armazenado não é um objeto válido.
 */
export async function getPersistedLibraryFilters(): Promise<PersistedLibraryFilters | null> {
  const value = await getPersistedValue<unknown>(APP_STATE_KEYS.ui.libraryFilters);
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PersistedLibraryFilters>;
  if (typeof raw.showGamesWithoutCover !== "boolean") return null;
  return {
    selectedCategory: typeof raw.selectedCategory === "string" ? raw.selectedCategory : "",
    collectionFilter: isCollectionFilter(raw.collectionFilter) ? raw.collectionFilter : "all",
    showGamesWithoutCover: raw.showGamesWithoutCover,
    sortBy: isGameSortBy(raw.sortBy) ? raw.sortBy : "title",
    viewMode: isViewMode(raw.viewMode) ? raw.viewMode : "grid"
  };
}

/**
 * Persiste os filtros da biblioteca no SQLite.
 * Chamado sempre que o usuário altera categoria, coleção, exibição sem capa,
 * ordenação ou modo de visualização.
 */
export async function setPersistedLibraryFilters(filters: PersistedLibraryFilters): Promise<void> {
  await setPersistedValue(APP_STATE_KEYS.ui.libraryFilters, filters);
}

// ─── Migração do localStorage para SQLite ────────────────────────────────────

/**
 * Migra dados de estado persistidos no `localStorage` legado para o SQLite.
 *
 * Executado uma única vez na inicialização do app. Para cada chave:
 * 1. Verifica se o SQLite já tem o valor (não sobrescreve dados existentes).
 * 2. Tenta ler o valor do `localStorage`.
 * 3. Se encontrado, grava no SQLite.
 * 4. Remove a chave do `localStorage` após a migração.
 *
 * Também converte o formato legado de "sources" + "platformId" separados
 * para o formato atual de entradas de pasta (`PersistedRomFolderEntry[]`).
 */
export async function migrateLegacyLocalStorageToDb(): Promise<void> {
  if (typeof window === "undefined") return;

  // Lista de todas as chaves que podem existir no localStorage legado
  const keys = [
    APP_STATE_KEYS.romImport.sources,
    APP_STATE_KEYS.romImport.platformId,
    APP_STATE_KEYS.romImport.folderEntries,
    APP_STATE_KEYS.media.lastRomImportJob,
    APP_STATE_KEYS.media.lastMediaSyncJob,
    APP_STATE_KEYS.media.lastMediaSyncJobs,
    APP_STATE_KEYS.dataPortability.jobs
  ];

  // Lê de uma vez todas as chaves que já existem no SQLite
  const existing = await window.gameStockAPI.appState.getMany(keys);
  const entries: Array<{ key: string; value: unknown }> = [];

  // Migração especial: entradas de pasta (pode vir do formato legado sources+platformId)
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

  // Migração do ID de plataforma persistido como string no localStorage
  if (!(APP_STATE_KEYS.romImport.platformId in existing)) {
    const rawPlatformId = readLegacyRaw(APP_STATE_KEYS.romImport.platformId);
    const platformId = Number(rawPlatformId);
    if (Number.isFinite(platformId) && platformId > 0) {
      entries.push({ key: APP_STATE_KEYS.romImport.platformId, value: platformId });
    }
  }

  // Chaves cujo valor é JSON direto, sem transformação necessária
  const directJsonKeys = [
    APP_STATE_KEYS.media.lastRomImportJob,
    APP_STATE_KEYS.media.lastMediaSyncJob,
    APP_STATE_KEYS.media.lastMediaSyncJobs,
    APP_STATE_KEYS.dataPortability.jobs
  ];

  for (const key of directJsonKeys) {
    if (key in existing) continue; // SQLite já tem o dado, não sobrescreve
    const parsed = readLegacyJson(key);
    if (parsed !== null) entries.push({ key, value: parsed });
  }

  // Grava todas as entradas migradas de uma vez no SQLite
  if (entries.length) {
    await window.gameStockAPI.appState.setMany(entries, true);
  }

  // Limpa o localStorage após migração bem-sucedida
  for (const key of keys) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore cleanup failures. DB already becomes source of truth.
    }
  }
}

// ─── Helpers internos de acesso ao SQLite via IPC ────────────────────────────

/** Lê um valor tipado do SQLite via IPC. Retorna null em SSR ou se não encontrado. */
async function getPersistedValue<T>(key: string): Promise<T | null> {
  if (typeof window === "undefined") return null;
  return window.gameStockAPI.appState.get<T>(key);
}

/** Grava um valor no SQLite via IPC. No-op em SSR. */
async function setPersistedValue(key: string, value: unknown): Promise<void> {
  if (typeof window === "undefined") return;
  await window.gameStockAPI.appState.set(key, value);
}

/** Remove uma chave do SQLite via IPC. No-op em SSR. */
async function removePersistedValue(key: string): Promise<void> {
  if (typeof window === "undefined") return;
  await window.gameStockAPI.appState.remove(key);
}

// ─── Helpers de leitura do localStorage legado ───────────────────────────────

/** Lê o valor bruto (string) de uma chave do `localStorage`. Retorna null em caso de erro. */
function readLegacyRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Lê e parseia um valor JSON do `localStorage`. Retorna null se ausente ou inválido. */
function readLegacyJson(key: string): unknown | null {
  const raw = readLegacyRaw(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Converte o formato legado de importação (array de sources + platformId separado)
 * para o formato atual de `PersistedRomFolderEntry[]`.
 * Aceita apenas sources do tipo "folder" (ignora arquivos individuais).
 */
function buildFolderEntriesFromLegacySources(rawSources: unknown, rawPlatformId: string | null): PersistedRomFolderEntry[] {
  const platformId = Number(rawPlatformId);
  if (!Number.isFinite(platformId) || platformId <= 0 || !Array.isArray(rawSources)) return [];
  return rawSources
    .filter((item): item is ImportSource => Boolean(item && typeof item === "object" && "path" in item && "type" in item))
    .filter((source) => source.path && source.type === "folder")
    .map((source) => ({
      folderPath: source.path,
      platformId,
      platformName: "Plataforma",
      indexedCount: 0,
      includeSubfolders: false
    }));
}

// ─── Type guards ─────────────────────────────────────────────────────────────

/** Verifica se um valor desconhecido é um `CollectionFilter` válido. */
function isCollectionFilter(value: unknown): value is CollectionFilter {
  return value === "all" || value === "favorites" || value === "playing" || value === "completed" || value === "unplayed" || value === "mostPlayed";
}

/** Verifica se um valor desconhecido é um `GameSortBy` válido. */
function isGameSortBy(value: unknown): value is GameSortBy {
  return value === "title" || value === "year" || value === "recent" || value === "mostPlayed";
}

/** Verifica se um valor desconhecido é um `ViewMode` válido. */
function isViewMode(value: unknown): value is ViewMode {
  return value === "grid" || value === "list";
}

/** Verifica se um valor desconhecido é uma `PersistedRomFolderEntry` válida. */
function isFolderEntry(value: unknown): value is PersistedRomFolderEntry {
  return Boolean(
    value &&
    typeof value === "object" &&
    "folderPath" in value &&
    "platformId" in value &&
    typeof (value as PersistedRomFolderEntry).folderPath === "string"
  );
}

/** Verifica se um valor desconhecido é um `RomFolderImportJob` válido. */
function isRomImportJob(value: unknown): value is RomFolderImportJob {
  return Boolean(value && typeof value === "object" && "jobId" in value && "progress" in value);
}

/** Verifica se um valor desconhecido é um `MediaSyncJob` válido. */
function isMediaSyncJob(value: unknown): value is MediaSyncJob {
  return Boolean(value && typeof value === "object" && "jobId" in value && "title" in value && "status" in value);
}

/** Verifica se um valor desconhecido é um `DataPortabilityJob` válido. */
function isDataPortabilityJob(value: unknown): value is DataPortabilityJob {
  return Boolean(value && typeof value === "object" && "jobId" in value && "kind" in value && "progress" in value);
}
