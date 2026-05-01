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
  platforms: Platform[];
  loading: boolean;
  selectedGameId: number | null;
  importerOpen: boolean;
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
  setGames(value: GameListResult): void;
  setPlatforms(value: Platform[]): void;
  setLoading(value: boolean): void;
  setSelectedGameId(value: number | null): void;
  setImporterOpen(value: boolean): void;
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
  platforms: [],
  loading: false,
  selectedGameId: null,
  importerOpen: false,
  createGameOpen: false,
  platformManagerOpen: false,
  reloadToken: 0,
  platformsReloadToken: 0,
  setSelectedPlatformId: (selectedPlatformId) => set({ selectedPlatformId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setViewMode: (viewMode) => set({ viewMode }),
  setCollectionFilter: (collectionFilter) => set({ collectionFilter }),
  setSortBy: (sortBy) => set({ sortBy }),
  setOnlyPhysical: (onlyPhysical) => set({ onlyPhysical }),
  setGames: ({ items, total, filtered }) => set({ games: items, total, filtered }),
  setPlatforms: (platforms) => set({ platforms }),
  setLoading: (loading) => set({ loading }),
  setSelectedGameId: (selectedGameId) => set({ selectedGameId }),
  setImporterOpen: (importerOpen) => set({ importerOpen }),
  setCreateGameOpen: (createGameOpen) => set({ createGameOpen }),
  setPlatformManagerOpen: (platformManagerOpen) => set({ platformManagerOpen }),
  reloadGames: () => set((state) => ({ reloadToken: state.reloadToken + 1 })),
  reloadPlatforms: () => set((state) => ({ platformsReloadToken: state.platformsReloadToken + 1 }))
}));
