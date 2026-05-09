import { create } from "zustand";
import {
  CollectionCounts,
  CoverSyncFailureItem,
  CollectionFilter,
  CoverSyncStats,
  DataPortabilityJob,
  DataPortabilityProgress,
  Game,
  GameListResult,
  GameSortBy,
  LaunchBoxProgress,
  Platform,
  RomFolderImportJob,
  RomFolderImportProgress,
  RomFolderImportResult,
  ViewMode
} from "../../shared/types";

export type SettingsSection = "geral" | "biblioteca" | "plataformas" | "covers" | "emuladores" | "sobre";

const LAST_ROM_IMPORT_JOB_KEY = "gamestock.media.lastRomImportJob";
const LAST_MEDIA_SYNC_JOB_KEY = "gamestock.media.lastMediaSyncJob";
const LAST_MEDIA_SYNC_JOBS_KEY = "gamestock.media.lastMediaSyncJobs";
const LAST_DATA_PORTABILITY_JOBS_KEY = "gamestock.dataPortability.jobs";

type SetterValue<T> = T | ((current: T) => T);

export interface MediaSyncJob {
  jobId: string;
  title: string;
  subtitle: string;
  status: "running" | "completed" | "failed" | "interrupted";
  detail: string;
  progressLabel: string;
  percent: number;
  startedAt: string;
  indeterminate?: boolean;
  failures?: CoverSyncFailureItem[];
}

interface StartMediaSyncJobInput {
  jobId: string;
  title: string;
  subtitle?: string;
  detail?: string;
  progressLabel?: string;
  percent?: number;
  startedAt?: string;
  indeterminate?: boolean;
}

interface FinishMediaSyncJobInput {
  title: string;
  detail?: string;
  progressLabel?: string;
  status?: "completed" | "failed";
  failures?: CoverSyncFailureItem[];
}

interface GameStockState {
  selectedPlatformId: number | null;
  searchQuery: string;
  selectedCategory: string;
  viewMode: ViewMode;
  collectionFilter: CollectionFilter;
  sortBy: GameSortBy;
  games: Game[];
  total: number;
  filtered: number;
  currentPage: number;
  platforms: Platform[];
  loading: boolean;
  selectedGameId: number | null;
  selectedGame: Game | null;
  importerOpen: boolean;
  settingsOpen: boolean;
  settingsSection: SettingsSection;
  createGameOpen: boolean;
  reloadToken: number;
  platformsReloadToken: number;
  collectionCounts: CollectionCounts;
  lastRomImportJob: RomFolderImportJob | null;
  mediaSyncJobs: MediaSyncJob[];
  dataPortabilityJobs: DataPortabilityJob[];
  metadataStartupRunning: boolean;
  coverStats: CoverSyncStats | null;
  setSelectedPlatformId(value: number | null): void;
  setSearchQuery(value: string): void;
  setSelectedCategory(value: string): void;
  setViewMode(value: ViewMode): void;
  setCollectionFilter(value: CollectionFilter): void;
  setSortBy(value: GameSortBy): void;
  setCurrentPage(value: number): void;
  setGames(value: GameListResult): void;
  setPlatforms(value: Platform[]): void;
  setLoading(value: boolean): void;
  setSelectedGameId(value: number | null): void;
  setSelectedGame(value: Game | null): void;
  selectGame(value: Game): void;
  upsertGame(value: Game): void;
  removeGame(value: number): void;
  setImporterOpen(value: boolean): void;
  setSettingsOpen(value: boolean): void;
  setSettingsSection(value: SettingsSection): void;
  openSettings(section: SettingsSection): void;
  setCreateGameOpen(value: boolean): void;
  setCollectionCounts(value: CollectionCounts): void;
  setLastRomImportJob(value: SetterValue<RomFolderImportJob | null>): void;
  hydrateRomImportJobs(value: RomFolderImportJob[]): void;
  updateRomImportProgress(value: RomFolderImportProgress): void;
  completeRomImportJob(value: RomFolderImportResult): void;
  startMediaSyncJob(value: StartMediaSyncJobInput): void;
  updateMediaSyncProgress(value: LaunchBoxProgress): void;
  finishMediaSyncJob(jobId: string, value: FinishMediaSyncJobInput): void;
  failMediaSyncJob(jobId: string, message: string): void;
  dismissMediaSyncJob(jobId: string): void;
  hydrateDataPortabilityJobs(value: DataPortabilityJob[]): void;
  startDataPortabilityJob(value: DataPortabilityJob): void;
  updateDataPortabilityProgress(value: DataPortabilityProgress): void;
  completeDataPortabilityJob(value: DataPortabilityJob): void;
  dismissDataPortabilityJob(jobId: string): void;
  setMetadataStartupRunning(value: boolean): void;
  setCoverStats(value: CoverSyncStats): void;
  reloadGames(): void;
  reloadPlatforms(): void;
}

