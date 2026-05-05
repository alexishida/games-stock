import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../shared/ipc-channels";
import {
  CoverSyncStats,
  GameCreateInput,
  GameFilters,
  GameUpdateInput,
  PlatformMappings,
  PlatformMappingsInput,
  LaunchBoxDownloadParams,
  LaunchBoxImportParams,
  LaunchBoxProgress,
  LaunchBoxSearchParams,
  GameSortBy,
  RomFolderImportProgress,
  RomFolderImportRequest,
  RomFolderImportResult,
  RomFolderRecordCountRequest,
  RomFolderScanRequest,
  ViewMode
} from "../shared/types";

const api = {
  games: {
    list: (filters?: GameFilters) => ipcRenderer.invoke(IPC_CHANNELS.games.list, filters),
    get: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.games.get, id),
    listMedia: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.games.listMedia, id),
    collectionCounts: () => ipcRenderer.invoke(IPC_CHANNELS.games.collectionCounts),
    coverStats: () => ipcRenderer.invoke(IPC_CHANNELS.games.coverStats),
    onCoverStatsUpdated: (callback: (stats: CoverSyncStats) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, stats: CoverSyncStats) => callback(stats);
      ipcRenderer.on(IPC_CHANNELS.games.coverStatsUpdated, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.games.coverStatsUpdated, listener);
    },
    syncCovers: () => ipcRenderer.invoke(IPC_CHANNELS.games.syncCovers),
    create: (data: Partial<GameCreateInput>) => ipcRenderer.invoke(IPC_CHANNELS.games.create, data),
    update: (id: number, data: GameUpdateInput) => ipcRenderer.invoke(IPC_CHANNELS.games.update, id, data),
    delete: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.games.delete, id),
    launch: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.games.launch, id)
  },
  emulators: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.emulators.list),
    create: (data: { name: string; executable: string; args: string; is_retroarch: number }) =>
      ipcRenderer.invoke(IPC_CHANNELS.emulators.create, data),
    update: (id: number, data: { name?: string; executable?: string; args?: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.emulators.update, id, data),
    delete: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.emulators.delete, id),
    listByPlatform: (platformId: number) => ipcRenderer.invoke(IPC_CHANNELS.emulators.listByPlatform, platformId),
    listRetroArchCores: (emulatorId: number) => ipcRenderer.invoke(IPC_CHANNELS.emulators.listRetroArchCores, emulatorId),
    linkPlatform: (emulatorId: number, platformId: number, isDefault: boolean, corePath?: string | null) =>
      ipcRenderer.invoke(IPC_CHANNELS.emulators.linkPlatform, emulatorId, platformId, isDefault, corePath),
    unlinkPlatform: (emulatorId: number, platformId: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.emulators.unlinkPlatform, emulatorId, platformId)
  },
  platforms: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.platforms.list),
    create: (data: { name: string; category: string }) => ipcRenderer.invoke(IPC_CHANNELS.platforms.create, data),
    update: (id: number, data: { name?: string; category?: string }) => ipcRenderer.invoke(IPC_CHANNELS.platforms.update, id, data),
    delete: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.platforms.delete, id),
    getMappings: (platformId: number) => ipcRenderer.invoke(IPC_CHANNELS.platforms.getMappings, platformId) as Promise<PlatformMappings>,
    saveMappings: (platformId: number, data: PlatformMappingsInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.platforms.saveMappings, platformId, data) as Promise<PlatformMappings>
  },
  dialogs: {
    openRomFile: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openRomFile),
    openRomFiles: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openRomFiles),
    openImageFile: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openImageFile),
    saveImageFile: (sourcePath: string, suggestedName: string) => ipcRenderer.invoke(IPC_CHANNELS.dialogs.saveImageFile, sourcePath, suggestedName),
    openRomFolder: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openRomFolder),
    openRomFolders: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openRomFolders),
    openExecutableFile: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openExecutableFile),
    openAnyFile: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openAnyFile)
  },
  shell: {
    openPath: (targetPath: string) => ipcRenderer.invoke(IPC_CHANNELS.shell.openPath, targetPath)
  },
  app: {
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.app.getVersion) as Promise<string>,
    getStorageStats: () => ipcRenderer.invoke(IPC_CHANNELS.app.getStorageStats) as Promise<{ totalGames: number; dataDirSizeMb: number; dataDirPath: string }>
  },
  launchbox: {
    ensureMetadata: (options?: { force?: boolean }) => ipcRenderer.invoke(IPC_CHANNELS.launchbox.ensureMetadata, options),
    metadataExists: () => ipcRenderer.invoke(IPC_CHANNELS.launchbox.metadataExists) as Promise<boolean>,
    searchGames: (params: LaunchBoxSearchParams) => ipcRenderer.invoke(IPC_CHANNELS.launchbox.searchGames, params),
    downloadImages: (params: LaunchBoxDownloadParams) => ipcRenderer.invoke(IPC_CHANNELS.launchbox.downloadImages, params),
    importGame: (params: LaunchBoxImportParams) => ipcRenderer.invoke(IPC_CHANNELS.launchbox.importGame, params),
    onProgress: (callback: (progress: LaunchBoxProgress) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: LaunchBoxProgress) => callback(progress);
      ipcRenderer.on(IPC_CHANNELS.launchbox.progress, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.launchbox.progress, listener);
    },
    onOpenImporter: (callback: () => void) => {
      ipcRenderer.on(IPC_CHANNELS.launchbox.openImporter, callback);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.launchbox.openImporter, callback);
    }
  },
  romFolderImport: {
    scan: (params: RomFolderScanRequest) => ipcRenderer.invoke(IPC_CHANNELS.romFolderImport.scan, params),
    import: (params: RomFolderImportRequest) => ipcRenderer.invoke(IPC_CHANNELS.romFolderImport.import, params),
    jobs: () => ipcRenderer.invoke(IPC_CHANNELS.romFolderImport.jobs),
    countFolderRecords: (params: RomFolderRecordCountRequest[]) => ipcRenderer.invoke(IPC_CHANNELS.romFolderImport.countFolderRecords, params),
    deleteFolderRecords: (params: string | { folderPath: string; platformId?: number }) => ipcRenderer.invoke(IPC_CHANNELS.romFolderImport.deleteFolderRecords, params),
    onProgress: (callback: (progress: RomFolderImportProgress) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: RomFolderImportProgress) => callback(progress);
      ipcRenderer.on(IPC_CHANNELS.romFolderImport.progress, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.romFolderImport.progress, listener);
    },
    onCompleted: (callback: (result: RomFolderImportResult) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, result: RomFolderImportResult) => callback(result);
      ipcRenderer.on(IPC_CHANNELS.romFolderImport.completed, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.romFolderImport.completed, listener);
    },
    onOpenImporter: (callback: () => void) => {
      ipcRenderer.on(IPC_CHANNELS.romFolderImport.openImporter, callback);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.romFolderImport.openImporter, callback);
    }
  },
  view: {
    onSet: (callback: (mode: ViewMode) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, mode: ViewMode) => callback(mode);
      ipcRenderer.on(IPC_CHANNELS.view.set, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.view.set, listener);
    }
  },
  library: {
    onOpenCreateGame: (callback: () => void) => {
      ipcRenderer.on(IPC_CHANNELS.library.openCreateGame, callback);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.library.openCreateGame, callback);
    },
    onOpenPlatformManager: (callback: () => void) => {
      ipcRenderer.on(IPC_CHANNELS.library.openPlatformManager, callback);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.library.openPlatformManager, callback);
    },
    onSetSort: (callback: (sortBy: GameSortBy) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, sortBy: GameSortBy) => callback(sortBy);
      ipcRenderer.on(IPC_CHANNELS.library.setSort, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.library.setSort, listener);
    }
  }
};

contextBridge.exposeInMainWorld("gameStockAPI", api);
