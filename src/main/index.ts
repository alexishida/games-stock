/**
 * Ponto de entrada do processo principal (main process) do Electron.
 *
 * Responsabilidades:
 * - Registrar o protocolo customizado `gamestock-media` para servir imagens locais.
 * - Criar e gerenciar a janela principal (`BrowserWindow`).
 * - Registrar todos os handlers IPC que expõem funcionalidades ao renderer.
 * - Gerenciar o ciclo de vida do app (ready, activate, window-all-closed, before-quit).
 * - Iniciar e monitorar jobs de importação de ROMs e portabilidade de dados.
 */

import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { closeDatabase, getDatabase, getImagesDir, getInventarioImagesDir, getUserDataDir } from "./db/database";
import { HardwareItemDao } from "./db/dao/hardwareItemDao";
import { HardwareItemTypeDao } from "./db/dao/hardwareItemTypeDao";
import { HardwareConservationStateDao } from "./db/dao/hardwareConservationStateDao";
import { HardwareItemPhotoDao } from "./db/dao/hardwareItemPhotoDao";
import { spawn } from "node:child_process";
import * as games from "./db/repositories/games";
import * as platforms from "./db/repositories/platforms";
import * as emulators from "./db/repositories/emulators";
import * as appState from "./db/repositories/appState";
import { previewImportPackage } from "./dataPortability";
import { ensureLaunchBoxMetadata, importGame, searchGames, downloadLaunchBoxImages, syncMissingCovers, getLaunchBoxMetadataDownloadedAt, metadataExists } from "./lib/launchbox";
import { importRomFolder, scanRomFolder, SUPPORTED_ROM_EXTENSIONS } from "./romFolderImport";
import { createSplashWindow } from "./splash-window";
import { requestUpdaterSkip, runManualUpdateFlow, runUpdateFlow, supportsInPlaceAutoUpdate, updaterAppInfo } from "./updater";
import { IPC_CHANNELS } from "../shared/ipc-channels";
import { DataPortabilityExportRequest, DataPortabilityExportResult, DataPortabilityImportRequest, DataPortabilityImportResult, DataPortabilityJob, DataPortabilityProgress, DataPortabilityRomFolderEntry, GameCreateInput, GameMediaItem, GameUpdateInput, LaunchBoxDownloadParams, LaunchBoxImportParams, LaunchBoxProgress, RetroArchCoreInventory, RomFolderImportJob, RomFolderImportProgress, RomFolderImportRequest, RomFolderRecordCountRequest, RomFolderScanRequest } from "../shared/types";
import { getRetroArchCoreCandidatesForPlatform } from "../shared/retroarch";
import { APP_VERSION_LABEL } from "../shared/build-meta";
import { UPDATE_MANIFEST_URL } from "../shared/update-config";
import { resolveConfiguredExecutable } from "./executableResolver";
import { clearExtractedRomCache, prepareRomPathForLaunch } from "./romLaunchExtraction";

/** Referência à janela principal; `null` quando fechada. */
let mainWindow: BrowserWindow | null = null;

/** Flag usada para distinguir fechamento intencional (quit) de fechamento de janela no macOS. */
let isQuitting = false;

/** Mapa de jobs de importação de ROM em andamento ou concluídos nesta sessão. */
const romFolderJobs = new Map<string, RomFolderImportJob>();

/** Promessas de conclusão dos jobs de importação de ROM iniciados nesta sessão. */
const romFolderJobCompletions = new Map<string, Promise<void>>();

/** Mapa de jobs de portabilidade de dados (exportação/importação) desta sessão. */
const dataPortabilityJobs = new Map<string, DataPortabilityJob>();

/** Estatisticas de armazenamento exibidas nas configuracoes do app. */
interface AppStorageStats {
  totalGames: number;
  dataDirSizeMb: number;
  dataDirPath: string;
}

/** Tempo curto de cache para evitar recalcular tamanho de imagens/cache a cada troca de aba. */
const STORAGE_STATS_CACHE_MS = 30_000;

/** Cache do resultado mais recente de armazenamento local. */
let cachedStorageStats: { expiresAt: number; value: AppStorageStats } | null = null;

/** Promessa compartilhada enquanto uma leitura pesada de armazenamento esta em andamento. */
let pendingStorageStats: Promise<AppStorageStats> | null = null;

/** Retorna o título da janela principal com a versão do app. */
function getWindowTitle(): string {
  return `GameStock v${APP_VERSION_LABEL}`;
}

// Registra o esquema customizado antes de `app.whenReady()`, conforme requisito do Electron
protocol.registerSchemesAsPrivileged([
  {
    scheme: "gamestock-media",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true // Permite uso via fetch() no renderer
    }
  }
]);

/** Retorna o caminho do arquivo JSON que persiste as dimensões e posição da janela. */
function getBoundsFile(): string {
  return path.join(getUserDataDir(), "window-bounds.json");
}

/**
 * Carrega os bounds (tamanho e posição) salvos da janela principal.
 * Retorna dimensões padrão se o arquivo não existir ou estiver corrompido.
 */
function loadBounds(): Electron.Rectangle {
  try {
    return JSON.parse(fs.readFileSync(getBoundsFile(), "utf8")) as Electron.Rectangle;
  } catch {
    return { width: 1225, height: 818, x: undefined as never, y: undefined as never };
  }
}

