import { create } from "zustand";
import {
  CollectionCounts,
  CollectionFilter,
  CoverSyncStats,
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

export type SettingsSection = "biblioteca" | "plataformas" | "covers" | "emuladores";

const LAST_ROM_IMPORT_JOB_KEY = "gamestock.media.lastRomImportJob";
const LAST_MEDIA_SYNC_JOB_KEY = "gamestock.media.lastMediaSyncJob";

type SetterValue<T> = T | ((current: T) => T);

export interface MediaSyncJob {
  jobId: string;
  title: string;
  subtitle: string;
  status: "running" | "completed" | "failed";
  detail: string;
  progressLabel: string;
  percent: number;
  startedAt: string;
  indeterminate?: boolean;
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
  lastMediaSyncJob: MediaSyncJob | null;
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
  settingsSection: "biblioteca",
  createGameOpen: false,
  reloadToken: 0,
  platformsReloadToken: 0,
  collectionCounts: { favorites: 0, playing: 0, completed: 0 },
  lastRomImportJob: loadSavedRomImportJob(),
  lastMediaSyncJob: loadSavedMediaSyncJob(),
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
  startMediaSyncJob: (job) => set(() => {
    const nextJob: MediaSyncJob = {
      jobId: job.jobId,
      title: job.title,
      subtitle: job.subtitle ?? "Biblioteca",
      status: "running",
      detail: job.detail ?? "Preparando",
      progressLabel: job.progressLabel ?? "Iniciando",
      percent: job.percent ?? 0,
      startedAt: job.startedAt ?? new Date().toISOString(),
      indeterminate: job.indeterminate
    };
    persistFinishedJob(LAST_MEDIA_SYNC_JOB_KEY, nextJob);
    return { lastMediaSyncJob: nextJob };
  }),
  updateMediaSyncProgress: (progress) => set((state) => {
    if (!state.lastMediaSyncJob || state.lastMediaSyncJob.status !== "running") return {};
    const nextJob = buildMediaJobFromProgress(state.lastMediaSyncJob, progress);
    persistFinishedJob(LAST_MEDIA_SYNC_JOB_KEY, nextJob);
    return { lastMediaSyncJob: nextJob };
  }),
  finishMediaSyncJob: (jobId, result) => set((state) => {
    const current = state.lastMediaSyncJob?.jobId === jobId ? state.lastMediaSyncJob : null;
    const nextJob: MediaSyncJob = {
      jobId,
      title: result.title,
      subtitle: current?.subtitle ?? "Biblioteca",
      status: result.status ?? "completed",
      detail: result.detail ?? current?.detail ?? result.title,
      progressLabel: result.progressLabel ?? (result.status === "failed" ? "Erro" : "Concluido"),
      percent: 100,
      startedAt: current?.startedAt ?? new Date().toISOString(),
      indeterminate: false
    };
    persistFinishedJob(LAST_MEDIA_SYNC_JOB_KEY, nextJob);
    return { lastMediaSyncJob: nextJob };
  }),
  failMediaSyncJob: (jobId, message) => set((state) => {
    const current = state.lastMediaSyncJob?.jobId === jobId ? state.lastMediaSyncJob : null;
    const nextJob: MediaSyncJob = {
      jobId,
      title: current?.title ? `${current.title} falhou` : "Sincronizacao falhou",
      subtitle: current?.subtitle ?? "Biblioteca",
      status: "failed",
      detail: message,
      progressLabel: "Erro",
      percent: 100,
      startedAt: current?.startedAt ?? new Date().toISOString(),
      indeterminate: false
    };
    persistFinishedJob(LAST_MEDIA_SYNC_JOB_KEY, nextJob);
    return { lastMediaSyncJob: nextJob };
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
  if (progress.status === "indexing") return "Construindo indice";
  return progress.filename ?? fallback;
}

function mediaProgressLabel(progress: LaunchBoxProgress): string {
  if (progress.status === "extracting") return "Extraindo";
  if (progress.status === "indexing") return "Construindo indice";
  if (progress.status === "done") return "Concluido";
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

function persistFinishedJob<T extends { status: "running" | "completed" | "failed" }>(key: string, job: T | null): void {
  try {
    if (typeof window === "undefined") return;
    if (!job || job.status === "running") {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(job));
  } catch {
    // Local persistence is best effort; runtime state remains source of truth.
  }
}

function loadSavedRomImportJob(): RomFolderImportJob | null {
  return loadSavedJob<RomFolderImportJob>(LAST_ROM_IMPORT_JOB_KEY, isRomImportJob);
}

function loadSavedMediaSyncJob(): MediaSyncJob | null {
  return loadSavedJob<MediaSyncJob>(LAST_MEDIA_SYNC_JOB_KEY, isMediaSyncJob);
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

function timestamp(value: string | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}
