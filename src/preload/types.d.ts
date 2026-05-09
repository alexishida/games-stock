import type { AppStateEntry } from "../shared/appState";
import {
  CollectionCounts,
  CoverSyncResult,
  CoverSyncStats,
  DataPortabilityExportRequest,
  DataPortabilityJob,
  DataPortabilityProgress,
  DataPortabilityStartResult,
  DataPortabilityImportPreview,
  DataPortabilityImportRequest,
  Emulator,
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
  PlatformEmulator,
  PlatformMappings,
  PlatformMappingsInput,
  RetroArchCoreInventory,
  RomFolderImportJob,
  RomFolderImportProgress,
  RomFolderImportRequest,
  RomFolderImportResult,
  RomFolderRecordCountRequest,
  RomFolderRecordCountResult,
  RomFolderScanRequest,
  RomFolderScanResult,
  ViewMode
} from "../shared/types";

export interface GameStockAPI {
  games: {
    list(filters?: GameFilters): Promise<GameListResult>;
    get(id: number): Promise<Game | null>;
    listMedia(id: number): Promise<GameMediaItem[]>;
    collectionCounts(): Promise<CollectionCounts>;
    coverStats(): Promise<CoverSyncStats>;
    onCoverStatsUpdated(callback: (stats: CoverSyncStats) => void): () => void;
    syncCovers(): Promise<CoverSyncResult>;
    create(data: Partial<GameCreateInput>): Promise<Game>;
    update(id: number, data: GameUpdateInput): Promise<Game>;
    delete(id: number): Promise<{ success: true }>;
    launch(id: number): Promise<{ success: true }>;
  };
  emulators: {
    list(): Promise<Emulator[]>;
    create(data: { name: string; executable: string; args: string; is_retroarch: number }): Promise<Emulator>;
    update(id: number, data: { name?: string; executable?: string; args?: string }): Promise<Emulator>;
    delete(id: number): Promise<{ success: true }>;
    listByPlatform(platformId: number): Promise<PlatformEmulator[]>;
    listRetroArchCores(emulatorId: number): Promise<RetroArchCoreInventory>;
    linkPlatform(emulatorId: number, platformId: number, isDefault: boolean, corePath?: string | null): Promise<PlatformEmulator>;
    unlinkPlatform(emulatorId: number, platformId: number): Promise<{ success: true }>;
  };
  platforms: {
    list(): Promise<Platform[]>;
    create(data: { name: string; category: string }): Promise<Platform>;
    update(id: number, data: { name?: string; category?: string }): Promise<Platform>;
    delete(id: number): Promise<{ success: true }>;
    getMappings(platformId: number): Promise<PlatformMappings>;
    saveMappings(platformId: number, data: PlatformMappingsInput): Promise<PlatformMappings>;
  };
  dialogs: {
    openRomFile(): Promise<string | null>;
    openRomFiles(): Promise<string[]>;
    openImageFile(): Promise<string | null>;
    saveImageFile(sourcePath: string, suggestedName: string): Promise<{ canceled: boolean; path: string | null }>;
    openRomFolder(): Promise<string | null>;
    openRomFolders(): Promise<string[]>;
    openExecutableFile(): Promise<string | null>;
    openAnyFile(): Promise<string | null>;
  };
  shell: {
    openPath(path: string): Promise<string>;
  };
  app: {
    getVersion(): Promise<string>;
    getStorageStats(): Promise<{ totalGames: number; dataDirSizeMb: number; dataDirPath: string }>;
  };
  appState: {
    get<T>(key: string): Promise<T | null>;
    getMany(keys: string[]): Promise<Record<string, unknown>>;
    set(key: string, value: unknown): Promise<void>;
    setMany(entries: AppStateEntry[], onlyIfMissing?: boolean): Promise<void>;
    remove(key: string): Promise<void>;
  };
  dataPortability: {
    exportPackage(request: DataPortabilityExportRequest): Promise<DataPortabilityStartResult>;
    previewImport(packagePath: string): Promise<DataPortabilityImportPreview>;
    importPackage(request: DataPortabilityImportRequest): Promise<DataPortabilityJob>;
    jobs(): Promise<DataPortabilityJob[]>;
    onProgress(callback: (progress: DataPortabilityProgress) => void): () => void;
    onCompleted(callback: (job: DataPortabilityJob) => void): () => void;
  };
  launchbox: {
    ensureMetadata(options?: { force?: boolean }): Promise<{ status: "cached" | "downloaded" }>;
    metadataExists(): Promise<boolean>;
    searchGames(params: LaunchBoxSearchParams): Promise<LaunchBoxGame[]>;
    downloadImages(params: LaunchBoxDownloadParams): Promise<LaunchBoxDownloadResult>;
    importGame(params: LaunchBoxImportParams): Promise<LaunchBoxImportResult>;
    onProgress(callback: (progress: LaunchBoxProgress) => void): () => void;
    onOpenImporter(callback: () => void): () => void;
  };
  romFolderImport: {
    scan(params: RomFolderScanRequest): Promise<RomFolderScanResult>;
    import(params: RomFolderImportRequest): Promise<RomFolderImportJob>;
    jobs(): Promise<RomFolderImportJob[]>;
    countFolderRecords(params: RomFolderRecordCountRequest[]): Promise<RomFolderRecordCountResult[]>;
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