/**
 * Cria a janela principal do Electron.
 *
 * - Abre o banco SQLite antes de criar a janela.
 * - Usa `show: false` e exibe somente no evento `ready-to-show` para evitar tela branca.
 * - Em desenvolvimento, carrega o servidor Vite; em produção, carrega o HTML compilado.
 */
async function createWindow(): Promise<void> {
  // Abre o banco antes de mostrar qualquer UI
  getDatabase();
  const bounds = loadBounds();
  mainWindow = new BrowserWindow({
    ...bounds,
    show: false, // Evita flash de tela branca antes do renderer estar pronto
    backgroundColor: "#131313",
    minWidth: 1024,
    minHeight: 768,
    title: getWindowTitle(),
    // Ícone da janela — usa icon-win.png no Windows; no pacote o exe já embute o ícone via electron-builder
    icon: path.join(__dirname, process.platform === "win32" ? "../../build/icon-win.png" : "../../build/icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, "../preload/index.js")
    }
  });

  // Exibe a janela somente quando o renderer terminar de carregar
  mainWindow.once("ready-to-show", () => mainWindow?.show());

  // Fallback: em alguns desktops Linux o `ready-to-show` pode atrasar ou nunca
  // chegar quando o renderer/GPU entra em estado degradado. Evitamos janela
  // invisível mostrando assim mesmo após pequeno timeout.
  const forceShowTimeout = setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible()) return;
    mainWindow.show();
  }, 2_000);

  // Loga falhas de carregamento para facilitar diagnóstico em dev.
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.error("[main] Falha ao carregar renderer:", errorCode, errorDescription);
  });

  // Persiste bounds ao fechar a janela
  mainWindow.on("close", () => {
    if (!mainWindow) return;
    fs.mkdirSync(getUserDataDir(), { recursive: true });
    fs.writeFileSync(getBoundsFile(), JSON.stringify(mainWindow.getBounds()), "utf8");
  });

  mainWindow.on("closed", () => {
    clearTimeout(forceShowTimeout);
    mainWindow = null;
    // No Windows/Linux, fechar a última janela encerra o app (exceto durante quit explícito)
    if (process.platform !== "darwin" && !isQuitting) {
      app.quit();
    }
  });

  if (process.env.VITE_DEV_SERVER_URL || !app.isPackaged) {
    // Modo de desenvolvimento: conecta ao servidor Vite com HMR
    const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173";
    await mainWindow.loadURL(new URL("/src/renderer/index.html", devServerUrl).toString());
    mainWindow.webContents.openDevTools();
  } else {
    // Produção: carrega o bundle compilado
    await mainWindow.loadFile(path.join(__dirname, "../renderer/src/renderer/index.html"));
  }
}

/**
 * Registra todos os handlers IPC que expõem funcionalidades do main process ao renderer.
 *
 * Organização por domínio:
 * - games: CRUD de jogos, media, stats, launch
 * - platforms: CRUD de plataformas e mapeamentos
 * - emulators: CRUD de emuladores e cores RetroArch
 * - dialogs: diálogos nativos de abertura/salvamento de arquivos
 * - shell: integração com o shell do SO
 * - app: informações e estado do app
 * - appState: persistência de estado genérico da UI
 * - dataPortability: exportação e importação de backups
 * - launchbox: integração com metadados e imagens do LaunchBox
 * - romFolderImport: importação de ROMs a partir de pastas
 */
