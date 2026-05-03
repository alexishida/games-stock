import {
  Game,
  GameCreateInput,
  GameFilters,
  GameListResult,
  GameMediaItem,
  GameSortBy,
  GameUpdateInput,
  LaunchBoxDownloadParams,
  LaunchBoxDownloadResult,
  LaunchBoxGame,
  LaunchBoxImportParams,
  LaunchBoxImportResult,
  LaunchBoxProgress,
  LaunchBoxSearchParams,
  Platform,
  RomFolderImportJob,
  RomFolderImportProgress,
  RomFolderImportRequest,
  RomFolderImportResult,
  RomFolderScanRequest,
  RomFolderScanResult,
  ViewMode
} from "../shared/types";

export interface GameStockAPI {
  games: {
    list(filters?: GameFilters): Promise<GameListResult>;
    get(id: number): Promise<Game | null>;
    listMedia(id: number): Promise<GameMediaItem[]>;
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
    openRomFiles(): Promise<string[]>;
    openImageFile(): Promise<string | null>;
    openRomFolder(): Promise<string | null>;
    openRomFolders(): Promise<string[]>;
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
  romFolderImport: {
    scan(params: RomFolderScanRequest): Promise<RomFolderScanResult>;
    import(params: RomFolderImportRequest): Promise<RomFolderImportJob>;
    deleteFolderRecords(params: string | { folderPath: string; platformId?: number }): Promise<{ success: true; deleted: number }>;
    onProgress(callback: (progress: RomFolderImportProgress) => void): () => void;
    onCompleted(callback: (result: RomFolderImportResult) => void): () => void;
    onOpenImporter(callback: () => void): () => void;
  };
  view: {
    onSet(callback: (mode: ViewMode) => void): () => void;
  };
  library: {
    onOpenCreateGame(callback: () => void): () => void;
    onOpenPlatformManager(callback: () => void): () => void;
    onSetSort(callback: (sortBy: GameSortBy) => void): () => void;
  };
}

declare global {
  interface Window {
    gameStockAPI: GameStockAPI;
  }
}
