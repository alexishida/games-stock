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
import {
  setPersistedDataPortabilityJobs,
  setPersistedLastRomImportJob,
  setPersistedMediaSyncJobs,
  setPersistedRomFolderEntries,
  type PersistedRomFolderEntry
} from "../lib/appStatePersistence";
import { timestamp } from "../lib/time";

const MAX_PORTABILITY_JOBS = 5;

export type SettingsSection = "geral" | "backup" | "biblioteca" | "plataformas" | "covers" | "emuladores" | "sobre";

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
  romFolderEntries: PersistedRomFolderEntry[];
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
  upsertGame(value: Game): void;
  removeGame(value: number): void;
  setImporterOpen(value: boolean): void;
  setSettingsOpen(value: boolean): void;
  setSettingsSection(value: SettingsSection): void;
  openSettings(section: SettingsSection): void;
  setCreateGameOpen(value: boolean): void;
  setCollectionCounts(value: CollectionCounts): void;
  hydrateRomFolderEntries(value: PersistedRomFolderEntry[]): void;
  setRomFolderEntries(value: SetterValue<PersistedRomFolderEntry[]>): void;
  hydratePersistedLastRomImportJob(value: RomFolderImportJob | null): void;
  setLastRomImportJob(value: SetterValue<RomFolderImportJob | null>): void;
  hydrateMediaSyncJobs(value: MediaSyncJob[]): void;
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
  romFolderEntries: [],
  lastRomImportJob: null,
  mediaSyncJobs: [],
  dataPortabilityJobs: [],
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
  hydrateRomFolderEntries: (romFolderEntries) => set({ romFolderEntries }),
  setRomFolderEntries: (romFolderEntries) => set((state) => {
    const nextEntries = resolveSetterValue(romFolderEntries, state.romFolderEntries);
    void setPersistedRomFolderEntries(nextEntries);
    return { romFolderEntries: nextEntries };
  }),
  hydratePersistedLastRomImportJob: (lastRomImportJob) => set({ lastRomImportJob }),
  setLastRomImportJob: (lastRomImportJob) => set((state) => {
    const nextJob = resolveSetterValue(lastRomImportJob, state.lastRomImportJob);
    void setPersistedLastRomImportJob(nextJob);
    return { lastRomImportJob: nextJob };
  }),
  hydrateRomImportJobs: (jobs) => set((state) => {
    const runningJob = jobs.find((job) => job.status === "running") ?? null;
    const nextJob = runningJob ?? state.lastRomImportJob;
    return { lastRomImportJob: nextJob };
  }),
  updateRomImportProgress: (progress) => set((state) => {
    if (!progress.jobId) return {};
    const nextJob = buildRomImportJobFromProgress(state.lastRomImportJob, progress);
    return { lastRomImportJob: nextJob };
  }),
  completeRomImportJob: (result) => set((state) => {
    if (!result.jobId) return {};
    const nextJob = buildCompletedRomImportJob(state.lastRomImportJob, result);
    void setPersistedLastRomImportJob(nextJob);
    return { lastRomImportJob: nextJob };
  }),
  hydrateMediaSyncJobs: (mediaSyncJobs) => set({ mediaSyncJobs }),
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
    void setPersistedMediaSyncJobs(updated);
    return { mediaSyncJobs: updated };
  }),
  updateMediaSyncProgress: (progress) => set((state) => {
    const running = state.mediaSyncJobs.filter((j) => j.status === "running");
    if (!running.length) return {};
    const target = running.length === 1 ? running[0] : routeProgressToJob(progress, running);
    if (!target) return {};
    const updated = state.mediaSyncJobs.map((j) =>
      j.jobId === target.jobId ? buildMediaJobFromProgress(j, progress) : j
    );
    return { mediaSyncJobs: updated };
  }),
  finishMediaSyncJob: (jobId, result) => set((state) => {
    const current = state.mediaSyncJobs.find((j) => j.jobId === jobId) ?? null;
    const nextJob = buildTerminalMediaJob(current, jobId, {
      title: result.title,
      status: result.status ?? "completed",
      detail: result.detail,
      progressLabel: result.progressLabel,
      failures: result.failures
    });
    const updated = state.mediaSyncJobs.map((j) => j.jobId === jobId ? nextJob : j);
    void setPersistedMediaSyncJobs(updated);
    return { mediaSyncJobs: updated };
  }),
  failMediaSyncJob: (jobId, message) => set((state) => {
    const current = state.mediaSyncJobs.find((j) => j.jobId === jobId) ?? null;
    const nextJob = buildTerminalMediaJob(current, jobId, {
      title: current?.title ? `${current.title} falhou` : "Sincronizacao falhou",
      status: "failed",
      detail: message
    });
    const updated = state.mediaSyncJobs.map((j) => j.jobId === jobId ? nextJob : j);
    void setPersistedMediaSyncJobs(updated);
    return { mediaSyncJobs: updated };
  }),
  dismissMediaSyncJob: (jobId) => set((state) => {
    const updated = state.mediaSyncJobs.filter((j) => j.jobId !== jobId);
    void setPersistedMediaSyncJobs(updated);
    return { mediaSyncJobs: updated };
  }),
  hydrateDataPortabilityJobs: (jobs) => set((state) => {
    const known = new Map(state.dataPortabilityJobs.map((job) => [job.jobId, job]));
    for (const job of jobs) known.set(job.jobId, normalizeDataPortabilityJob(job));
    const updated = Array.from(known.values()).sort((a, b) => timestamp(b.startedAt) - timestamp(a.startedAt));
    return { dataPortabilityJobs: updated };
  }),
  startDataPortabilityJob: (job) => set((state) => {
    const existing = state.dataPortabilityJobs.find((item) => item.jobId === job.jobId);
    const nextJob = existing && existing.progress.current > job.progress.current
      ? { ...job, status: existing.status, progress: existing.progress, exportResult: existing.exportResult, importResult: existing.importResult, error: existing.error }
      : job;
    const updated = upsertDataPortabilityJob(state.dataPortabilityJobs, normalizeDataPortabilityJob(nextJob));
    void setPersistedDataPortabilityJobs(updated);
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
    return { dataPortabilityJobs: updated };
  }),
  completeDataPortabilityJob: (job) => set((state) => {
    const updated = upsertDataPortabilityJob(state.dataPortabilityJobs, normalizeDataPortabilityJob(job));
    void setPersistedDataPortabilityJobs(updated);
    return { dataPortabilityJobs: updated };
  }),
  dismissDataPortabilityJob: (jobId) => set((state) => {
    const updated = state.dataPortabilityJobs.filter((job) => job.jobId !== jobId);
    void setPersistedDataPortabilityJobs(updated);
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
    platformId: previous?.platformId ?? null,
    platformName: previous?.platformName ?? "Biblioteca",
    detectionMode: previous?.detectionMode ?? "manual",
    detectedPlatforms: previous?.detectedPlatforms ?? [],
    includeSubfolders: previous?.includeSubfolders ?? false,
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
    detectionMode: result.detectionMode,
    detectedPlatforms: result.detectedPlatforms,
    includeSubfolders: result.includeSubfolders,
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

function buildTerminalMediaJob(
  current: MediaSyncJob | null,
  jobId: string,
  overrides: {
    title: string;
    status: "completed" | "failed";
    detail?: string;
    progressLabel?: string;
    failures?: CoverSyncFailureItem[];
  }
): MediaSyncJob {
  return {
    jobId,
    title: overrides.title,
    subtitle: current?.subtitle ?? "Biblioteca",
    status: overrides.status,
    detail: overrides.detail ?? current?.detail ?? overrides.title,
    progressLabel: overrides.progressLabel ?? (overrides.status === "failed" ? "Erro" : "Concluído"),
    percent: 100,
    startedAt: current?.startedAt ?? new Date().toISOString(),
    indeterminate: false,
    failures: overrides.failures ?? current?.failures ?? []
  };
}

function upsertDataPortabilityJob(jobs: DataPortabilityJob[], nextJob: DataPortabilityJob): DataPortabilityJob[] {
  return [nextJob, ...jobs.filter((job) => job.jobId !== nextJob.jobId)]
    .sort((a, b) => timestamp(b.startedAt) - timestamp(a.startedAt))
    .slice(0, MAX_PORTABILITY_JOBS);
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