function registerIpc(): void {
  // ── Jogos ──────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.games.list, (_event, filters) => games.listGames(filters));
  ipcMain.handle(IPC_CHANNELS.games.listGenres, () => games.listGameGenres());
  ipcMain.handle(IPC_CHANNELS.games.get, (_event, id: number) => games.getGame(id));
  ipcMain.handle(IPC_CHANNELS.games.listMedia, (_event, id: number) => listGameMedia(id));
  ipcMain.handle(IPC_CHANNELS.games.collectionCounts, () => games.getCollectionCounts());
  ipcMain.handle(IPC_CHANNELS.games.launchStats, () => games.getGameLaunchStats());
  ipcMain.handle(IPC_CHANNELS.games.coverStats, () => ({
    ...games.getCoverStats(),
    metadataDownloadedAt: getLaunchBoxMetadataDownloadedAt()
  }));
  ipcMain.handle(IPC_CHANNELS.games.syncCovers, (_event, options?: { jobId?: string }) => syncMissingCovers((progress) => {
    // Propaga o jobId do renderer para cada tick, evitando sobrescrever outro card ativo.
    sendLaunchBoxProgress(attachLaunchBoxJobId(progress, options?.jobId));
    sendCoverStats(); // Atualiza stats de capa no renderer após cada jogo processado
  }));
  ipcMain.handle(IPC_CHANNELS.games.create, (_event, data: Partial<GameCreateInput>) => games.createGame(data));
  ipcMain.handle(IPC_CHANNELS.games.update, (_event, id: number, data: GameUpdateInput) => games.updateGame(id, data));
  ipcMain.handle(IPC_CHANNELS.games.delete, (_event, id: number) => games.deleteGame(id));
  ipcMain.handle(IPC_CHANNELS.games.listVersions, (_event, id: number) => games.listGameVersions(id));
  ipcMain.handle(IPC_CHANNELS.games.resetLaunchStats, () => games.resetGameLaunchStats());

  // ── Plataformas ────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.platforms.list, () => platforms.listPlatforms());
  ipcMain.handle(IPC_CHANNELS.platforms.create, (_event, data: platforms.PlatformInput) => platforms.createPlatform(data));
  ipcMain.handle(IPC_CHANNELS.platforms.update, (_event, id: number, data: Partial<platforms.PlatformInput>) => platforms.updatePlatform(id, data));
  ipcMain.handle(IPC_CHANNELS.platforms.delete, (_event, id: number) => platforms.deletePlatform(id));
  ipcMain.handle(IPC_CHANNELS.platforms.getMappings, (_event, platformId: number) => platforms.getPlatformMappings(platformId));
  ipcMain.handle(IPC_CHANNELS.platforms.saveMappings, (_event, platformId: number, data) => platforms.savePlatformMappings(platformId, data));

  // ── Emuladores ─────────────────────────────────────────────────────────────
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

  // ── Launch (abrir jogo no emulador) ───────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.games.launch, async (_event, gameId: number) => {
    const game = games.getGame(gameId);
    if (!game) throw new Error("Jogo não encontrado");
    if (!game.rom_path?.trim()) throw new Error("Jogo não possui caminho de ROM configurado");

    const pe = emulators.getDefaultEmulator(game.platform_id);
    if (!pe) throw new Error("Nenhum emulador padrão configurado para esta plataforma");

    const emulator = pe.emulator!;
    if (!emulator.executable?.trim()) throw new Error("Executável do emulador não configurado");
    const resolvedExecutable = resolveConfiguredExecutable(emulator.executable);

    // ROM compactada (.zip/.7z) é extraída para a pasta temporária do GameStock
    // e o emulador recebe o arquivo extraído; demais formatos passam direto.
    const launchRomPath = await prepareRomPathForLaunch(game.rom_path);

    let args: string[];
    if (emulator.is_retroarch) {
      // RetroArch requer o core via flag -L antes do caminho da ROM
      const corePath = resolveRetroArchCorePath(pe.core_path, resolvedExecutable.resolvedPath, game.platform_name ?? "");
      if (!corePath) throw new Error("Core do RetroArch não configurado para esta plataforma");
      args = ["-L", corePath, launchRomPath];
    } else {
      // Emuladores genéricos: args configurados pelo usuário + caminho da ROM
      const parsedArgs = emulator.args.trim() ? emulator.args.trim().split(/\s+/) : [];
      args = [...parsedArgs, launchRomPath];
    }

    await spawnDetachedProcess(resolvedExecutable.resolvedPath, args);
    games.incrementGameLaunchCount(gameId);
    return { success: true };
  });

  // ── Diálogos nativos de arquivo ────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.dialogs.openExecutableFile, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile"],
      // Em Linux mantemos "Todos os arquivos" para permitir binários sem extensão.
      filters: [
        { name: "Executáveis", extensions: executableDialogExtensionsForCurrentPlatform() },
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
    // Copia a imagem selecionada para o diretório de imagens do GameStock (timestamp como nome)
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

  // ── Shell / app ────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.shell.openPath, (_event, targetPath: string) => shell.openPath(targetPath));
  ipcMain.handle(IPC_CHANNELS.app.getVersion, () => APP_VERSION_LABEL);
  // Canal leve usado por botoes que precisam abrir a pasta de dados sem aguardar estatisticas.
  ipcMain.handle(IPC_CHANNELS.app.getDataDirPath, () => getUserDataDir());
  ipcMain.handle(IPC_CHANNELS.app.getStorageStats, () => getStorageStats());
  // Limpa apenas a pasta temporaria de ROMs extraidas; ROMs originais permanecem intactas.
  ipcMain.handle(IPC_CHANNELS.app.clearExtractedRomCache, () => clearExtractedRomCache());
  ipcMain.handle(IPC_CHANNELS.updater.skip, () => {
    requestUpdaterSkip();
  });
  // Permite disparar verificação manual pela tela "Sobre" no renderer.
  ipcMain.handle(IPC_CHANNELS.updater.checkNow, (event) => runManualUpdateFlow(event.sender));
  ipcMain.handle(IPC_CHANNELS.updater.getAppInfo, () => updaterAppInfo);

  // ── Estado persistido da UI (appState) ────────────────────────────────────
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

  // ── Portabilidade de dados (exportação/importação) ─────────────────────────
  ipcMain.handle(IPC_CHANNELS.dataPortability.exportPackage, async (_event, request: DataPortabilityExportRequest) => {
    let targetPath = request.targetPath?.trim() ?? "";
    if (!targetPath) {
      // Abre diálogo nativo de salvamento se o caminho não foi fornecido pelo renderer
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
    // Retorna jobs ordenados do mais recente para o mais antigo
    Array.from(dataPortabilityJobs.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  );

  // ── LaunchBox ──────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.launchbox.ensureMetadata, (_event, options?: { force?: boolean; jobId?: string }) =>
    ensureLaunchBoxMetadata(Boolean(options?.force), (progress) => sendLaunchBoxProgress(attachLaunchBoxJobId(progress, options?.jobId)))
  );
  ipcMain.handle(IPC_CHANNELS.launchbox.metadataExists, () => metadataExists());
  ipcMain.handle(IPC_CHANNELS.launchbox.searchGames, (_event, params) => searchGames(params));
  ipcMain.handle(IPC_CHANNELS.launchbox.downloadImages, (_event, params: LaunchBoxDownloadParams) =>
    downloadLaunchBoxImages(params, sendLaunchBoxProgress)
  );
  ipcMain.handle(IPC_CHANNELS.launchbox.importGame, (_event, params: LaunchBoxImportParams) => importGame(params, sendLaunchBoxProgress));

  // ── Importação de pastas de ROM ────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.romFolderImport.scan, (_event, params: RomFolderScanRequest) => scanRomFolder(params));
  ipcMain.handle(IPC_CHANNELS.romFolderImport.import, (_event, params: RomFolderImportRequest) => startRomFolderImportJob(params));
  ipcMain.handle(IPC_CHANNELS.romFolderImport.syncConfiguredFolders, async (_event, entries: DataPortabilityRomFolderEntry[]) => {
    await syncConfiguredRomFolders(entries);
  });
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

    // Remove também registros legados sem rom_path que correspondam aos títulos da pasta
    const scan = scanRomFolder({ folderPaths: [folderPath], platformId, includeSubfolders: true });
    const byLegacyTitles = games.deleteGamesWithoutRomPathByPlatformAndTitles(
      platformId,
      scan.candidates.map((candidate) => candidate.titleCandidate)
    );
    return { success: true as const, deleted: byRomPath.deleted + byLegacyTitles.deleted };
  });

  // ── Inventário de hardware físico ──────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.hardwareInventory.itemsList, (_event, filters) =>
    new HardwareItemDao(getDatabase()).list(filters)
  );
  ipcMain.handle(IPC_CHANNELS.hardwareInventory.itemsGet, (_event, id: number) =>
    new HardwareItemDao(getDatabase()).get(id)
  );
  ipcMain.handle(IPC_CHANNELS.hardwareInventory.itemsCreate, (_event, data) =>
    new HardwareItemDao(getDatabase()).create(data)
  );
  ipcMain.handle(IPC_CHANNELS.hardwareInventory.itemsUpdate, (_event, id: number, data) =>
    new HardwareItemDao(getDatabase()).update(id, data)
  );

  // Handler de exclusão: remove registros do banco e o diretório de fotos do disco.
  ipcMain.handle(IPC_CHANNELS.hardwareInventory.itemsDelete, (_event, id: number) => {
    const db = getDatabase();
    new HardwareItemDao(db).delete(id);
    // Após deletar o item (cascade apaga hardware_item_photos), remove os arquivos de foto.
    const itemImagesDir = path.join(getInventarioImagesDir(), String(id));
    if (fs.existsSync(itemImagesDir)) {
      fs.rmSync(itemImagesDir, { recursive: true, force: true });
    }
    return { success: true as const };
  });

  ipcMain.handle(IPC_CHANNELS.hardwareInventory.typesList, () =>
    new HardwareItemTypeDao(getDatabase()).list()
  );
  ipcMain.handle(IPC_CHANNELS.hardwareInventory.typesListWithCounts, () =>
    new HardwareItemTypeDao(getDatabase()).listWithCounts()
  );
  ipcMain.handle(IPC_CHANNELS.hardwareInventory.typesCreate, (_event, name: string) =>
    new HardwareItemTypeDao(getDatabase()).create(name)
  );
  ipcMain.handle(IPC_CHANNELS.hardwareInventory.typesDelete, (_event, id: number) => {
    new HardwareItemTypeDao(getDatabase()).delete(id);
    return { success: true as const };
  });

  ipcMain.handle(IPC_CHANNELS.hardwareInventory.statesList, () =>
    new HardwareConservationStateDao(getDatabase()).list()
  );
  ipcMain.handle(IPC_CHANNELS.hardwareInventory.statesListWithCounts, () =>
    new HardwareConservationStateDao(getDatabase()).listWithCounts()
  );
  ipcMain.handle(IPC_CHANNELS.hardwareInventory.statesCreate, (_event, name: string) =>
    new HardwareConservationStateDao(getDatabase()).create(name)
  );
  ipcMain.handle(IPC_CHANNELS.hardwareInventory.statesDelete, (_event, id: number) => {
    new HardwareConservationStateDao(getDatabase()).delete(id);
    return { success: true as const };
  });

  ipcMain.handle(IPC_CHANNELS.hardwareInventory.photosList, (_event, itemId: number) =>
    new HardwareItemPhotoDao(getDatabase()).listByItem(itemId)
  );

  // Handler de adição de foto: copia o arquivo para userData com nome UUID e cria registro no banco.
  ipcMain.handle(IPC_CHANNELS.hardwareInventory.photosAdd, (_event, itemId: number, sourcePath: string) => {
    const ext = path.extname(sourcePath).toLowerCase() || ".jpg";
    const uuid = crypto.randomUUID();
    const destDir = path.join(getInventarioImagesDir(), String(itemId));
    fs.mkdirSync(destDir, { recursive: true });
    const destPath = path.join(destDir, `${uuid}${ext}`);
    fs.copyFileSync(sourcePath, destPath);
    return new HardwareItemPhotoDao(getDatabase()).create(itemId, destPath);
  });

  // Handler de remoção de foto: apaga o arquivo do disco e remove o registro do banco.
  ipcMain.handle(IPC_CHANNELS.hardwareInventory.photosRemove, (_event, photoId: number) => {
    const db = getDatabase();
    const photoDao = new HardwareItemPhotoDao(db);
    const photo = db.prepare("SELECT file_path FROM hardware_item_photos WHERE id = ?").get(photoId) as { file_path: string } | undefined;
    photoDao.delete(photoId);
    if (photo?.file_path && fs.existsSync(photo.file_path)) {
      fs.unlinkSync(photo.file_path);
    }
    return { success: true as const };
  });

  ipcMain.handle(IPC_CHANNELS.hardwareInventory.photosReorder, (_event, idA: number, idB: number) => {
    new HardwareItemPhotoDao(getDatabase()).reorder(idA, idB);
    return { success: true as const };
  });

  ipcMain.handle(IPC_CHANNELS.hardwareInventory.platformsWithItems, () =>
    new HardwareItemDao(getDatabase()).listPlatformsWithItems()
  );
}

