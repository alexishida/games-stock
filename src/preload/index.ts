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
  ViewMode
} from "../shared/types";

const api = {
  games: {
    list: (filters?: GameFilters) => ipcRenderer.invoke(IPC_CHANNELS.games.list, filters),
    get: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.games.get, id),
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
    openImageFile: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openImageFile)
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
  view: {
    onSet: (callback: (mode: ViewMode) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, mode: ViewMode) => callback(mode);
      ipcRenderer.on("view:set", listener);
      return () => ipcRenderer.removeListener("view:set", listener);
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
