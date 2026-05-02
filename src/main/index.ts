import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { closeDatabase, getDatabase, getImagesDir, getUserDataDir } from "./db/database";
import * as games from "./db/repositories/games";
import * as platforms from "./db/repositories/platforms";
import { ensureLaunchBoxMetadata, importGame, searchGames, downloadLaunchBoxImages } from "./lib/launchbox";
import { importRomFolder, scanRomFolder, SUPPORTED_ROM_EXTENSIONS } from "./romFolderImport";
import { IPC_CHANNELS } from "../shared/ipc-channels";
import { GameCreateInput, GameUpdateInput, LaunchBoxDownloadParams, LaunchBoxImportParams, LaunchBoxProgress, RomFolderImportJob, RomFolderImportProgress, RomFolderImportRequest, RomFolderScanRequest } from "../shared/types";

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
const romFolderJobs = new Map<string, RomFolderImportJob>();

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
    mainWindow.webContents.openDevTools();
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
      filters: [{ name: "ROMs", extensions: SUPPORTED_ROM_EXTENSIONS.map((extension) => extension.slice(1)) }]
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.dialogs.openRomFiles, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "ROMs", extensions: SUPPORTED_ROM_EXTENSIONS.map((extension) => extension.slice(1)) }]
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle(IPC_CHANNELS.dialogs.openRomFolder, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory"]
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.dialogs.openRomFolders, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory", "multiSelections"]
    });
    return result.canceled ? [] : result.filePaths;
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

  ipcMain.handle(IPC_CHANNELS.romFolderImport.scan, (_event, params: RomFolderScanRequest) => scanRomFolder(params));
  ipcMain.handle(IPC_CHANNELS.romFolderImport.import, (_event, params: RomFolderImportRequest) => startRomFolderImportJob(params));
  ipcMain.handle(IPC_CHANNELS.romFolderImport.deleteFolderRecords, (_event, params: string | { folderPath: string; platformId?: number }) => {
    const folderPath = typeof params === "string" ? params : params.folderPath;
    const platformId = typeof params === "string" ? undefined : params.platformId;
    const byRomPath = games.deleteGamesByRomFolder(folderPath);
    if (!platformId) return byRomPath;

    const scan = scanRomFolder({ folderPaths: [folderPath], platformId });
    const byLegacyTitles = games.deleteGamesWithoutRomPathByPlatformAndTitles(
      platformId,
      scan.candidates.map((candidate) => candidate.titleCandidate)
    );
    return { success: true as const, deleted: byRomPath.deleted + byLegacyTitles.deleted };
  });
}

function sendLaunchBoxProgress(progress: LaunchBoxProgress): void {
  mainWindow?.webContents.send(IPC_CHANNELS.launchbox.progress, progress);
}

function sendRomFolderImportProgress(progress: RomFolderImportProgress): void {
  mainWindow?.webContents.send(IPC_CHANNELS.romFolderImport.progress, progress);
}

function startRomFolderImportJob(params: RomFolderImportRequest): RomFolderImportJob {
  const scan = scanRomFolder(params);
  const jobId = `rom-import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const initialProgress: RomFolderImportProgress = {
    jobId,
    current: 0,
    total: scan.candidates.length,
    stage: "preparing_metadata",
    message: "Importacao iniciada em background"
  };
  const job: RomFolderImportJob = {
    jobId,
    folderPaths: scan.folderPaths,
    romFilePaths: scan.romFilePaths,
    platformId: scan.platformId,
    platformName: scan.platformName,
    status: "running",
    startedAt: new Date().toISOString(),
    progress: initialProgress
  };
  romFolderJobs.set(jobId, job);
  sendRomFolderImportProgress(initialProgress);

  void importRomFolder(params, (progress) => {
    const nextProgress = { ...progress, jobId };
    job.progress = nextProgress;
    sendRomFolderImportProgress(nextProgress);
  })
    .then((result) => {
      job.status = "completed";
      job.result = { ...result, jobId };
      job.progress = {
        jobId,
        current: result.summary.processed,
        total: result.summary.processed,
        stage: "done",
        message: "Importacao concluida"
      };
      mainWindow?.webContents.send(IPC_CHANNELS.romFolderImport.completed, job.result);
    })
    .catch((error) => {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
      job.progress = { ...job.progress, jobId, stage: "error", message: job.error };
      sendRomFolderImportProgress(job.progress);
    });

  return job;
}

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "Menu",
      submenu: [
        { label: "Importar Jogos", click: () => mainWindow?.webContents.send(IPC_CHANNELS.romFolderImport.openImporter) },
        { label: "Novo Jogo Manual", click: () => mainWindow?.webContents.send(IPC_CHANNELS.library.openCreateGame) },
        { label: "Gerenciar Plataformas", click: () => mainWindow?.webContents.send(IPC_CHANNELS.library.openPlatformManager) },
        { label: "Pasta de dados", click: () => shell.openPath(getUserDataDir()) },
        { type: "separator" },
        { label: "Sair", role: "quit" }
      ]
    },
    {
      label: "Ferramentas",
      submenu: [
        { label: "Importar pasta de ROMs", click: () => mainWindow?.webContents.send(IPC_CHANNELS.romFolderImport.openImporter) },
        { label: "Importar do LaunchBox", click: () => mainWindow?.webContents.send(IPC_CHANNELS.launchbox.openImporter) }
      ]
    },
    {
      label: "Sobre",
      submenu: [
        { label: `GameStock v${app.getVersion()}`, enabled: false }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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
    if (normalized !== allowedRoot && !normalized.startsWith(`${allowedRoot}${path.sep}`)) {
      return new Response("Forbidden", { status: 403 });
    }

    return net.fetch(pathToFileURL(normalized).toString());
  });
}