/** Envia progresso de operação LaunchBox para o renderer via IPC push. */
function sendLaunchBoxProgress(progress: LaunchBoxProgress): void {
  mainWindow?.webContents.send(IPC_CHANNELS.launchbox.progress, progress);
}

/**
 * Anexa o `jobId` do renderer ao payload de progresso do LaunchBox.
 * Isso permite que o store atualize o card correto quando houver mais de um job ativo.
 */
function attachLaunchBoxJobId(progress: LaunchBoxProgress, jobId?: string): LaunchBoxProgress {
  if (!jobId) return progress;
  return { ...progress, jobId };
}

/** Envia estatísticas atualizadas de capas para o renderer via IPC push. */
function sendCoverStats(): void {
  mainWindow?.webContents.send(IPC_CHANNELS.games.coverStatsUpdated, {
    ...games.getCoverStats(),
    metadataDownloadedAt: getLaunchBoxMetadataDownloadedAt()
  });
}

/** Envia progresso de importação de pasta de ROM para o renderer via IPC push. */
function sendRomFolderImportProgress(progress: RomFolderImportProgress): void {
  mainWindow?.webContents.send(IPC_CHANNELS.romFolderImport.progress, progress);
}

/** Envia progresso de portabilidade de dados para o renderer via IPC push. */
function sendDataPortabilityProgress(progress: DataPortabilityProgress): void {
  mainWindow?.webContents.send(IPC_CHANNELS.dataPortability.progress, progress);
}