export const useGameStockStore = create<GameStockState>((set) => ({
  selectedPlatformId: null,
  searchQuery: "",
  selectedCategory: "",
  viewMode: "grid",
  collectionFilter: "all",
  sortBy: "title",
  games: [],
  total: 0,
  filtered: 0,
  currentPage: 1,
  platforms: [],
  loading: false,
  selectedGameId: null,
  selectedGame: null,
  importerOpen: false,
  settingsOpen: false,
  settingsSection: "geral",
  createGameOpen: false,
  reloadToken: 0,
  platformsReloadToken: 0,
  collectionCounts: { favorites: 0, playing: 0, completed: 0 },
  lastRomImportJob: loadSavedRomImportJob(),
  mediaSyncJobs: loadSavedMediaSyncJobs(),
  dataPortabilityJobs: loadSavedDataPortabilityJobs(),
  metadataStartupRunning: false,
  coverStats: null,
  setSelectedPlatformId: (selectedPlatformId) => set({ selectedPlatformId, collectionFilter: "all", currentPage: 1, selectedGameId: null, selectedGame: null }),
  setSearchQuery: (searchQuery) => set({ searchQuery, currentPage: 1 }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory, currentPage: 1 }),
  setViewMode: (viewMode) => set({ viewMode }),
  setCollectionFilter: (collectionFilter) => set({ collectionFilter, selectedPlatformId: null, currentPage: 1, selectedGameId: null, selectedGame: null }),
  setSortBy: (sortBy) => set({ sortBy, currentPage: 1 }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setGames: ({ items, total, filtered }) => set((state) => ({
    games: items,
    total,
    filtered,
    selectedGame: state.selectedGameId
      ? items.find((item) => item.id === state.selectedGameId) ?? state.selectedGame
      : null
  })),
  setPlatforms: (platforms) => set({ platforms }),
  setLoading: (loading) => set({ loading }),
  setSelectedGameId: (selectedGameId) => set((state) => ({
    selectedGameId,
    selectedGame: selectedGameId
      ? state.games.find((item) => item.id === selectedGameId) ?? (state.selectedGame?.id === selectedGameId ? state.selectedGame : null)
      : null
  })),
  setSelectedGame: (selectedGame) => set({
    selectedGame,
    selectedGameId: selectedGame?.id ?? null
  }),
  selectGame: (selectedGame) => set({ selectedGame, selectedGameId: selectedGame.id }),
  upsertGame: (game) => set((state) => ({
    games: state.games.map((item) => item.id === game.id ? game : item),
    selectedGame: state.selectedGameId === game.id ? game : state.selectedGame
  })),
  removeGame: (gameId) => set((state) => ({
    games: state.games.filter((item) => item.id !== gameId),
    selectedGameId: state.selectedGameId === gameId ? null : state.selectedGameId,
    selectedGame: state.selectedGameId === gameId ? null : state.selectedGame
  })),
  setImporterOpen: (importerOpen) => set({ importerOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setSettingsSection: (settingsSection) => set({ settingsSection }),
  openSettings: (settingsSection) => set({ settingsOpen: true, settingsSection }),
  setCreateGameOpen: (createGameOpen) => set({ createGameOpen }),
  setCollectionCounts: (collectionCounts) => set({ collectionCounts }),
  setLastRomImportJob: (lastRomImportJob) => set((state) => {
    const nextJob = resolveSetterValue(lastRomImportJob, state.lastRomImportJob);
    persistFinishedJob(LAST_ROM_IMPORT_JOB_KEY, nextJob);
    return { lastRomImportJob: nextJob };
  }),
  hydrateRomImportJobs: (jobs) => set((state) => {
    const runningJob = jobs.find((job) => job.status === "running") ?? null;
    const nextJob = runningJob ?? state.lastRomImportJob;
    persistFinishedJob(LAST_ROM_IMPORT_JOB_KEY, nextJob);
    return { lastRomImportJob: nextJob };
  }),
  updateRomImportProgress: (progress) => set((state) => {
    if (!progress.jobId) return {};
    const nextJob = buildRomImportJobFromProgress(state.lastRomImportJob, progress);
    persistFinishedJob(LAST_ROM_IMPORT_JOB_KEY, nextJob);
    return { lastRomImportJob: nextJob };
  }),
  completeRomImportJob: (result) => set((state) => {
    if (!result.jobId) return {};
    const nextJob = buildCompletedRomImportJob(state.lastRomImportJob, result);
    persistFinishedJob(LAST_ROM_IMPORT_JOB_KEY, nextJob);
    return { lastRomImportJob: nextJob };
  }),
  startMediaSyncJob: (job) => set((state) => {
    const newJob: MediaSyncJob = {
      jobId: job.jobId,
      title: job.title,
      subtitle: job.subtitle ?? "Biblioteca",
      status: "running",
      detail: job.detail ?? "Preparando",
      progressLabel: job.progressLabel ?? "Iniciando",
      percent: job.percent ?? 0,
      startedAt: job.startedAt ?? new Date().toISOString(),
      indeterminate: job.indeterminate,
      failures: []
    };
    const updated = [...state.mediaSyncJobs, newJob];
    persistMediaSyncJobs(updated);
    return { mediaSyncJobs: updated };
  }),
  updateMediaSyncProgress: (progress) => set((state) => {
    const running = state.mediaSyncJobs.filter((j) => j.status === "running");
    if (!running.length) return {};
    const target = running.length === 1 ? running[0] : routeProgressToJob(progress, running);
    if (!target) return {};
    return {
      mediaSyncJobs: state.mediaSyncJobs.map((j) =>
        j.jobId === target.jobId ? buildMediaJobFromProgress(j, progress) : j
      )
    };
  }),
  finishMediaSyncJob: (jobId, result) => set((state) => {
    const current = state.mediaSyncJobs.find((j) => j.jobId === jobId) ?? null;
    const nextJob: MediaSyncJob = {
      jobId,
      title: result.title,
      subtitle: current?.subtitle ?? "Biblioteca",
      status: result.status ?? "completed",
      detail: result.detail ?? current?.detail ?? result.title,
      progressLabel: result.progressLabel ?? (result.status === "failed" ? "Erro" : "Concluído"),
      percent: 100,
      startedAt: current?.startedAt ?? new Date().toISOString(),
      indeterminate: false,
      failures: result.failures ?? current?.failures ?? []
    };
    const updated = state.mediaSyncJobs.map((j) => j.jobId === jobId ? nextJob : j);
    persistMediaSyncJobs(updated);
    return { mediaSyncJobs: updated };
  }),
  failMediaSyncJob: (jobId, message) => set((state) => {
    const current = state.mediaSyncJobs.find((j) => j.jobId === jobId) ?? null;
    const nextJob: MediaSyncJob = {
      jobId,
      title: current?.title ? `${current.title} falhou` : "Sincronizacao falhou",
      subtitle: current?.subtitle ?? "Biblioteca",
      status: "failed",
      detail: message,
      progressLabel: "Erro",
      percent: 100,
      startedAt: current?.startedAt ?? new Date().toISOString(),
      indeterminate: false,
      failures: current?.failures ?? []
    };
    const updated = state.mediaSyncJobs.map((j) => j.jobId === jobId ? nextJob : j);
    persistMediaSyncJobs(updated);
    return { mediaSyncJobs: updated };
  }),
  dismissMediaSyncJob: (jobId) => set((state) => {
    const updated = state.mediaSyncJobs.filter((j) => j.jobId !== jobId);
    persistMediaSyncJobs(updated);
    return { mediaSyncJobs: updated };
  }),
  hydrateDataPortabilityJobs: (jobs) => set((state) => {
    const known = new Map(state.dataPortabilityJobs.map((job) => [job.jobId, job]));
    for (const job of jobs) known.set(job.jobId, normalizeDataPortabilityJob(job));
    const updated = Array.from(known.values()).sort((a, b) => timestamp(b.startedAt) - timestamp(a.startedAt));
    persistDataPortabilityJobs(updated);
    return { dataPortabilityJobs: updated };
  }),
  startDataPortabilityJob: (job) => set((state) => {
    const existing = state.dataPortabilityJobs.find((item) => item.jobId === job.jobId);
    const nextJob = existing && existing.progress.current > job.progress.current
      ? { ...job, status: existing.status, progress: existing.progress, exportResult: existing.exportResult, importResult: existing.importResult, error: existing.error }
      : job;
    const updated = upsertDataPortabilityJob(state.dataPortabilityJobs, normalizeDataPortabilityJob(nextJob));
    persistDataPortabilityJobs(updated);
    return { dataPortabilityJobs: updated };
  }),
  updateDataPortabilityProgress: (progress) => set((state) => {
    if (!progress.jobId) return {};
    const existing = state.dataPortabilityJobs.find((job) => job.jobId === progress.jobId);
    const next: DataPortabilityJob = normalizeDataPortabilityJob({
      jobId: progress.jobId,
      kind: progress.kind,
      status: progress.stage === "error" ? "failed" : "running",
      startedAt: existing?.startedAt ?? new Date().toISOString(),
      progress,
      packagePath: existing?.packagePath,
      exportResult: existing?.exportResult,
      importResult: existing?.importResult,
      error: progress.stage === "error" ? progress.message : existing?.error
    });
    const updated = upsertDataPortabilityJob(state.dataPortabilityJobs, next);
    persistDataPortabilityJobs(updated);
    return { dataPortabilityJobs: updated };
  }),
  completeDataPortabilityJob: (job) => set((state) => {
    const updated = upsertDataPortabilityJob(state.dataPortabilityJobs, normalizeDataPortabilityJob(job));
    persistDataPortabilityJobs(updated);
    return { dataPortabilityJobs: updated };
  }),
  dismissDataPortabilityJob: (jobId) => set((state) => {
    const updated = state.dataPortabilityJobs.filter((job) => job.jobId !== jobId);
    persistDataPortabilityJobs(updated);
    return { dataPortabilityJobs: updated };
  }),
  setMetadataStartupRunning: (metadataStartupRunning) => set({ metadataStartupRunning }),
  setCoverStats: (coverStats) => set({ coverStats }),
  reloadGames: () => set((state) => ({ reloadToken: state.reloadToken + 1 })),
  reloadPlatforms: () => set((state) => ({ platformsReloadToken: state.platformsReloadToken + 1 }))
}));

function resolveSetterValue<T>(value: SetterValue<T>, current: T): T {
  return typeof value === "function" ? (value as (current: T) => T)(current) : value;
}

function buildRomImportJobFromProgress(current: RomFolderImportJob | null, progress: RomFolderImportProgress): RomFolderImportJob {
  const previous = current?.jobId === progress.jobId ? current : null;
  return {
    jobId: progress.jobId!,
    folderPaths: previous?.folderPaths ?? [],
    romFilePaths: previous?.romFilePaths ?? [],
    platformId: previous?.platformId ?? 0,
    platformName: previous?.platformName ?? "Biblioteca",
    status: progress.stage === "error" ? "failed" : "running",
    startedAt: previous?.startedAt ?? new Date().toISOString(),
    progress,
    result: previous?.result,
    error: progress.stage === "error" ? progress.message : previous?.error
  };
}

function buildCompletedRomImportJob(current: RomFolderImportJob | null, result: RomFolderImportResult): RomFolderImportJob {
  const previous = current?.jobId === result.jobId ? current : null;
  return {
    jobId: result.jobId!,
    folderPaths: result.folderPaths,
    romFilePaths: result.romFilePaths,
    platformId: result.platformId,
    platformName: result.platformName,
    status: "completed",
    startedAt: previous?.startedAt ?? new Date().toISOString(),
    progress: {
      jobId: result.jobId,
      current: result.summary.processed,
      total: result.summary.processed,
      stage: "done",
      message: "Importacao concluida"
    },
    result
  };
}

function buildMediaJobFromProgress(current: MediaSyncJob, progress: LaunchBoxProgress): MediaSyncJob {
  const failed = progress.status === "error";
  return {
    ...current,
    status: failed ? "failed" : current.status,
    detail: mediaProgressDetail(progress, current.detail),
    progressLabel: mediaProgressLabel(progress),
    percent: mediaProgressPercent(progress, current.percent),
    indeterminate: progress.status === "extracting" || progress.status === "indexing"
  };
}

function mediaProgressDetail(progress: LaunchBoxProgress, fallback: string): string {
  if (progress.status === "extracting") return "Extraindo Metadata.zip";
  if (progress.status === "indexing") return "Construindo índice";
  return progress.filename ?? fallback;
}

function mediaProgressLabel(progress: LaunchBoxProgress): string {
  if (progress.status === "extracting") return "Extraindo";
  if (progress.status === "indexing") return "Construindo índice";
  if (progress.status === "done") return "Concluído";
  if (isMetadataProgress(progress)) return `${formatMegabytes(progress.current)} de ${formatMegabytes(progress.total)}`;
  return progress.total ? `${progress.current} de ${progress.total}` : "Processando";
}

function mediaProgressPercent(progress: LaunchBoxProgress, fallback: number): number {
  if (progress.status === "done") return 100;
  if (progress.status === "extracting" || progress.status === "indexing") return 100;
  if (!progress.total) return fallback;
  return Math.min(100, Math.round((progress.current / progress.total) * 100));
}

function isMetadataProgress(progress: LaunchBoxProgress): boolean {
  return progress.filename?.toLowerCase() === "metadata.zip";
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function persistFinishedJob<T>(key: string, job: T | null): void {
  try {
    if (typeof window === "undefined") return;
    if (!job) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(job));
  } catch {
    // Local persistence is best effort; runtime state remains source of truth.
  }
}

function loadSavedRomImportJob(): RomFolderImportJob | null {
  const job = loadSavedJob<RomFolderImportJob>(LAST_ROM_IMPORT_JOB_KEY, isRomImportJob);
  if (!job) return null;
  if (job.status === "running") {
    return { ...job, status: "interrupted", progress: { ...job.progress, message: "Interrompido" } };
  }
  return job;
}

function loadSavedMediaSyncJobs(): MediaSyncJob[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(LAST_MEDIA_SYNC_JOBS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(isMediaSyncJob).map((j) =>
          j.status === "running" ? { ...j, status: "interrupted" as const, progressLabel: "Interrompido" } : j
        );
      }
    }
    // migrate legacy single-job key
    const legacy = loadSavedJob<MediaSyncJob>(LAST_MEDIA_SYNC_JOB_KEY, isMediaSyncJob);
    return legacy ? [legacy] : [];
  } catch {
    return [];
  }
}

