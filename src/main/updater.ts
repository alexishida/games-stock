/**
 * Atualiza instalacoes NSIS usando artefatos padrao do electron-builder.
 *
 * O electron-updater le `latest.yml`, instalador NSIS e blockmap publicados na
 * GitHub Release. Nenhum ZIP ou staging proprio e criado pelo GameStock.
 */

import { app, BrowserWindow, WebContents } from "electron";
import { autoUpdater, ProgressInfo, UpdateInfo } from "electron-updater";
import fs from "node:fs";
import path from "node:path";
import { getAppUserDataDir } from "./appPaths";
import { IPC_CHANNELS } from "../shared/ipc-channels";
import { BUILD_NUMBER } from "../shared/update-config";
import { UpdaterStatus } from "../shared/updater";

/** Tempo maximo para verificacao automatica antes de liberar janela principal. */
const UPDATE_FLOW_TIMEOUT_MS = 30_000;

/** Codigos de rede convertidos em estado offline para renderer. */
const NETWORK_ERROR_CODES = new Set(["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"]);

/** Erro de update que pode informar codigo de rede. */
type UpdaterError = Error & { code?: string };

/** Estado compartilhado que evita dois downloads manuais simultaneos. */
let activeManualUpdateFlow: Promise<void> | null = null;

/** Resolver acionado quando usuario decide abrir app sem aguardar verificacao. */
let skipResolver: (() => void) | null = null;

/**
 * Configura download explicito para manter splash e modal sincronizados com UI.
 */
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

/**
 * Indica se instalacao atual pode receber atualizacao nativa NSIS.
 *
 * Build portatil nao possui instalador para substituir e continua atualizada por
 * download manual do arquivo gerado pelo electron-builder.
 */
export function supportsInPlaceAutoUpdate(): boolean {
  return app.isPackaged && process.platform === "win32" && !process.env.PORTABLE_EXECUTABLE_DIR;
}

/**
 * Libera splash sem esperar consulta remota, preservando abertura offline.
 */
export function requestUpdaterSkip(): void {
  skipResolver?.();
  skipResolver = null;
}

/**
 * Executa check, download e instalacao padrao antes de criar janela principal.
 */
export async function runUpdateFlow(splashWindow: BrowserWindow): Promise<"open-main" | "relaunching"> {
  if (!supportsInPlaceAutoUpdate()) {
    emitOpenMain(splashWindow);
    return "open-main";
  }

  try {
    emitStatus(splashWindow, { phase: "checking", message: "Verificando atualizacoes..." });
    const updateInfo = await waitForAutomaticCheck();

    if (updateInfo === false) {
      emitOpenMain(splashWindow);
      return "open-main";
    }

    if (!updateInfo) {
      emitStatus(splashWindow, { phase: "up-to-date", message: "GameStock ja esta atualizado." });
      emitOpenMain(splashWindow);
      return "open-main";
    }

    await downloadAndInstall(updateInfo, splashWindow);
    return "relaunching";
  } catch (error) {
    const status = buildErrorStatus(error, true);
    console.error("[updater] Falha no fluxo automatico:", error);
    emitStatus(splashWindow, status);

    if (status.phase === "no-connection") {
      await waitForSkipRequest();
    }

    emitOpenMain(splashWindow);
    return "open-main";
  } finally {
    skipResolver = null;
  }
}

/**
 * Executa verificacao manual e instala somente em instalacao NSIS suportada.
 */
export async function runManualUpdateFlow(targetContents: WebContents): Promise<void> {
  if (activeManualUpdateFlow) return activeManualUpdateFlow;

  activeManualUpdateFlow = (async () => {
    try {
      emitStatus(targetContents, { phase: "checking", message: "Verificando atualizacoes..." });
      const updateCheck = await autoUpdater.checkForUpdates();
      const remoteInfo = updateCheck?.isUpdateAvailable ? updateCheck.updateInfo : null;

      if (!remoteInfo) {
        emitStatus(targetContents, { phase: "up-to-date", message: "GameStock ja esta atualizado." });
        return;
      }

      if (!supportsInPlaceAutoUpdate()) {
        emitStatus(targetContents, {
          phase: "external-update",
          message: "Atualizacao disponivel. Instale arquivo publicado na GitHub Release.",
          ...buildUpdateStatusDetails(remoteInfo)
        });
        return;
      }

      await downloadAndInstall(remoteInfo, targetContents);
    } catch (error) {
      console.error("[updater] Falha na verificacao manual:", error);
      emitStatus(targetContents, buildErrorStatus(error, false));
    } finally {
      activeManualUpdateFlow = null;
    }
  })();

  return activeManualUpdateFlow;
}

/** Dados locais da instalacao exibidos na splash e em Configuracoes. */
export const updaterAppInfo = {
  version: app.getVersion(),
  buildNumber: BUILD_NUMBER
};

/**
 * Espera check automatico, timeout global ou escolha explicita de seguir offline.
 */
