import {
  Game,
  GameCreateInput,
  GameFilters,
  GameListResult,
  GameUpdateInput,
  LaunchBoxDownloadParams,
  LaunchBoxDownloadResult,
  LaunchBoxGame,
  LaunchBoxImportParams,
  LaunchBoxImportResult,
  LaunchBoxProgress,
  LaunchBoxSearchParams,
  Platform,
  ViewMode
} from "../shared/types";

export interface GameStockAPI {
  games: {
    list(filters?: GameFilters): Promise<GameListResult>;
    get(id: number): Promise<Game | null>;
    create(data: Partial<GameCreateInput>): Promise<Game>;
    update(id: number, data: GameUpdateInput): Promise<Game>;
    delete(id: number): Promise<{ success: true }>;
  };
  platforms: {
    list(): Promise<Platform[]>;
    create(data: { name: string; category: string }): Promise<Platform>;
    update(id: number, data: { name?: string; category?: string }): Promise<Platform>;
    delete(id: number): Promise<{ success: true }>;
  };
  dialogs: {
    openRomFile(): Promise<string | null>;
    openImageFile(): Promise<string | null>;
  };
  shell: {
    openPath(path: string): Promise<string>;
  };
  launchbox: {
    ensureMetadata(options?: { force?: boolean }): Promise<{ status: "cached" | "downloaded" }>;
    searchGames(params: LaunchBoxSearchParams): Promise<LaunchBoxGame[]>;
    downloadImages(params: LaunchBoxDownloadParams): Promise<LaunchBoxDownloadResult>;
    importGame(params: LaunchBoxImportParams): Promise<LaunchBoxImportResult>;
    onProgress(callback: (progress: LaunchBoxProgress) => void): () => void;
    onOpenImporter(callback: () => void): () => void;
  };
  view: {
    onSet(callback: (mode: ViewMode) => void): () => void;
  };
}

declare global {
  interface Window {
    gameStockAPI: GameStockAPI;
  }
}