/** União discriminada das mensagens recebidas do worker de portabilidade de dados. */
type DataPortabilityWorkerMessage =
  | { type: "progress"; progress: DataPortabilityProgress }
  | { type: "completed"; result: DataPortabilityExportResult | DataPortabilityImportResult }
  | { type: "error"; error: string };

/**
 * Inicia um job de portabilidade de dados (exportação ou importação) em worker thread.
 *
 * O worker executa a operação pesada (empacotar/desempacotar ZIP) sem bloquear o
 * processo principal. Progresso e resultado são comunicados via mensagens do worker.
 *
 * @returns O objeto do job recém-criado (status inicial: "running").
 */
function startDataPortabilityJob(
  kind: "export",
  request: DataPortabilityExportRequest & { targetPath: string }
): DataPortabilityJob;
function startDataPortabilityJob(kind: "import", request: DataPortabilityImportRequest): DataPortabilityJob;
function startDataPortabilityJob(
  kind: "export" | "import",
  request: (DataPortabilityExportRequest & { targetPath: string }) | DataPortabilityImportRequest
): DataPortabilityJob {
  // ID único para rastreamento do job nesta sessão
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

  // Inicia o worker thread com os dados necessários para a operação
  const worker = new Worker(path.join(__dirname, "dataPortabilityWorker.js"), {
    workerData: {
      jobId,
      kind,
      request,
      appVersion: APP_VERSION_LABEL,
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
        // Atualiza packagePath com o caminho final (pode ter sido ajustado pela extensão)
        job.packagePath = job.exportResult.filePath;
      } else {
        job.importResult = message.result as DataPortabilityImportResult;
        // Após importação, atualiza stats de capa (podem ter mudado)
        sendCoverStats();
      }
      mainWindow?.webContents.send(IPC_CHANNELS.dataPortability.completed, job);
      return;
    }

    // Mensagem de erro do worker
    failDataPortabilityJob(job, message.error);
  });

  worker.on("error", (error) => {
    failDataPortabilityJob(job, error.message);
  });

  worker.on("exit", (code) => {
    // Worker encerrou com código não-zero sem ter enviado mensagem de erro
    if (code !== 0 && job.status === "running") {
      failDataPortabilityJob(job, `Worker de portabilidade encerrou com codigo ${code}`);
    }
  });

  return job;
}

/**
 * Marca um job de portabilidade como falho e notifica o renderer.
 * Operação idempotente: ignora se o job já não está em execução.
 */
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

