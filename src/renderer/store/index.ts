import { create } from "zustand";
import { Game, GameListResult, Platform, ViewMode } from "../../shared/types";

interface GameStockState {
  selectedPlatformId: number | null;
  searchQuery: string;
  selectedCategory: string;
  viewMode: ViewMode;
  onlyPhysical: boolean;
  games: Game[];
  total: number;
  filtered: number;
  platforms: Platform[];
  loading: boolean;
  selectedGameId: number | null;
  importerOpen: boolean;
  reloadToken: number;
  setSelectedPlatformId(value: number | null): void;
  setSearchQuery(value: string): void;
  setSelectedCategory(value: string): void;
  setViewMode(value: ViewMode): void;
  setOnlyPhysical(value: boolean): void;
  setGames(value: GameListResult): void;
  setPlatforms(value: Platform[]): void;
  setLoading(value: boolean): void;
  setSelectedGameId(value: number | null): void;
  setImporterOpen(value: boolean): void;
  reloadGames(): void;
}

export const useGameStockStore = create<GameStockState>((set) => ({
  selectedPlatformId: null,
  searchQuery: "",
  selectedCategory: "",
  viewMode: "grid",
  onlyPhysical: false,
  games: [],
  total: 0,
  filtered: 0,
  platforms: [],
  loading: false,
  selectedGameId: null,
  importerOpen: false,
  reloadToken: 0,
  setSelectedPlatformId: (selectedPlatformId) => set({ selectedPlatformId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setViewMode: (viewMode) => set({ viewMode }),
  setOnlyPhysical: (onlyPhysical) => set({ onlyPhysical }),
  setGames: ({ items, total, filtered }) => set({ games: items, total, filtered }),
  setPlatforms: (platforms) => set({ platforms }),
  setLoading: (loading) => set({ loading }),
  setSelectedGameId: (selectedGameId) => set({ selectedGameId }),
  setImporterOpen: (importerOpen) => set({ importerOpen }),
  reloadGames: () => set((state) => ({ reloadToken: state.reloadToken + 1 }))
}));