function persistMediaSyncJobs(jobs: MediaSyncJob[]): void {
  try {
    if (typeof window === "undefined") return;
    if (!jobs.length) {
      window.localStorage.removeItem(LAST_MEDIA_SYNC_JOBS_KEY);
    } else {
      window.localStorage.setItem(LAST_MEDIA_SYNC_JOBS_KEY, JSON.stringify(jobs));
    }
  } catch {
    // best effort
  }
}

function loadSavedDataPortabilityJobs(): DataPortabilityJob[] {
  try {
    if (typeof window === "undefined") return [];
    const parsed: unknown = JSON.parse(window.localStorage.getItem(LAST_DATA_PORTABILITY_JOBS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDataPortabilityJob).map((job) =>
      job.status === "running" ? { ...job, status: "interrupted" as const, progress: { ...job.progress, message: "Interrompido" } } : job
    );
  } catch {
    return [];
  }
}

function persistDataPortabilityJobs(jobs: DataPortabilityJob[]): void {
  try {
    if (typeof window === "undefined") return;
    const recent = jobs.slice(0, 5);
    if (!recent.length) window.localStorage.removeItem(LAST_DATA_PORTABILITY_JOBS_KEY);
    else window.localStorage.setItem(LAST_DATA_PORTABILITY_JOBS_KEY, JSON.stringify(recent));
  } catch {
    // best effort
  }
}

function upsertDataPortabilityJob(jobs: DataPortabilityJob[], nextJob: DataPortabilityJob): DataPortabilityJob[] {
  return [nextJob, ...jobs.filter((job) => job.jobId !== nextJob.jobId)]
    .sort((a, b) => timestamp(b.startedAt) - timestamp(a.startedAt))
    .slice(0, 5);
}

function normalizeDataPortabilityJob(job: DataPortabilityJob): DataPortabilityJob {
  return {
    ...job,
    progress: {
      ...job.progress,
      total: Math.max(1, job.progress.total),
      current: Math.max(0, Math.min(job.progress.current, Math.max(1, job.progress.total)))
    }
  };
}

function routeProgressToJob(progress: LaunchBoxProgress, running: MediaSyncJob[]): MediaSyncJob | null {
  const isMetadata = progress.status === "extracting" || progress.status === "indexing" || isMetadataProgress(progress);
  return running.find((j) => isMetadata ? j.jobId.startsWith("metadata-") : j.jobId.startsWith("media-sync-")) ?? running[0];
}

function loadSavedJob<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  try {
    if (typeof window === "undefined") return null;
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
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

function timestamp(value: string | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}