/**
 * Inicia um job de importação de pasta de ROM em background (async, sem worker thread).
 *
 * O scan é síncrono e imediato; a importação em si (matching + download de imagens)
 * é assíncrona e executa no processo principal, reportando progresso via IPC push.
 *
 * @param params - Parâmetros da importação (pastas, plataforma, opções).
 * @returns O objeto do job recém-criado com status inicial "running".
 */
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

  // Importação assíncrona: não bloqueia o retorno do IPC handler
  const completion = importRomFolder(params, (progress) => {
    const nextProgress = { ...progress, jobId };
    job.progress = nextProgress;
    sendRomFolderImportProgress(nextProgress);
    // Atualiza stats de capa quando um jogo é processado com sucesso
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
    })
    .finally(() => {
      romFolderJobCompletions.delete(jobId);
    });

  romFolderJobCompletions.set(jobId, completion);

  return job;
}

/**
 * Faz sync incremental das pastas configuradas no app.
 *
 * Estratégia:
 * - escaneia cada pasta configurada;
 * - compara os candidatos encontrados com os `rom_path` já salvos no SQLite;
 * - inicia import apenas para arquivos novos;
 * - executa um job por grupo, em sequência, para evitar downloads concorrentes do LaunchBox.
 *
 * Não remove registros ausentes no disco, porque isso seria arriscado em aberturas
 * com HD externo desconectado ou pasta temporariamente indisponível.
 */
async function syncConfiguredRomFolders(entries: DataPortabilityRomFolderEntry[]): Promise<void> {
  if (!entries.length) return;
  if (Array.from(romFolderJobs.values()).some((job) => job.status === "running")) return;

  const folderGroups = groupConfiguredRomFolders(entries);

  for (const group of folderGroups) {
    try {
      const manualPlatformId = group.mode === "manual" ? group.platformId ?? undefined : undefined;
      if (group.mode === "manual" && !manualPlatformId) continue;
      const scanRequest: RomFolderScanRequest = group.mode === "automatic"
        ? {
          folderPaths: [group.folderPath],
          detectionMode: "automatic",
          includeSubfolders: group.includeSubfolders
        }
        : {
          folderPaths: [group.folderPath],
          platformId: manualPlatformId,
          detectionMode: "manual",
          includeSubfolders: group.includeSubfolders
        };
      const scan = scanRomFolder(scanRequest);
      const knownRomPaths = new Set(
        games
          .listRomPathsByFolder(group.folderPath, manualPlatformId)
          .map(normalizeRomPathForSync)
      );
      const newRomFilePaths = scan.candidates
        .filter((candidate) => !knownRomPaths.has(normalizeRomPathForSync(candidate.romPath)))
        .map((candidate) => candidate.romPath);

      if (!newRomFilePaths.length) continue;

      const job = startRomFolderImportJob({
        folderPaths: [],
        romFilePaths: newRomFilePaths,
        platformId: manualPlatformId ?? null,
        detectionMode: group.mode,
        includeSubfolders: group.includeSubfolders
      });
      await romFolderJobCompletions.get(job.jobId);
    } catch (error) {
      // Pasta ausente ou inacessível não deve poluir a UI a cada abertura.
      console.warn("[romFolderImport] Falha ao sincronizar pasta configurada:", group.folderPath, error);
    }
  }
}

/** Grupo interno usado para decidir se o sync será manual ou automático por pasta. */
interface ConfiguredRomFolderGroup {
  folderPath: string;
  includeSubfolders: boolean;
  mode: "manual" | "automatic";
  platformId: number | null;
}

/**
 * Agrupa entradas persistidas por pasta e infere o modo de sync.
 *
 * Quando a mesma pasta aparece em múltiplas plataformas, tratamos como origem
 * automática para preservar o comportamento de detecção por extensão.
 */
function groupConfiguredRomFolders(entries: DataPortabilityRomFolderEntry[]): ConfiguredRomFolderGroup[] {
  const grouped = new Map<string, DataPortabilityRomFolderEntry[]>();

  for (const entry of entries) {
    const current = grouped.get(entry.folderPath) ?? [];
    current.push(entry);
    grouped.set(entry.folderPath, current);
  }

  return Array.from(grouped.entries())
    .map(([folderPath, folderEntries]) => {
      const multiplePlatforms = new Set(folderEntries.map((entry) => entry.platformId)).size > 1;
      return {
        folderPath,
        includeSubfolders: folderEntries.some((entry) => Boolean(entry.includeSubfolders)),
        mode: multiplePlatforms ? "automatic" : "manual",
        platformId: multiplePlatforms ? null : folderEntries[0]?.platformId ?? null
      } satisfies ConfiguredRomFolderGroup;
    })
    .sort((a, b) => a.folderPath.localeCompare(b.folderPath, undefined, { sensitivity: "base" }));
}

/** Normaliza `rom_path` para comparação estável durante o sync incremental. */
function normalizeRomPathForSync(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, "/").toLowerCase();
}

// ── Ciclo de vida do Electron ──────────────────────────────────────────────

void bootstrapApplication();

