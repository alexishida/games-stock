import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { closeDatabase, getDatabase, getImagesDir, getUserDataDir } from "./db/database";
import { getAppUserDataDir } from "./appPaths";
import { spawn } from "node:child_process";
import * as games from "./db/repositories/games";
import * as platforms from "./db/repositories/platforms";
import * as emulators from "./db/repositories/emulators";
import * as appState from "./db/repositories/appState";
import { previewImportPackage } from "./dataPortability";
import { ensureLaunchBoxMetadata, importGame, searchGames, downloadLaunchBoxImages, syncMissingCovers, getLaunchBoxMetadataDownloadedAt, metadataExists } from "./lib/launchbox";
import { importRomFolder, scanRomFolder, SUPPORTED_ROM_EXTENSIONS } from "./romFolderImport";
import { IPC_CHANNELS } from "../shared/ipc-channels";
import { DataPortabilityExportRequest, DataPortabilityExportResult, DataPortabilityImportRequest, DataPortabilityImportResult, DataPortabilityJob, DataPortabilityProgress, GameCreateInput, GameMediaItem, GameUpdateInput, LaunchBoxDownloadParams, LaunchBoxImportParams, LaunchBoxProgress, RetroArchCoreInventory, RomFolderImportJob, RomFolderImportProgress, RomFolderImportRequest, RomFolderRecordCountRequest, RomFolderScanRequest } from "../shared/types";
import { getRetroArchCoreCandidatesForPlatform } from "../shared/retroarch";

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
const romFolderJobs = new Map<string, RomFolderImportJob>();
const dataPortabilityJobs = new Map<string, DataPortabilityJob>();

configureElectronStoragePaths();

function getWindowTitle(): string {
  return `GameStock v${app.getVersion()}`;
}

function configureElectronStoragePaths(): void {
  const dataDir = getAppUserDataDir();
  const sessionDir = path.join(dataDir, "session");
  const cacheDir = path.join(sessionDir, "Cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  app.setPath("userData", dataDir);
  app.setPath("sessionData", sessionDir);
  app.commandLine.appendSwitch("disk-cache-dir", cacheDir);
  app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
}

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
    return { width: 1225, height: 818, x: undefined as never, y: undefined as never };
  }
}

