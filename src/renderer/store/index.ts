import { create } from "zustand";
import { CollectionFilter, Game, GameListResult, GameSortBy, Platform, ViewMode } from "../../shared/types";

interface GameStockState {
  selectedPlatformId: number | null;
  searchQuery: string;
  selectedCategory: string;
  viewMode: ViewMode;
  collectionFilter: CollectionFilter;
  sortBy: GameSortBy;
  onlyPhysical: boolean;
  games: Game[];
  total: number;
  filtered: number;
  currentPage: number;
  platforms: Platform[];
  loading: boolean;
  selectedGameId: number | null;
  importerOpen: boolean;
  romFolderImporterOpen: boolean;
  createGameOpen: boolean;
  platformManagerOpen: boolean;
  reloadToken: number;
  platformsReloadToken: number;
  setSelectedPlatformId(value: number | null): void;
  setSearchQuery(value: string): void;
  setSelectedCategory(value: string): void;
  setViewMode(value: ViewMode): void;
  setCollectionFilter(value: CollectionFilter): void;
  setSortBy(value: GameSortBy): void;
  setOnlyPhysical(value: boolean): void;
  setCurrentPage(value: number): void;
  setGames(value: GameListResult): void;
  setPlatforms(value: Platform[]): void;
  setLoading(value: boolean): void;
  setSelectedGameId(value: number | null): void;
  setImporterOpen(value: boolean): void;
  setRomFolderImporterOpen(value: boolean): void;
  setCreateGameOpen(value: boolean): void;
  setPlatformManagerOpen(value: boolean): void;
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
  onlyPhysical: false,
  games: [],
  total: 0,
  filtered: 0,
  currentPage: 1,
  platforms: [],
  loading: false,
  selectedGameId: null,
  importerOpen: false,
  romFolderImporterOpen: false,
  createGameOpen: false,
  platformManagerOpen: false,
  reloadToken: 0,
  platformsReloadToken: 0,
  setSelectedPlatformId: (selectedPlatformId) => set({ selectedPlatformId, currentPage: 1, selectedGameId: null }),
  setSearchQuery: (searchQuery) => set({ searchQuery, currentPage: 1 }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory, currentPage: 1 }),
  setViewMode: (viewMode) => set({ viewMode }),
  setCollectionFilter: (collectionFilter) => set({ collectionFilter, currentPage: 1 }),
  setSortBy: (sortBy) => set({ sortBy, currentPage: 1 }),
  setOnlyPhysical: (onlyPhysical) => set({ onlyPhysical, currentPage: 1 }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setGames: ({ items, total, filtered }) => set({ games: items, total, filtered }),
  setPlatforms: (platforms) => set({ platforms }),
  setLoading: (loading) => set({ loading }),
  setSelectedGameId: (selectedGameId) => set({ selectedGameId }),
  setImporterOpen: (importerOpen) => set({ importerOpen }),
  setRomFolderImporterOpen: (romFolderImporterOpen) => set({ romFolderImporterOpen }),
  setCreateGameOpen: (createGameOpen) => set({ createGameOpen }),
  setPlatformManagerOpen: (platformManagerOpen) => set({ platformManagerOpen }),
  reloadGames: () => set((state) => ({ reloadToken: state.reloadToken + 1 })),
  reloadPlatforms: () => set((state) => ({ platformsReloadToken: state.platformsReloadToken + 1 }))
}));