app.on("activate", () => {
  // macOS: recria a janela se o app for ativado sem janelas abertas (clique no dock)
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

/**
 * Inicializa a aplicação com splash + updater quando configurado.
 *
 * Em ambiente local sem `UPDATE_MANIFEST_URL`, o boot segue direto para a
 * janela principal para não atrapalhar o fluxo de desenvolvimento.
 */
async function bootstrapApplication(): Promise<void> {
  await app.whenReady();
  Menu.setApplicationMenu(null); // Remove menu nativo padrão do Electron
  registerMediaProtocol();
  registerIpc();

  if (!UPDATE_MANIFEST_URL || !supportsInPlaceAutoUpdate()) {
    await createWindow();
    return;
  }

  const splashWindow = await createSplashWindow();
  const flowResult = await runUpdateFlow(splashWindow);
  if (flowResult !== "open-main") return;

  // Criamos a principal antes de fechar a splash para evitar `window-all-closed`.
  const createMainWindowPromise = createWindow();
  if (!splashWindow.isDestroyed()) {
    splashWindow.close();
  }
  await createMainWindowPromise;
}

// ── Protocolo customizado gamestock-media ──────────────────────────────────

/**
 * Registra o protocolo `gamestock-media://` para servir arquivos de imagem locais
 * ao renderer de forma segura (apenas dentro do diretório de dados do usuário).
 *
 * URL format: `gamestock-media://?path=/absolute/path/to/image.jpg`
 *
 * Rejeita caminhos que tentem escapar do diretório de dados (prevenção de path traversal).
 */
function registerMediaProtocol(): void {
  protocol.handle("gamestock-media", (request) => {
    const filePath = new URL(request.url).searchParams.get("path");
    if (!filePath) return new Response("Missing path", { status: 400 });

    const normalized = path.resolve(filePath);
    const allowedRoot = path.resolve(getUserDataDir());
    // Garante que o caminho solicitado está dentro do diretório de dados do usuário
    if (normalized !== allowedRoot && !normalized.startsWith(`${allowedRoot}${path.sep}`)) {
      return new Response("Forbidden", { status: 403 });
    }

    return net.fetch(pathToFileURL(normalized).toString());
  });
}

// ── Mídia de jogos ─────────────────────────────────────────────────────────

/** Extensões de arquivo reconhecidas como mídia de jogos. */
const MEDIA_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

/**
 * Lista os arquivos de mídia de um jogo, excluindo a capa principal (cover.jpg),
 * ordenados por tipo (box-art, cart, background, screenshot, outros).
 *
 * Apenas retorna arquivos dentro do diretório de dados do usuário (segurança).
 */
function listGameMedia(id: number): GameMediaItem[] {
  const game = games.getGame(id);
  if (!game) return [];

  // Determina o diretório de mídia a partir dos caminhos de arquivo já conhecidos do jogo
  const mediaPaths = [game.box_art_path, game.background_path, game.screenshot_path].filter(Boolean) as string[];
  const mediaDir = mediaPaths.map((filePath) => path.dirname(filePath)).find((dir) => isPathAllowed(dir));
  if (!mediaDir || !fs.existsSync(mediaDir)) return [];

  return fs.readdirSync(mediaDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && MEDIA_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(mediaDir, entry.name))
    .filter((filePath) => isPathAllowed(filePath))
    .filter((filePath) => mediaKind(filePath) !== "cover") // Exclui cover.jpg (exibida separadamente)
    .sort((a, b) => mediaSortWeight(a) - mediaSortWeight(b) || path.basename(a).localeCompare(path.basename(b)))
    .map((filePath) => ({
      path: filePath,
      label: mediaLabel(filePath),
      kind: mediaKind(filePath)
    }));
}

/**
 * Verifica se um caminho está dentro do diretório de dados do usuário.
 * Usado como barreira de segurança antes de servir ou listar arquivos.
 */
function isPathAllowed(targetPath: string): boolean {
  const normalized = path.resolve(targetPath);
  const allowedRoot = path.resolve(getUserDataDir());
  return normalized === allowedRoot || normalized.startsWith(`${allowedRoot}${path.sep}`);
}

/**
 * Classifica o tipo de mídia de um arquivo a partir de seu nome.
 * Convenção de nomes usada pelo scraper LaunchBox.
 */
function mediaKind(filePath: string): GameMediaItem["kind"] {
  const filename = path.basename(filePath).toLowerCase();
  if (filename === "cover.jpg") return "cover";
  if (filename.startsWith("box-")) return "box-art";
  if (filename.startsWith("cart-")) return "cart";
  if (filename.startsWith("fanart-background")) return "background";
  if (filename.startsWith("screenshot-")) return "screenshot";
  return "other";
}

/**
 * Retorna o rótulo legível de um arquivo de mídia para exibição na UI.
 * Converte o nome do arquivo (slug) em título capitalizado.
 */
function mediaLabel(filePath: string): string {
  const filename = path.basename(filePath, path.extname(filePath)).toLowerCase();
  if (filename === "cover") return "Cover";
  return filename
    .replace(/-\d+$/g, "") // Remove sufixo numérico (ex.: box-front-01 → box-front)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Retorna o peso de ordenação de um arquivo de mídia para exibição na galeria.
 * Tipos mais importantes aparecem primeiro.
 */
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

// ── Utilitários de processo ────────────────────────────────────────────────

/**
 * Inicia um processo filho desanexado do processo principal (detached).
 * Resolve quando o processo filho confirmar que iniciou (`spawn` event).
 * Rejeita se houver erro antes do início.
 *
 * Usado para abrir emuladores sem manter o processo filho vinculado ao GameStock.
 */
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
      child.unref(); // Permite que o processo principal encerre sem aguardar o filho
      resolve();
    });
  });
}

/**
 * Retorna extensões de conveniência exibidas no seletor nativo de executável.
 *
 * A entrada manual continua suportando binários sem extensão em Linux/macOS.
 */