async function waitForAutomaticCheck(): Promise<UpdateInfo | null | false> {
  const timeoutPromise = new Promise<false>((resolve) => {
    setTimeout(resolve, UPDATE_FLOW_TIMEOUT_MS, false);
  });
  const skipPromise = new Promise<false>((resolve) => {
    skipResolver = () => resolve(false);
  });
  // Catch no updatePromise evita unhandled rejection quando race já resolveu
  // (skip/timeout) e o check rejeita depois — comum com DNS/offline.
  const updatePromise = autoUpdater
    .checkForUpdates()
    .then((result) => (result?.isUpdateAvailable ? result.updateInfo : null))
    .catch((error) => {
      console.warn("[updater] Falha no check automatico:", error);
      return null;
    });

  return Promise.race([updatePromise, timeoutPromise, skipPromise]);
}

/**
 * Baixa artefato NSIS padrao, envia progresso e delega instalacao ao updater.
 */
async function downloadAndInstall(updateInfo: UpdateInfo, target: BrowserWindow | WebContents): Promise<void> {
  emitStatus(target, {
    phase: "downloading",
    message: `Baixando atualizacao v${updateInfo.version}...`,
    percent: 0,
    ...buildUpdateStatusDetails(updateInfo)
  });

  const onProgress = (progress: ProgressInfo): void => {
    emitStatus(target, {
      phase: "downloading",
      message: `Baixando atualizacao v${updateInfo.version}...`,
      percent: Math.round(progress.percent),
      ...buildUpdateStatusDetails(updateInfo)
    });
  };

  autoUpdater.on("download-progress", onProgress);
  try {
    await autoUpdater.downloadUpdate();
  } finally {
    autoUpdater.removeListener("download-progress", onProgress);
  }

  emitStatus(target, {
    phase: "applying",
    message: "Instalando atualizacao e reiniciando...",
    ...buildUpdateStatusDetails(updateInfo)
  });

  // NSIS encerra processo atual e executa instalador baixado pelo electron-updater.
  autoUpdater.quitAndInstall();
}

/**
 * Converte metadados de `latest.yml` para contrato ja usado pelo renderer.
 */
function buildUpdateStatusDetails(updateInfo: UpdateInfo): Pick<UpdaterStatus, "version" | "releaseDate" | "releaseNotes"> {
  return {
    version: updateInfo.version,
    releaseDate: updateInfo.releaseDate,
    releaseNotes: normalizeReleaseNotes(updateInfo.releaseNotes)
  };
}

/**
 * Normaliza notas que podem vir como texto ou lista por plataforma.
 */
function normalizeReleaseNotes(releaseNotes: UpdateInfo["releaseNotes"]): string | undefined {
  if (typeof releaseNotes === "string") return releaseNotes;
  if (!Array.isArray(releaseNotes)) return undefined;
  return releaseNotes.map((note) => note.note).filter(Boolean).join("\n\n") || undefined;
}

/**
 * Gera status seguro para rede indisponivel ou falha de metadados/instalacao.
 */
function buildErrorStatus(error: unknown, requiresAction: boolean): UpdaterStatus {
  const message = error instanceof Error ? error.message : "Falha inesperada no updater.";
  const isNetworkFailure = isConnectionError(error);

  return {
    phase: isNetworkFailure ? "no-connection" : "error",
    message: isNetworkFailure ? "Sem conexao para verificar atualizacoes." : "Falha ao atualizar GameStock.",
    error: message,
    errorLogPath: appendUpdaterErrorLog(error),
    requiresAction
  };
}

/**
 * Envia status para splash ou janela principal sem tentar usar renderer destruido.
 */
function emitStatus(target: BrowserWindow | WebContents, status: UpdaterStatus): void {
  const webContents = target instanceof BrowserWindow ? target.webContents : target;
  if (!webContents.isDestroyed()) webContents.send(IPC_CHANNELS.updater.status, status);
}

/**
 * Libera criacao da janela principal apos splash terminar fluxo de update.
 */
function emitOpenMain(splashWindow: BrowserWindow): void {
  if (!splashWindow.isDestroyed()) splashWindow.webContents.send(IPC_CHANNELS.updater.openMain);
}

/**
 * Espera botao da splash quando check automatico falha por falta de conexao.
 */
function waitForSkipRequest(): Promise<void> {
  return new Promise((resolve) => {
    skipResolver = resolve;
  });
}

/**
 * Classifica codigos de socket e DNS como indisponibilidade de rede.
 */
function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return NETWORK_ERROR_CODES.has((error as UpdaterError).code ?? "");
}

/**
 * Persiste detalhes para diagnostico sem impedir abertura normal do aplicativo.
 */
function appendUpdaterErrorLog(error: unknown): string {
  try {
    const logsDir = path.join(getAppUserDataDir(), "logs");
    const logPath = path.join(logsDir, "updater-error.log");
    const details = error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack ?? "stack indisponivel"}`
      : String(error);

    fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(logPath, `[${new Date().toISOString()}]\n${details}\n\n`, "utf8");
    return logPath;
  } catch {
    return "";
  }
}
