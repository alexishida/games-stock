import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../shared/ipc-channels";
import {
  GameCreateInput,
  GameFilters,
  GameUpdateInput,
  LaunchBoxDownloadParams,
  LaunchBoxImportParams,
  LaunchBoxProgress,
  LaunchBoxSearchParams,
  GameSortBy,
  RomFolderImportProgress,
  RomFolderImportRequest,
  RomFolderImportResult,
  RomFolderScanRequest,
  ViewMode
} from "../shared/types";

const api = {
  games: {
    list: (filters?: GameFilters) => ipcRenderer.invoke(IPC_CHANNELS.games.list, filters),
    get: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.games.get, id),
    listMedia: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.games.listMedia, id),
    create: (data: Partial<GameCreateInput>) => ipcRenderer.invoke(IPC_CHANNELS.games.create, data),
    update: (id: number, data: GameUpdateInput) => ipcRenderer.invoke(IPC_CHANNELS.games.update, id, data),
    delete: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.games.delete, id)
  },
  platforms: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.platforms.list),
    create: (data: { name: string; category: string }) => ipcRenderer.invoke(IPC_CHANNELS.platforms.create, data),
    update: (id: number, data: { name?: string; category?: string }) => ipcRenderer.invoke(IPC_CHANNELS.platforms.update, id, data),
    delete: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.platforms.delete, id)
  },
  dialogs: {
    openRomFile: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openRomFile),
    openRomFiles: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openRomFiles),
    openImageFile: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openImageFile),
    saveImageFile: (sourcePath: string, suggestedName: string) => ipcRenderer.invoke(IPC_CHANNELS.dialogs.saveImageFile, sourcePath, suggestedName),
    openRomFolder: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openRomFolder),
    openRomFolders: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openRomFolders)
  },
  shell: {
    openPath: (targetPath: string) => ipcRenderer.invoke(IPC_CHANNELS.shell.openPath, targetPath)
  },
  launchbox: {
    ensureMetadata: (options?: { force?: boolean }) => ipcRenderer.invoke(IPC_CHANNELS.launchbox.ensureMetadata, options),
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