function executableDialogExtensionsForCurrentPlatform(): string[] {
  if (process.platform === "win32") {
    return ["exe", "bat", "cmd", "com"];
  }

  if (process.platform === "darwin") {
    return ["app", "command", "sh"];
  }

  return ["AppImage", "sh", "bin", "run"];
}

// ── RetroArch ──────────────────────────────────────────────────────────────

/**
 * Resolve o caminho absoluto do core RetroArch para uma plataforma.
 *
 * Estratégias em ordem:
 * 1. Caminho configurado pelo usuário (absoluto ou relativo ao diretório cores/).
 * 2. Candidatos automáticos baseados no nome da plataforma (de `getRetroArchCoreCandidatesForPlatform`).
 *
 * @param configuredCorePath - Caminho configurado pelo usuário (pode ser nulo).
 * @param retroArchExecutable - Caminho do executável RetroArch (para derivar o diretório cores/).
 * @param platformName - Nome da plataforma para busca de candidatos automáticos.
 */
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

  // Tenta candidatos automáticos baseados no nome da plataforma
  const candidates = getRetroArchCoreCandidatesForPlatform(platformName);
  for (const candidate of candidates) {
    const corePath = resolveRetroArchCoreCandidate(candidate, coresDir);
    if (corePath) return corePath;
  }

  return null;
}

/**
 * Retorna estatisticas de armazenamento com cache curto.
 * O calculo de tamanho pode varrer muitas imagens, entao chamadas simultaneas
 * reutilizam a mesma Promise e chamadas proximas reutilizam cache.
 */
function getStorageStats(): Promise<AppStorageStats> {
  const now = Date.now();
  if (cachedStorageStats && cachedStorageStats.expiresAt > now) {
    return Promise.resolve(cachedStorageStats.value);
  }
  if (pendingStorageStats) return pendingStorageStats;

  pendingStorageStats = buildStorageStats()
    .then((value) => {
      cachedStorageStats = { value, expiresAt: Date.now() + STORAGE_STATS_CACHE_MS };
      return value;
    })
    .finally(() => {
      pendingStorageStats = null;
    });

  return pendingStorageStats;
}

/**
 * Monta estatisticas de armazenamento usadas em Backup/Sobre.
 * Mantem SQL rapido separado da varredura de disco, que roda de forma assincrona.
 */
async function buildStorageStats(): Promise<AppStorageStats> {
  const dataDirPath = getUserDataDir();
  const totalGames = games.getCoverStats().total;
  const dataDirSizeMb = Math.round(await getDirSizeBytes(dataDirPath) / (1024 * 1024) * 10) / 10;
  return { totalGames, dataDirSizeMb, dataDirPath };
}

/**
 * Calcula o tamanho total em bytes de um diretorio recursivamente.
 * Usa APIs async para nao bloquear o main process durante varredura grande.
 */
async function getDirSizeBytes(dirPath: string): Promise<number> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return 0;
  }

  let total = 0;
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += await getDirSizeBytes(full);
    } else if (entry.isFile()) {
      try {
        total += (await fs.promises.stat(full)).size;
      } catch {
        // Arquivos de cache podem ser removidos durante a varredura; ignorar mantem a UI responsiva.
      }
    }
  }
  return total;
}

/**
 * Tenta resolver um nome/caminho de core RetroArch para um caminho absoluto existente.
 *
 * Tentativas em ordem:
 * 1. Caminho absoluto direto.
 * 2. Relativo ao diretório cores/ ou ao diretório pai do RetroArch.
 * 3. Nome base com extensões de plataforma (.dll, .so, .dylib) dentro do diretório cores/.
 */
function resolveRetroArchCoreCandidate(coreCandidate: string, coresDir: string): string | null {
  // Tenta como caminho absoluto primeiro
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

  // Se não tem extensão no candidato, tenta com extensões de biblioteca nativa
  if (path.basename(coreCandidate) !== coreCandidate) return null;

  for (const fileName of getRetroArchCoreFileNames(coreCandidate)) {
    const candidatePath = path.join(coresDir, fileName);
    if (fs.existsSync(candidatePath)) return candidatePath;
  }

  return null;
}

/**
 * Retorna os nomes de arquivo candidatos para um core RetroArch dado apenas o nome base.
 * Se já tiver extensão, retorna somente o nome original.
 */
function getRetroArchCoreFileNames(coreName: string): string[] {
  if (path.extname(coreName)) return [coreName];
  // Gera variantes para Windows (.dll), Linux (.so) e macOS (.dylib)
  return [".dll", ".so", ".dylib"].map((extension) => `${coreName}${extension}`);
}

/**
 * Lista os cores RetroArch instalados para um emulador configurado.
 *
 * Retorna inventário com:
 * - Estado do diretório cores/ (existe/não existe)
 * - Se o executável está configurado
 * - Lista de nomes de cores instalados (sem extensão, deduplicados e ordenados)
 */
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

  const resolvedExecutable = resolveConfiguredExecutable(executable);
  const coresDir = path.join(path.dirname(resolvedExecutable.resolvedPath), "cores");
  if (!fs.existsSync(coresDir)) {
    return {
      coresDir,
      coresDirExists: false,
      executableConfigured: true,
      installedCores: []
    };
  }

  // Lista cores únicos (sem extensão) em ordem alfabética
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