async function createWindow(): Promise<void> {
  getDatabase();
  const bounds = loadBounds();
  mainWindow = new BrowserWindow({
    ...bounds,
    show: false,
    backgroundColor: "#131313",
    minWidth: 1024,
    minHeight: 768,
    title: getWindowTitle(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, "../preload/index.js")
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

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
  ipcMain.handle(IPC_CHANNELS.games.listMedia, (_event, id: number) => listGameMedia(id));
  ipcMain.handle(IPC_CHANNELS.games.collectionCounts, () => games.getCollectionCounts());
  ipcMain.handle(IPC_CHANNELS.games.coverStats, () => ({
    ...games.getCoverStats(),
    metadataDownloadedAt: getLaunchBoxMetadataDownloadedAt()
  }));
  ipcMain.handle(IPC_CHANNELS.games.syncCovers, () => syncMissingCovers((progress) => {
    sendLaunchBoxProgress(progress);
    sendCoverStats();
  }));
  ipcMain.handle(IPC_CHANNELS.games.create, (_event, data: Partial<GameCreateInput>) => games.createGame(data));
  ipcMain.handle(IPC_CHANNELS.games.update, (_event, id: number, data: GameUpdateInput) => games.updateGame(id, data));
  ipcMain.handle(IPC_CHANNELS.games.delete, (_event, id: number) => games.deleteGame(id));

  ipcMain.handle(IPC_CHANNELS.platforms.list, () => platforms.listPlatforms());
  ipcMain.handle(IPC_CHANNELS.platforms.create, (_event, data: platforms.PlatformInput) => platforms.createPlatform(data));
  ipcMain.handle(IPC_CHANNELS.platforms.update, (_event, id: number, data: Partial<platforms.PlatformInput>) => platforms.updatePlatform(id, data));
  ipcMain.handle(IPC_CHANNELS.platforms.delete, (_event, id: number) => platforms.deletePlatform(id));
  ipcMain.handle(IPC_CHANNELS.platforms.getMappings, (_event, platformId: number) => platforms.getPlatformMappings(platformId));
  ipcMain.handle(IPC_CHANNELS.platforms.saveMappings, (_event, platformId: number, data) => platforms.savePlatformMappings(platformId, data));

  ipcMain.handle(IPC_CHANNELS.emulators.list, () => emulators.listEmulators());
  ipcMain.handle(IPC_CHANNELS.emulators.create, (_event, data: emulators.EmulatorInput) => emulators.createEmulator(data));
  ipcMain.handle(IPC_CHANNELS.emulators.update, (_event, id: number, data: Partial<emulators.EmulatorInput>) => emulators.updateEmulator(id, data));
  ipcMain.handle(IPC_CHANNELS.emulators.delete, (_event, id: number) => emulators.deleteEmulator(id));
  ipcMain.handle(IPC_CHANNELS.emulators.listByPlatform, (_event, platformId: number) => emulators.listEmulatorsByPlatform(platformId));
  ipcMain.handle(IPC_CHANNELS.emulators.listRetroArchCores, (_event, emulatorId: number) => listRetroArchCores(emulatorId));
  ipcMain.handle(IPC_CHANNELS.emulators.linkPlatform, (_event, emulatorId: number, platformId: number, isDefault: boolean, corePath?: string | null) =>
    emulators.linkEmulatorToPlatform(emulatorId, platformId, isDefault, corePath)
  );
  ipcMain.handle(IPC_CHANNELS.emulators.unlinkPlatform, (_event, emulatorId: number, platformId: number) =>
    emulators.unlinkEmulatorFromPlatform(emulatorId, platformId)
  );

  ipcMain.handle(IPC_CHANNELS.games.launch, async (_event, gameId: number) => {
    const game = games.getGame(gameId);
    if (!game) throw new Error("Jogo não encontrado");
    if (!game.rom_path?.trim()) throw new Error("Jogo não possui caminho de ROM configurado");

    const pe = emulators.getDefaultEmulator(game.platform_id);
    if (!pe) throw new Error("Nenhum emulador padrão configurado para esta plataforma");

    const emulator = pe.emulator!;
    if (!emulator.executable?.trim()) throw new Error("Executável do emulador não configurado");
    if (!fs.existsSync(emulator.executable)) throw new Error(`Executável do emulador não encontrado: ${emulator.executable}`);

    let args: string[];
    if (emulator.is_retroarch) {
      const corePath = resolveRetroArchCorePath(pe.core_path, emulator.executable, game.platform_name ?? "");
      if (!corePath) throw new Error("Core do RetroArch não configurado para esta plataforma");
      args = ["-L", corePath, game.rom_path];
    } else {
      const parsedArgs = emulator.args.trim() ? emulator.args.trim().split(/\s+/) : [];
      args = [...parsedArgs, game.rom_path];
    }

    await spawnDetachedProcess(emulator.executable, args);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.dialogs.openExecutableFile, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile"],
      filters: [
        { name: "Executáveis", extensions: ["exe", "bat", "cmd", "sh", "AppImage"] },
        { name: "Todos os arquivos", extensions: ["*"] }
      ]
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.dialogs.openAnyFile, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile"],
      filters: [{ name: "Todos os arquivos", extensions: ["*"] }]
    });
    return result.canceled ? null : result.filePaths[0];
  });

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

  ipcMain.handle(IPC_CHANNELS.dialogs.saveImageFile, async (_event, sourcePath: string, suggestedName: string) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: suggestedName,
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true, path: null };
    fs.copyFileSync(sourcePath, result.filePath);
    return { canceled: false, path: result.filePath };
  });

  ipcMain.handle(IPC_CHANNELS.shell.openPath, (_event, targetPath: string) => shell.openPath(targetPath));
  ipcMain.handle(IPC_CHANNELS.app.getVersion, () => app.getVersion());
  ipcMain.handle(IPC_CHANNELS.app.getStorageStats, () => {
    const dataDirPath = getUserDataDir();
    const totalGames = games.getCoverStats().total;
    const dataDirSizeMb = Math.round(getDirSizeBytes(dataDirPath) / (1024 * 1024) * 10) / 10;
    return { totalGames, dataDirSizeMb, dataDirPath };
  });
  ipcMain.handle(IPC_CHANNELS.appState.get, (_event, key: string) => appState.getAppState(key));
  ipcMain.handle(IPC_CHANNELS.appState.getMany, (_event, keys: string[]) => appState.getAppStateMany(keys));
  ipcMain.handle(IPC_CHANNELS.appState.set, (_event, key: string, value: unknown) => {
    appState.setAppState(key, value);
  });
  ipcMain.handle(IPC_CHANNELS.appState.setMany, (_event, entries: Array<{ key: string; value: unknown }>, onlyIfMissing?: boolean) => {
    appState.setAppStateMany(entries, Boolean(onlyIfMissing));
  });
  ipcMain.handle(IPC_CHANNELS.appState.remove, (_event, key: string) => {
    appState.removeAppState(key);
  });
  ipcMain.handle(IPC_CHANNELS.dataPortability.exportPackage, async (_event, request: DataPortabilityExportRequest) => {
    let targetPath = request.targetPath?.trim() ?? "";
    if (!targetPath) {
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: "Exportar dados do GameStock",
        defaultPath: `gamestock-backup-${new Date().toISOString().slice(0, 10)}.gamestock-backup`,
        filters: [
          { name: "Backup GameStock", extensions: ["gamestock-backup"] },
          { name: "Todos os arquivos", extensions: ["*"] }
        ]
      });
      if (result.canceled || !result.filePath) return { canceled: true, filePath: null, warnings: [] };
      targetPath = result.filePath;
    }
    return startDataPortabilityJob("export", { ...request, targetPath });
  });
  ipcMain.handle(IPC_CHANNELS.dataPortability.previewImport, (_event, packagePath: string) => previewImportPackage(packagePath));
  ipcMain.handle(IPC_CHANNELS.dataPortability.importPackage, (_event, request: DataPortabilityImportRequest) => startDataPortabilityJob("import", request));
  ipcMain.handle(IPC_CHANNELS.dataPortability.jobs, () =>
    Array.from(dataPortabilityJobs.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  );

  ipcMain.handle(IPC_CHANNELS.launchbox.ensureMetadata, (_event, options?: { force?: boolean }) =>
    ensureLaunchBoxMetadata(Boolean(options?.force), sendLaunchBoxProgress)
  );
  ipcMain.handle(IPC_CHANNELS.launchbox.metadataExists, () => metadataExists());
  ipcMain.handle(IPC_CHANNELS.launchbox.searchGames, (_event, params) => searchGames(params));
  ipcMain.handle(IPC_CHANNELS.launchbox.downloadImages, (_event, params: LaunchBoxDownloadParams) =>
    downloadLaunchBoxImages(params, sendLaunchBoxProgress)
  );
  ipcMain.handle(IPC_CHANNELS.launchbox.importGame, (_event, params: LaunchBoxImportParams) => importGame(params, sendLaunchBoxProgress));

  ipcMain.handle(IPC_CHANNELS.romFolderImport.scan, (_event, params: RomFolderScanRequest) => scanRomFolder(params));
  ipcMain.handle(IPC_CHANNELS.romFolderImport.import, (_event, params: RomFolderImportRequest) => startRomFolderImportJob(params));
  ipcMain.handle(IPC_CHANNELS.romFolderImport.jobs, () => Array.from(romFolderJobs.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
  ipcMain.handle(IPC_CHANNELS.romFolderImport.countFolderRecords, (_event, params: RomFolderRecordCountRequest[]) =>
    params.map((entry) => ({
      ...entry,
      count: games.countGamesByRomFolder(entry.folderPath, entry.platformId)
    }))
  );
  ipcMain.handle(IPC_CHANNELS.romFolderImport.deleteFolderRecords, (_event, params: string | { folderPath: string; platformId?: number }) => {
    // Remove only GameStock database records. Original ROM files and downloaded images stay on disk as cache.
    const folderPath = typeof params === "string" ? params : params.folderPath;
    const platformId = typeof params === "string" ? undefined : params.platformId;
    const byRomPath = games.deleteGamesByRomFolder(folderPath, platformId);
    if (!platformId) return byRomPath;

    const scan = scanRomFolder({ folderPaths: [folderPath], platformId, includeSubfolders: true });
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

function sendCoverStats(): void {
  mainWindow?.webContents.send(IPC_CHANNELS.games.coverStatsUpdated, {
    ...games.getCoverStats(),
    metadataDownloadedAt: getLaunchBoxMetadataDownloadedAt()
  });
}

function sendRomFolderImportProgress(progress: RomFolderImportProgress): void {
  mainWindow?.webContents.send(IPC_CHANNELS.romFolderImport.progress, progress);
}

function sendDataPortabilityProgress(progress: DataPortabilityProgress): void {
  mainWindow?.webContents.send(IPC_CHANNELS.dataPortability.progress, progress);
}

type DataPortabilityWorkerMessage =
  | { type: "progress"; progress: DataPortabilityProgress }
  | { type: "completed"; result: DataPortabilityExportResult | DataPortabilityImportResult }
  | { type: "error"; error: string };

function startDataPortabilityJob(
  kind: "export",
  request: DataPortabilityExportRequest & { targetPath: string }
): DataPortabilityJob;
function startDataPortabilityJob(kind: "import", request: DataPortabilityImportRequest): DataPortabilityJob;
function startDataPortabilityJob(
  kind: "export" | "import",
  request: (DataPortabilityExportRequest & { targetPath: string }) | DataPortabilityImportRequest
): DataPortabilityJob {
  const jobId = `data-portability-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const packagePath = kind === "export" ? (request as DataPortabilityExportRequest & { targetPath: string }).targetPath : (request as DataPortabilityImportRequest).packagePath;
  const initialProgress: DataPortabilityProgress = {
    jobId,
    kind,
    current: 0,
    total: 1,
    stage: "preparing",
    message: kind === "export" ? "Exportacao iniciada" : "Importacao iniciada"
  };
  const job: DataPortabilityJob = {
    jobId,
    kind,
    status: "running",
    startedAt: new Date().toISOString(),
    progress: initialProgress,
    packagePath
  };
  dataPortabilityJobs.set(jobId, job);
  sendDataPortabilityProgress(initialProgress);

  const worker = new Worker(path.join(__dirname, "dataPortabilityWorker.js"), {
    workerData: {
      jobId,
      kind,
      request,
      appVersion: app.getVersion(),
      userDataDir: getUserDataDir()
    }
  });

  worker.on("message", (message: DataPortabilityWorkerMessage) => {
    if (message.type === "progress") {
      job.progress = message.progress;
      sendDataPortabilityProgress(message.progress);
      return;
    }

    if (message.type === "completed") {
      job.status = "completed";
      job.progress = {
        ...job.progress,
        current: job.progress.total,
        stage: "done",
        message: kind === "export" ? "Exportacao concluida" : "Importacao concluida"
      };
      if (kind === "export") {
        job.exportResult = message.result as DataPortabilityExportResult;
        job.packagePath = job.exportResult.filePath;
      } else {
        job.importResult = message.result as DataPortabilityImportResult;
        sendCoverStats();
      }
      mainWindow?.webContents.send(IPC_CHANNELS.dataPortability.completed, job);
      return;
    }

    failDataPortabilityJob(job, message.error);
  });

  worker.on("error", (error) => {
    failDataPortabilityJob(job, error.message);
  });

  worker.on("exit", (code) => {
    if (code !== 0 && job.status === "running") {
      failDataPortabilityJob(job, `Worker de portabilidade encerrou com codigo ${code}`);
    }
  });

  return job;
}

function failDataPortabilityJob(job: DataPortabilityJob, message: string): void {
  if (job.status !== "running") return;
  job.status = "failed";
  job.error = message;
  job.progress = {
    ...job.progress,
    stage: "error",
    message,
    current: job.progress.total
  };
  sendDataPortabilityProgress(job.progress);
  mainWindow?.webContents.send(IPC_CHANNELS.dataPortability.completed, job);
}

function startRomFolderImportJob(params: RomFolderImportRequest): RomFolderImportJob {
  const scan = scanRomFolder(params);
  const jobId = `rom-import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const initialProgress: RomFolderImportProgress = {
    jobId,
    current: 0,
    total: scan.candidates.length,
    stage: "preparing_metadata",
    message: "Importação iniciada em background"
  };
  const job: RomFolderImportJob = {
    jobId,
    folderPaths: scan.folderPaths,
    romFilePaths: scan.romFilePaths,
    platformId: scan.platformId,
    platformName: scan.platformName,
    detectionMode: scan.detectionMode,
    detectedPlatforms: scan.detectedPlatforms,
    includeSubfolders: scan.includeSubfolders,
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
    if (progress.stage === "done" || progress.stage === "skipped") {
      sendCoverStats();
    }
  })
    .then((result) => {
      job.status = "completed";
      job.result = { ...result, jobId };
      job.progress = {
        jobId,
        current: result.summary.processed,
        total: result.summary.processed,
        stage: "done",
        message: "Importação concluída"
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

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerMediaProtocol();
  registerIpc();
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

const MEDIA_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function listGameMedia(id: number): GameMediaItem[] {
  const game = games.getGame(id);
  if (!game) return [];

  const mediaPaths = [game.box_art_path, game.background_path, game.screenshot_path].filter(Boolean) as string[];
  const mediaDir = mediaPaths.map((filePath) => path.dirname(filePath)).find((dir) => isPathAllowed(dir));
  if (!mediaDir || !fs.existsSync(mediaDir)) return [];

  return fs.readdirSync(mediaDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && MEDIA_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(mediaDir, entry.name))
    .filter((filePath) => isPathAllowed(filePath))
    .filter((filePath) => mediaKind(filePath) !== "cover")
    .sort((a, b) => mediaSortWeight(a) - mediaSortWeight(b) || path.basename(a).localeCompare(path.basename(b)))
    .map((filePath) => ({
      path: filePath,
      label: mediaLabel(filePath),
      kind: mediaKind(filePath)
    }));
}

function isPathAllowed(targetPath: string): boolean {
  const normalized = path.resolve(targetPath);
  const allowedRoot = path.resolve(getUserDataDir());
  return normalized === allowedRoot || normalized.startsWith(`${allowedRoot}${path.sep}`);
}

function mediaKind(filePath: string): GameMediaItem["kind"] {
  const filename = path.basename(filePath).toLowerCase();
  if (filename === "cover.jpg") return "cover";
  if (filename.startsWith("box-")) return "box-art";
  if (filename.startsWith("cart-")) return "cart";
  if (filename.startsWith("fanart-background")) return "background";
  if (filename.startsWith("screenshot-")) return "screenshot";
  return "other";
}

function mediaLabel(filePath: string): string {
  const filename = path.basename(filePath, path.extname(filePath)).toLowerCase();
  if (filename === "cover") return "Cover";
  return filename
    .replace(/-\d+$/g, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mediaSortWeight(filePath: string): number {
  switch (mediaKind(filePath)) {
    case "cover":
      return 0;
    case "box-art":
      return 1;
    case "cart":
      return 2;
    case "background":
      return 3;
    case "screenshot":
      return 4;
    case "other":
      return 5;
  }
}

function spawnDetachedProcess(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    let settled = false;

    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });

    child.once("spawn", () => {
      if (settled) return;
      settled = true;
      child.unref();
      resolve();
    });
  });
}

function resolveRetroArchCorePath(
  configuredCorePath: string | null | undefined,
  retroArchExecutable: string,
  platformName: string
): string | null {
  const normalizedConfigured = configuredCorePath?.trim();
  const coresDir = path.join(path.dirname(retroArchExecutable), "cores");
  const configuredCore = normalizedConfigured ? resolveRetroArchCoreCandidate(normalizedConfigured, coresDir) : null;
  if (configuredCore) return configuredCore;
  if (!fs.existsSync(coresDir)) return null;

  const candidates = getRetroArchCoreCandidatesForPlatform(platformName);
  for (const candidate of candidates) {
    const corePath = resolveRetroArchCoreCandidate(candidate, coresDir);
    if (corePath) return corePath;
  }

  return null;
}

function getDirSizeBytes(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) total += getDirSizeBytes(full);
    else if (entry.isFile()) total += fs.statSync(full).size;
  }
  return total;
}

function resolveRetroArchCoreCandidate(coreCandidate: string, coresDir: string): string | null {
  const directPath = path.resolve(coreCandidate);
  if (fs.existsSync(directPath)) return directPath;

  const baseDir = path.dirname(coresDir);
  const relativePaths = [
    path.resolve(coresDir, coreCandidate),
    path.resolve(baseDir, coreCandidate)
  ];

  for (const candidatePath of relativePaths) {
    if (fs.existsSync(candidatePath)) return candidatePath;
  }

  if (path.basename(coreCandidate) !== coreCandidate) return null;

  for (const fileName of getRetroArchCoreFileNames(coreCandidate)) {
    const candidatePath = path.join(coresDir, fileName);
    if (fs.existsSync(candidatePath)) return candidatePath;
  }

  return null;
}

function getRetroArchCoreFileNames(coreName: string): string[] {
  if (path.extname(coreName)) return [coreName];
  return [".dll", ".so", ".dylib"].map((extension) => `${coreName}${extension}`);
}

function listRetroArchCores(emulatorId: number): RetroArchCoreInventory {
  const emulator = emulators.listEmulators().find((entry) => entry.id === emulatorId && entry.is_retroarch === 1);
  if (!emulator) throw new Error("RetroArch não encontrado");

  const executable = emulator.executable.trim();
  if (!executable) {
    return {
      coresDir: null,
      coresDirExists: false,
      executableConfigured: false,
      installedCores: []
    };
  }

  const coresDir = path.join(path.dirname(executable), "cores");
  if (!fs.existsSync(coresDir)) {
    return {
      coresDir,
      coresDirExists: false,
      executableConfigured: true,
      installedCores: []
    };
  }

  const installedCores = Array.from(
    new Set(
      fs.readdirSync(coresDir)
        .filter((fileName) => [".dll", ".so", ".dylib"].includes(path.extname(fileName).toLowerCase()))
        .map((fileName) => path.basename(fileName, path.extname(fileName)))
    )
  ).sort((a, b) => a.localeCompare(b));

  return {
    coresDir,
    coresDirExists: true,
    executableConfigured: true,
    installedCores
  };
}
