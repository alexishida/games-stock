import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { closeDatabase, getDatabase, getImagesDir, getUserDataDir } from "./database";
import * as games from "./repositories/games";
import * as platforms from "./repositories/platforms";
import { ensureLaunchBoxMetadata, importGame, searchGames, downloadLaunchBoxImages } from "./launchbox";
import { IPC_CHANNELS } from "../shared/ipc-channels";
import { GameCreateInput, GameSortBy, GameUpdateInput, LaunchBoxDownloadParams, LaunchBoxImportParams, LaunchBoxProgress } from "../shared/types";

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

protocol.registerSchemesAsPrivileged([
  {
    scheme: "gamestock-media",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true
    }
  }
]);

function getBoundsFile(): string {
  return path.join(getUserDataDir(), "window-bounds.json");
}

function loadBounds(): Electron.Rectangle {
  try {
    return JSON.parse(fs.readFileSync(getBoundsFile(), "utf8")) as Electron.Rectangle;
  } catch {
    return { width: 1280, height: 800, x: undefined as never, y: undefined as never };
  }
}

async function createWindow(): Promise<void> {
  getDatabase();
  const bounds = loadBounds();
  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 1024,
    minHeight: 768,
    title: "GameStock",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, "../preload/index.js")
    }
  });

  mainWindow.on("close", () => {
    if (!mainWindow) return;
    fs.mkdirSync(getUserDataDir(), { recursive: true });
    fs.writeFileSync(getBoundsFile(), JSON.stringify(mainWindow.getBounds()), "utf8");
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (process.platform !== "darwin" && !isQuitting) {
      app.quit();
    }
  });

  if (process.env.VITE_DEV_SERVER_URL || !app.isPackaged) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173");
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.games.list, (_event, filters) => games.listGames(filters));
  ipcMain.handle(IPC_CHANNELS.games.get, (_event, id: number) => games.getGame(id));
  ipcMain.handle(IPC_CHANNELS.games.create, (_event, data: Partial<GameCreateInput>) => games.createGame(data));
  ipcMain.handle(IPC_CHANNELS.games.update, (_event, id: number, data: GameUpdateInput) => games.updateGame(id, data));
  ipcMain.handle(IPC_CHANNELS.games.delete, (_event, id: number) => games.deleteGame(id));

  ipcMain.handle(IPC_CHANNELS.platforms.list, () => platforms.listPlatforms());
  ipcMain.handle(IPC_CHANNELS.platforms.create, (_event, data: platforms.PlatformInput) => platforms.createPlatform(data));
  ipcMain.handle(IPC_CHANNELS.platforms.update, (_event, id: number, data: Partial<platforms.PlatformInput>) => platforms.updatePlatform(id, data));
  ipcMain.handle(IPC_CHANNELS.platforms.delete, (_event, id: number) => platforms.deletePlatform(id));

  ipcMain.handle(IPC_CHANNELS.dialogs.openRomFile, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile"],
      filters: [{ name: "ROMs", extensions: ["zip", "rom", "bin", "iso", "img", "cue", "nes", "snes", "smd", "md", "n64", "z64", "v64", "gb", "gbc", "gba"] }]
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.dialogs.openImageFile, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const source = result.filePaths[0];
    const dest = path.join(getImagesDir(), `${Date.now()}${path.extname(source)}`);
    fs.copyFileSync(source, dest);
    return dest;
  });

  ipcMain.handle(IPC_CHANNELS.shell.openPath, (_event, targetPath: string) => shell.openPath(targetPath));

  ipcMain.handle(IPC_CHANNELS.launchbox.ensureMetadata, (_event, options?: { force?: boolean }) =>
    ensureLaunchBoxMetadata(Boolean(options?.force), sendLaunchBoxProgress)
  );
  ipcMain.handle(IPC_CHANNELS.launchbox.searchGames, (_event, params) => searchGames(params));
  ipcMain.handle(IPC_CHANNELS.launchbox.downloadImages, (_event, params: LaunchBoxDownloadParams) =>
    downloadLaunchBoxImages(params, sendLaunchBoxProgress)
  );
  ipcMain.handle(IPC_CHANNELS.launchbox.importGame, (_event, params: LaunchBoxImportParams) => importGame(params, sendLaunchBoxProgress));
}

function sendLaunchBoxProgress(progress: LaunchBoxProgress): void {
  mainWindow?.webContents.send(IPC_CHANNELS.launchbox.progress, progress);
}

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "MENU",
      submenu: [
        { label: "Importar Jogos", click: () => mainWindow?.webContents.send(IPC_CHANNELS.launchbox.openImporter) },
        { label: "Novo Jogo Manual", click: () => mainWindow?.webContents.send(IPC_CHANNELS.library.openCreateGame) },
        { label: "Gerenciar Plataformas", click: () => mainWindow?.webContents.send(IPC_CHANNELS.library.openPlatformManager) },
        { label: "Configuracoes", enabled: false },
        { type: "separator" },
        { label: "Sair", role: "quit" }
      ]
    },
    {
      label: "FERRAMENTAS",
      submenu: [{ label: "Importar do LaunchBox", click: () => mainWindow?.webContents.send(IPC_CHANNELS.launchbox.openImporter) }]
    },
    {
      label: "VISUALIZACAO",
      submenu: [
        { label: "Grade", click: () => mainWindow?.webContents.send("view:set", "grid") },
        { label: "Lista", click: () => mainWindow?.webContents.send("view:set", "list") }
      ]
    },
    {
      label: "ORGANIZADO POR",
      submenu: [
        { label: "Titulo", click: () => sendSort("title") },
        { label: "Ano", click: () => sendSort("year") },
        { label: "Recentes", click: () => sendSort("recent") }
      ]
    },
    { label: "GRUPO DE IMAGENS", submenu: [{ label: "Box Art", enabled: false }] },
    { label: "EMBLEMAS", submenu: [{ label: "Fisicos", enabled: false }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function sendSort(sortBy: GameSortBy): void {
  mainWindow?.webContents.send(IPC_CHANNELS.library.setSort, sortBy);
}

app.whenReady().then(() => {
  registerMediaProtocol();
  registerIpc();
  createMenu();
  void createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});

app.on("window-all-closed", () => {
  closeDatabase();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  closeDatabase();
});

function registerMediaProtocol(): void {
  protocol.handle("gamestock-media", (request) => {
    const filePath = new URL(request.url).searchParams.get("path");
    if (!filePath) return new Response("Missing path", { status: 400 });

    const normalized = path.resolve(filePath);
    const allowedRoot = path.resolve(getUserDataDir());
    if (!normalized.startsWith(allowedRoot)) {
      return new Response("Forbidden", { status: 403 });
    }

    return net.fetch(pathToFileURL(normalized).toString());
  });
}
