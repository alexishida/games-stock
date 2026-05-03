import { create } from "zustand";
import { CollectionCounts, CollectionFilter, CoverSyncStats, Game, GameListResult, GameSortBy, Platform, RomFolderImportJob, ViewMode } from "../../shared/types";

export type SettingsSection = "biblioteca" | "plataformas" | "covers" | "emuladores";
const LAST_ROM_IMPORT_JOB_KEY = "gamestock.media.lastRomImportJob";
const LAST_MEDIA_SYNC_JOB_KEY = "gamestock.media.lastMediaSyncJob";

export interface MediaSyncJob {
  jobId: string;
  title: string;
  subtitle: string;
  status: "running" | "completed" | "failed";
  detail: string;
  progressLabel: string;
  percent: number;
  startedAt: string;
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
  setImporterOpen(value: boolean): void;
  setSettingsOpen(value: boolean): void;
  setSettingsSection(value: SettingsSection): void;
  openSettings(section: SettingsSection): void;
  setCreateGameOpen(value: boolean): void;
  setCollectionCounts(value: CollectionCounts): void;
  setLastRomImportJob(value: RomFolderImportJob | null | ((current: RomFolderImportJob | null) => RomFolderImportJob | null)): void;
  setLastMediaSyncJob(value: MediaSyncJob | null | ((current: MediaSyncJob | null) => MediaSyncJob | null)): void;
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
  setSelectedPlatformId: (selectedPlatformId) => set({ selectedPlatformId, collectionFilter: "all", currentPage: 1, selectedGameId: null }),
  setSearchQuery: (searchQuery) => set({ searchQuery, currentPage: 1 }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory, currentPage: 1 }),
  setViewMode: (viewMode) => set({ viewMode }),
  setCollectionFilter: (collectionFilter) => set({ collectionFilter, selectedPlatformId: null, currentPage: 1, selectedGameId: null }),
  setSortBy: (sortBy) => set({ sortBy, currentPage: 1 }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setGames: ({ items, total, filtered }) => set({ games: items, total, filtered }),
  setPlatforms: (platforms) => set({ platforms }),
  setLoading: (loading) => set({ loading }),
  setSelectedGameId: (selectedGameId) => set({ selectedGameId }),
  setImporterOpen: (importerOpen) => set({ importerOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setSettingsSection: (settingsSection) => set({ settingsSection }),
  openSettings: (settingsSection) => set({ settingsOpen: true, settingsSection }),
  setCreateGameOpen: (createGameOpen) => set({ createGameOpen }),
  setCollectionCounts: (collectionCounts) => set({ collectionCounts }),
  setLastRomImportJob: (lastRomImportJob) => set((state) => ({
    lastRomImportJob: typeof lastRomImportJob === "function" ? lastRomImportJob(state.lastRomImportJob) : lastRomImportJob
  })),
  setLastMediaSyncJob: (lastMediaSyncJob) => set((state) => ({
    lastMediaSyncJob: typeof lastMediaSyncJob === "function" ? lastMediaSyncJob(state.lastMediaSyncJob) : lastMediaSyncJob
  })),
  setMetadataStartupRunning: (metadataStartupRunning) => set({ metadataStartupRunning }),
  setCoverStats: (coverStats) => set({ coverStats }),
  reloadGames: () => set((state) => ({ reloadToken: state.reloadToken + 1 })),
  reloadPlatforms: () => set((state) => ({ platformsReloadToken: state.platformsReloadToken + 1 }))
}));

function loadSavedRomImportJob(): RomFolderImportJob | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LAST_ROM_IMPORT_JOB_KEY) ?? "null") as RomFolderImportJob | null;
    return parsed?.jobId ? parsed : null;
  } catch {
    return null;
  }
}

function loadSavedMediaSyncJob(): MediaSyncJob | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LAST_MEDIA_SYNC_JOB_KEY) ?? "null") as MediaSyncJob | null;
    return parsed?.jobId ? parsed : null;
  } catch {
    return null;
  }
}
