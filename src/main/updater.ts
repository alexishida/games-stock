/**
 * Orquestra o fluxo de atualização automática antes da janela principal abrir.
 *
 * Responsabilidades:
 * - Consultar o manifesto remoto com timeout curto.
 * - Comparar a versão local com a remota.
 * - Baixar o pacote ZIP com progresso.
 * - Extrair para staging e relançar o app.
 * - Aplicar staging no próximo boot quando a flag `--apply-update` existir.
 */

import { app, BrowserWindow, WebContents } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import https from "node:https";
import { pipeline } from "node:stream/promises";
import { Worker } from "node:worker_threads";
import { getAppUserDataDir } from "./appPaths";
import { IPC_CHANNELS } from "../shared/ipc-channels";
import { BUILD_NUMBER, UPDATE_MANIFEST_URL } from "../shared/update-config";
import { UpdateManifest, UpdaterStatus } from "../shared/updater";

/** Variante real publicada hoje no S3 com chaves legadas em pt-br. */
type LegacyPtBrManifest = {
  data?: string;
  versao?: string;
  build?: string | number;
  path?: string;
};

/** Tempo máximo para buscar o manifesto remoto sem travar o boot do app. */
const UPDATE_CHECK_TIMEOUT_MS = 5_000;

/** Tempo máximo total permitido para a splash permanecer aberta. */
const UPDATE_FLOW_TIMEOUT_MS = 30_000;

/** Códigos de erro tratados como falta de conexão e não como erro de servidor. */
const NETWORK_ERROR_CODES = new Set(["ENOTFOUND", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"]);

/** Assinatura do callback de progresso usado durante o download do ZIP. */
type DownloadProgressCallback = (progress: {
  receivedBytes: number;
  totalBytes: number | null;
  percent: number;
}) => void;

/** Resultado do check remoto, discriminado por estado do fluxo. */
type UpdateCheckResult =
  | { kind: "update-available"; manifest: UpdateManifest }
  | { kind: "up-to-date"; manifest: UpdateManifest }
  | { kind: "error"; error: string }
  | { kind: "no-connection"; error: string };

/** Erro enriquecido com metadados de rede/HTTP para classificação posterior. */
type UpdaterError = Error & {
  code?: string;
  statusCode?: number;
};

/** Resolver pendente do botão de continuação na splash. */
let continueResolver: (() => void) | null = null;

/** Flag em memória para evitar perder cliques caso o handler chegue cedo. */
let continueRequested = false;

/** Falha pendente ocorrida ao aplicar staging no boot seguinte ao download. */
let pendingStartupUpdaterFailure: UpdaterStatus | null = null;

/** Promise compartilhada para evitar múltiplos checks manuais em paralelo. */
let activeManualUpdateFlow: Promise<void> | null = null;

/**
 * Permite que o handler IPC marque que o usuário escolheu seguir offline.
 *
 * O resolver pendente é disparado imediatamente quando existir; caso contrário,
 * a flag fica guardada até `runUpdateFlow()` passar a esperar esse evento.
 */
export function requestUpdaterSkip(): void {
  continueRequested = true;
  continueResolver?.();
  continueResolver = null;
}

/**
 * Entrega e limpa eventual falha de aplicação de update ocorrida no startup.
 *
 * Esse estado nasce antes da splash existir, então fica em memória até o fluxo
 * de boot pedir o valor para renderizar o erro ao usuário.
 */
function consumePendingStartupUpdaterFailure(): UpdaterStatus | null {
  const failure = pendingStartupUpdaterFailure;
  pendingStartupUpdaterFailure = null;
  return failure;
}

/**
 * Consulta o manifesto remoto e decide se existe update disponível.
 *
 * Diferencia erro de rede (`no-connection`) de erro de servidor/JSON (`error`)
 * para a splash renderizar o estado correto.
 */
export async function checkForUpdate(): Promise<UpdateCheckResult> {
  if (!UPDATE_MANIFEST_URL) {
    return { kind: "error", error: "Manifesto de update não configurado." };
  }

  try {
    const responseText = await requestText(UPDATE_MANIFEST_URL, UPDATE_CHECK_TIMEOUT_MS);
    const manifest = parseManifest(JSON.parse(responseText) as unknown);
    return shouldApplyRemoteUpdate(manifest, app.getVersion(), BUILD_NUMBER)
      ? { kind: "update-available", manifest }
      : { kind: "up-to-date", manifest };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao verificar atualizações.";
    if (isConnectionError(error)) {
      return { kind: "no-connection", error: message };
    }

    return { kind: "error", error: message };
  }
}

/**
 * Compara duas versões semânticas simples (`x.y.z`), ignorando sufixos textuais.
 *
 * Retorna:
 * - valor > 0 quando `left` é maior
 * - 0 quando são equivalentes
 * - valor < 0 quando `right` é maior
 */
export function compareSemver(left: string, right: string): number {
  const leftParts = normalizeSemver(left);
  const rightParts = normalizeSemver(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return 0;
}

/**
 * Baixa o ZIP de atualização para um diretório temporário do sistema.
 *
 * O callback é chamado a cada chunk recebido para atualizar a barra de
 * progresso da splash.
 */
export async function downloadUpdate(
  url: string,
  onProgress: DownloadProgressCallback,
  signal?: AbortSignal
): Promise<string> {
  const tempDir = path.join(os.tmpdir(), "gamestock-updater");
  const filePath = path.join(tempDir, `update-${Date.now()}.zip`);
  const downloadUrl = appendTimestampQuery(url);
  await fs.promises.mkdir(tempDir, { recursive: true });

  try {
    await downloadFile(downloadUrl, filePath, onProgress, signal);
    return filePath;
  } catch (error) {
    await fs.promises.rm(filePath, { force: true }).catch(() => undefined);
    throw error;
  }
}

/**
 * Extrai o ZIP baixado para o diretório de staging ao lado de `resourcesPath`.
 *
 * A extração não sobrescreve a instalação atual imediatamente; a cópia real
 * acontece no próximo boot via flag `--apply-update`.
 */
export async function applyUpdate(zipPath: string): Promise<string> {
  const stagingRoot = createUpdateStagingRoot();

  try {
    await extractUpdateArchive(zipPath, stagingRoot);

    if (!hasSupportedStagingPayload(stagingRoot)) {
      throw new Error("Pacote de atualização inválido: ZIP não contém app/ nem resources/app.asar.");
    }

    return stagingRoot;
  } catch (error) {
    // Remove apenas o staging desta tentativa; outros updates podem estar em outro sufixo.
    await cleanupStagingDir(stagingRoot);
    throw error;
  }
}

/**
 * Aplica um staging pendente quando o app relança com `--apply-update`.
 *
 * A cópia é síncrona porque precisa terminar antes de qualquer inicialização
 * visual ou carregamento do bundle antigo.
 */
export function applyStagedUpdateFromLaunchArgs(argv: string[] = process.argv): boolean {
  const stagingRoot = readApplyUpdateFlag(argv);
  if (!stagingRoot) return false;

  const sourceAppDir = path.join(stagingRoot, "app");
  const sourceAsarPath = path.join(stagingRoot, "resources", "app.asar");
  const sourceAsarUnpackedDir = path.join(stagingRoot, "resources", "app.asar.unpacked");

  if (!fs.existsSync(sourceAppDir) && !fs.existsSync(sourceAsarPath)) {
    registerPendingStartupUpdaterFailure(
      "Falha ao aplicar atualização baixada.",
      new Error("Staging de update inválido: conteúdo extraído não contém app/ nem resources/app.asar.")
    );
    cleanupStagingDirSync(stagingRoot);
    return false;
  }

  const targetAppDir = path.join(process.resourcesPath, "app");
  const targetAsarPath = path.join(process.resourcesPath, "app.asar");
  const targetAsarUnpackedDir = path.join(process.resourcesPath, "app.asar.unpacked");

  try {
    // Suporta dois formatos de pacote:
    // 1. `app/` em builds sem asar
    // 2. `resources/app.asar` + `app.asar.unpacked` em win-unpacked/NSIS
    if (fs.existsSync(sourceAppDir)) {
      fs.rmSync(targetAppDir, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(targetAppDir), { recursive: true });
      fs.cpSync(sourceAppDir, targetAppDir, { force: true, recursive: true });
    }

    if (fs.existsSync(sourceAsarPath)) {
      fs.mkdirSync(process.resourcesPath, { recursive: true });
      fs.copyFileSync(sourceAsarPath, targetAsarPath);
    }

    if (fs.existsSync(sourceAsarUnpackedDir)) {
      fs.rmSync(targetAsarUnpackedDir, { recursive: true, force: true });
      fs.cpSync(sourceAsarUnpackedDir, targetAsarUnpackedDir, { force: true, recursive: true });
    }

    cleanupStagingDirSync(stagingRoot);
    return true;
  } catch (error) {
    console.error("[updater] Falha ao aplicar staging de update:", error);
    registerPendingStartupUpdaterFailure("Falha ao aplicar atualização baixada.", error);
    cleanupStagingDirSync(stagingRoot);
    return false;
  }
}

/**
 * Executa o fluxo completo da splash: check, download, staging e relaunch.
 *
 * Retorna `"open-main"` quando a janela principal pode ser criada normalmente.
 * Em caso de update aplicado, o processo é relançado e a Promise não volta a
 * abrir a janela principal na sessão atual.
 */
export async function runUpdateFlow(splashWindow: BrowserWindow): Promise<"open-main" | "relaunching"> {
  continueRequested = false;
  continueResolver = null;

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
    requestUpdaterSkip();
  }, UPDATE_FLOW_TIMEOUT_MS);

  try {
    const startupFailure = consumePendingStartupUpdaterFailure();
    if (startupFailure) {
      emitStatus(splashWindow, startupFailure);
      await waitForContinueRequest();
      emitOpenMain(splashWindow);
      return "open-main";
    }

    emitStatus(splashWindow, {
      phase: "checking",
      message: "Verificando atualizações..."
    });

    const result = await checkForUpdate();
    if (abortController.signal.aborted) {
      emitOpenMain(splashWindow);
      return "open-main";
    }

    if (result.kind === "no-connection") {
      const logPath = appendUpdaterErrorLog(new Error(result.error));
      console.warn("[updater] Verificação em modo offline:", result.error);
      emitStatus(splashWindow, {
        phase: "no-connection",
        message: "Sem conexão para verificar atualizações.",
        requiresAction: true,
        error: result.error,
        errorLogPath: logPath
      });
      await waitForContinueRequest();
      emitOpenMain(splashWindow);
      return "open-main";
    }

    if (result.kind === "error") {
      const logPath = appendUpdaterErrorLog(new Error(result.error));
      console.error("[updater] Falha na verificação de update:", result.error);
      emitStatus(splashWindow, {
        phase: "error",
        message: "Falha ao verificar atualizações.",
        error: result.error,
        errorLogPath: logPath
      });
      await sleep(1_000);
      emitOpenMain(splashWindow);
      return "open-main";
    }

    if (result.kind === "up-to-date") {
      emitStatus(splashWindow, {
        phase: "up-to-date",
        message: "GameStock já está atualizado.",
        ...buildManifestStatusDetails(result.manifest)
      });
      await sleep(500);
      emitOpenMain(splashWindow);
      return "open-main";
    }

    emitStatus(splashWindow, {
      phase: "downloading",
      message: `Baixando atualização ${formatRemoteUpdateLabel(result.manifest)}...`,
      percent: 0,
      ...buildManifestStatusDetails(result.manifest)
    });

    const zipPath = await downloadUpdate(result.manifest.downloadUrl, (progress) => {
      emitStatus(splashWindow, {
        phase: "downloading",
        message: `Baixando atualização ${formatRemoteUpdateLabel(result.manifest)}...`,
        percent: progress.percent,
        ...buildManifestStatusDetails(result.manifest)
      });
    }, abortController.signal);

    if (abortController.signal.aborted) {
      emitOpenMain(splashWindow);
      return "open-main";
    }

    emitStatus(splashWindow, {
      phase: "applying",
      message: "Preparando atualização para reinicialização...",
      ...buildManifestStatusDetails(result.manifest)
    });

    const stagingRoot = await applyUpdate(zipPath);
    await fs.promises.rm(zipPath, { force: true }).catch(() => undefined);

    const relaunchArgs = buildRelaunchArgs(stagingRoot);
    app.relaunch({ args: relaunchArgs });
    app.exit(0);
    return "relaunching";
  } catch (error) {
    if (abortController.signal.aborted) {
      console.warn("[updater] Fluxo de update abortado por timeout.");
      emitOpenMain(splashWindow);
      return "open-main";
    }

    const message = error instanceof Error ? error.message : "Falha inesperada no updater.";
    const logPath = appendUpdaterErrorLog(error);
    console.error("[updater] Fluxo interrompido:", error);
    emitStatus(splashWindow, {
      phase: isConnectionError(error) ? "no-connection" : "error",
      message: isConnectionError(error)
        ? "Sem conexão para verificar atualizações."
        : "Falha ao baixar ou aplicar atualização.",
      error: message,
      errorLogPath: logPath,
      requiresAction: true
    });

    await waitForContinueRequest();

    emitOpenMain(splashWindow);
    return "open-main";
  } finally {
    clearTimeout(timeoutId);
    continueRequested = false;
    continueResolver = null;
  }
}

/**
 * Executa verificação manual de update a partir da janela principal.
 *
 * Reutiliza o mesmo backend do boot, mas sem bloquear abertura do app e sem
 * depender da splash. Quando encontra nova versão, baixa, prepara staging e
 * relança o app automaticamente ao concluir.
 */
export async function runManualUpdateFlow(targetContents: WebContents): Promise<void> {
  if (activeManualUpdateFlow) {
    return activeManualUpdateFlow;
  }

  activeManualUpdateFlow = (async () => {
    try {
      emitStatus(targetContents, {
        phase: "checking",
        message: "Verificando atualizações..."
      });

      const result = await checkForUpdate();

      if (result.kind === "no-connection") {
        const logPath = appendUpdaterErrorLog(new Error(result.error));
        emitStatus(targetContents, {
          phase: "no-connection",
          message: "Sem conexão para verificar atualizações.",
          error: result.error,
          errorLogPath: logPath
        });
        return;
      }

      if (result.kind === "error") {
        const logPath = appendUpdaterErrorLog(new Error(result.error));
        emitStatus(targetContents, {
          phase: "error",
          message: "Falha ao verificar atualizações.",
          error: result.error,
          errorLogPath: logPath
        });
        return;
      }

      if (result.kind === "up-to-date") {
        emitStatus(targetContents, {
          phase: "up-to-date",
          message: "GameStock já está atualizado.",
          ...buildManifestStatusDetails(result.manifest)
        });
        return;
      }

      emitStatus(targetContents, {
        phase: "downloading",
        message: `Baixando atualização ${formatRemoteUpdateLabel(result.manifest)}...`,
        percent: 0,
        ...buildManifestStatusDetails(result.manifest)
      });

      const zipPath = await downloadUpdate(result.manifest.downloadUrl, (progress) => {
        emitStatus(targetContents, {
          phase: "downloading",
          message: `Baixando atualização ${formatRemoteUpdateLabel(result.manifest)}...`,
          percent: progress.percent,
          ...buildManifestStatusDetails(result.manifest)
        });
      });

      emitStatus(targetContents, {
        phase: "applying",
        message: "Preparando atualização para reinicialização...",
        ...buildManifestStatusDetails(result.manifest)
      });

      const stagingRoot = await applyUpdate(zipPath);
      await fs.promises.rm(zipPath, { force: true }).catch(() => undefined);

      app.relaunch({ args: buildRelaunchArgs(stagingRoot) });
      app.exit(0);
    } catch (error) {
      const logPath = appendUpdaterErrorLog(error);
      const message = error instanceof Error ? error.message : "Falha inesperada no updater.";
      emitStatus(targetContents, {
        phase: isConnectionError(error) ? "no-connection" : "error",
        message: isConnectionError(error)
          ? "Sem conexão para verificar atualizações."
          : "Falha ao baixar ou aplicar atualização.",
        error: message,
        errorLogPath: logPath
      });
    } finally {
      activeManualUpdateFlow = null;
    }
  })();

  return activeManualUpdateFlow;
}

/**
 * Envia um payload de status para qualquer renderer inscrito no fluxo do updater.
 *
 * Aceita `BrowserWindow` (caso da splash) ou `WebContents` direto
 * (caso da janela principal em verificação manual).
 */
function emitStatus(target: BrowserWindow | WebContents, status: UpdaterStatus): void {
  const webContents = target instanceof BrowserWindow ? target.webContents : target;
  if (webContents.isDestroyed()) return;
  webContents.send(IPC_CHANNELS.updater.status, status);
}

/**
 * Converte metadados do manifesto remoto para o payload de status do updater.
 *
 * Mantém splash e modal manual com a mesma fonte de versão, build e notas.
 */
function buildManifestStatusDetails(manifest: UpdateManifest): Pick<UpdaterStatus, "version" | "buildNumber" | "releaseDate" | "releaseNotes"> {
  return {
    version: manifest.version,
    buildNumber: manifest.buildNumber,
    releaseDate: manifest.releaseDate,
    releaseNotes: manifest.releaseNotes
  };
}

/**
 * Formata versão e build remotos para deixar claro qual pacote será baixado.
 */
function formatRemoteUpdateLabel(manifest: UpdateManifest): string {
  return `v${manifest.version} build ${normalizeBuildNumber(manifest.buildNumber)}`;
}

/**
 * Emite sinalização opcional de abertura da janela principal para a splash.
 */
function emitOpenMain(splashWindow: BrowserWindow): void {
  if (splashWindow.isDestroyed()) return;
  splashWindow.webContents.send(IPC_CHANNELS.updater.openMain);
}

/**
 * Aguarda o usuário optar por continuar offline na splash.
 */
function waitForContinueRequest(): Promise<void> {
  if (continueRequested) return Promise.resolve();

  return new Promise((resolve) => {
    continueResolver = () => {
      continueRequested = true;
      resolve();
    };
  });
}

/**
 * Faz GET de um recurso textual com suporte simples a redirect e timeout.
 */
function requestText(url: string, timeoutMs: number, redirectCount = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(url);
    const requestModule = requestUrl.protocol === "https:" ? https : http;
    const request = requestModule.get(requestUrl, (response) => {
      const statusCode = response.statusCode ?? 0;
      const location = response.headers.location;

      // Seguimos redirects comuns para permitir CDNs ou URLs assinadas.
      if (statusCode >= 300 && statusCode < 400 && location) {
        response.resume();
        if (redirectCount >= 3) {
          reject(createUpdaterError("Redirecionamentos em excesso ao consultar update."));
          return;
        }
        void requestText(new URL(location, requestUrl).toString(), timeoutMs, redirectCount + 1).then(resolve, reject);
        return;
      }

      if (statusCode !== 200) {
        response.resume();
        reject(createUpdaterError(`Servidor de update respondeu HTTP ${statusCode}.`, { statusCode }));
        return;
      }

      const chunks: Buffer[] = [];
      response.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on("end", () => {
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
      response.on("error", reject);
    });

    request.on("error", reject);
    request.setTimeout(timeoutMs, () => {
      request.destroy(createUpdaterError("Tempo limite excedido ao consultar update.", { code: "ETIMEDOUT" }));
    });
  });
}

/**
 * Faz download do arquivo remoto para disco e valida `Content-Length` quando houver.
 */
async function downloadFile(
  url: string,
  filePath: string,
  onProgress: DownloadProgressCallback,
  signal?: AbortSignal,
  redirectCount = 0
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const requestUrl = new URL(url);
    const requestModule = requestUrl.protocol === "https:" ? https : http;
    const fileStream = fs.createWriteStream(filePath);
    const request = requestModule.get(requestUrl, (response) => {
      const statusCode = response.statusCode ?? 0;
      const location = response.headers.location;

      if (statusCode >= 300 && statusCode < 400 && location) {
        response.resume();
        fileStream.close();
        if (redirectCount >= 3) {
          reject(createUpdaterError("Redirecionamentos em excesso durante download do update."));
          return;
        }
        void downloadFile(new URL(location, requestUrl).toString(), filePath, onProgress, signal, redirectCount + 1).then(resolve, reject);
        return;
      }

      if (statusCode !== 200) {
        response.resume();
        fileStream.close();
        reject(createUpdaterError(`Servidor de update respondeu HTTP ${statusCode} no download.`, { statusCode }));
        return;
      }

      const totalBytesHeader = response.headers["content-length"];
      const totalBytes = totalBytesHeader ? Number(totalBytesHeader) : null;
      let receivedBytes = 0;

      response.on("data", (chunk: Buffer) => {
        receivedBytes += chunk.length;
        onProgress({
          receivedBytes,
          totalBytes,
          percent: totalBytes && totalBytes > 0
            ? Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
            : 0
        });
      });

      void pipeline(response, fileStream)
        .then(() => {
          if (totalBytes !== null && Number.isFinite(totalBytes) && totalBytes > 0 && receivedBytes !== totalBytes) {
            reject(createUpdaterError("Download incompleto: tamanho final difere do Content-Length."));
            return;
          }

          onProgress({
            receivedBytes,
            totalBytes,
            percent: 100
          });
          resolve();
        })
        .catch(reject);
    });

    const abortHandler = () => {
      request.destroy(createUpdaterError("Download de update cancelado.", { code: "ABORT_ERR" }));
    };

    if (signal) {
      if (signal.aborted) {
        abortHandler();
      } else {
        signal.addEventListener("abort", abortHandler, { once: true });
      }
    }

    request.on("error", (error) => {
      fileStream.destroy();
      reject(error);
    });
  });
}

/**
 * Valida formato do manifesto remoto e normaliza os campos usados pelo app.
 */
function parseManifest(rawValue: unknown): UpdateManifest {
  if (!rawValue || typeof rawValue !== "object") {
    throw new Error("Manifesto de update inválido: JSON fora do formato esperado.");
  }

  const manifest = rawValue as Partial<UpdateManifest> & LegacyPtBrManifest;
  const version = pickFirstString(manifest.version, manifest.versao);
  const releaseDate = pickFirstString(manifest.releaseDate, manifest.data);
  const downloadUrl = pickFirstString(manifest.downloadUrl, manifest.path);
  const releaseNotes = pickFirstString(manifest.releaseNotes, "Release publicada sem notas.");
  const buildNumber = manifest.buildNumber ?? manifest.build;

  if (
    typeof version !== "string"
    || typeof releaseDate !== "string"
    || typeof downloadUrl !== "string"
    || typeof releaseNotes !== "string"
    || (typeof buildNumber !== "number" && typeof buildNumber !== "string")
  ) {
    throw new Error("Manifesto de update inválido: campos obrigatórios ausentes.");
  }

  return {
    version: version.trim(),
    buildNumber,
    releaseDate: releaseDate.trim(),
    downloadUrl: downloadUrl.trim(),
    releaseNotes: releaseNotes.trim()
  };
}

/**
 * Retorna primeira string não-vazia entre múltiplos aliases de campo.
 *
 * Isso mantém compatibilidade com manifesto legado em pt-br sem duplicar fluxo.
 */
function pickFirstString(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === "string" && value.trim());
}

/**
 * Normaliza string semântica em vetor numérico para comparação consistente.
 */
function normalizeSemver(version: string): number[] {
  return version
    .trim()
    .split(".")
    .map((segment) => segment.split("-")[0] ?? "0")
    .map((segment) => Number.parseInt(segment, 10))
    .map((value) => (Number.isFinite(value) ? value : 0));
}

/**
 * Retorna `true` quando o erro representa ausência de conectividade.
 */
function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const maybeUpdaterError = error as UpdaterError;
  return NETWORK_ERROR_CODES.has(maybeUpdaterError.code ?? "");
}

/**
 * Cria erro enriquecido com código/status para tomada de decisão no fluxo.
 */
function createUpdaterError(message: string, details?: Partial<UpdaterError>): UpdaterError {
  const error = new Error(message) as UpdaterError;
  if (details) Object.assign(error, details);
  return error;
}

/**
 * Monta a lista de argumentos do relaunch, removendo flags antigas do updater.
 */
function buildRelaunchArgs(stagingRoot: string): string[] {
  const nextArgs: string[] = [];

  for (let index = 1; index < process.argv.length; index += 1) {
    const value = process.argv[index];
    if (value === "--apply-update") {
      index += 1;
      continue;
    }
    nextArgs.push(value);
  }

  nextArgs.push("--apply-update", stagingRoot);
  return nextArgs;
}

/**
 * Lê o diretório de staging a partir da flag `--apply-update`.
 */
function readApplyUpdateFlag(argv: string[]): string | null {
  const flagIndex = argv.findIndex((value) => value === "--apply-update");
  if (flagIndex === -1) return null;
  const stagingRoot = argv[flagIndex + 1];
  return stagingRoot ? path.resolve(stagingRoot) : null;
}

/**
 * Cria um diretorio absoluto e unico para staging do update.
 *
 * O sufixo evita corrida entre tentativas simultaneas, onde um fluxo antigo
 * poderia apagar o `app.asar` enquanto outro ainda extrai o ZIP.
 */
function createUpdateStagingRoot(): string {
  const uniqueSuffix = `${process.pid}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return path.join(path.dirname(process.resourcesPath), `_update_staging_${uniqueSuffix}`);
}

/**
 * Remove staging de forma tolerante a erro no fluxo assíncrono.
 */
async function cleanupStagingDir(stagingRoot: string): Promise<void> {
  await fs.promises.rm(stagingRoot, { recursive: true, force: true }).catch(() => undefined);
}

/**
 * Remove staging de forma tolerante a erro no boot síncrono.
 */
function cleanupStagingDirSync(stagingRoot: string): void {
  try {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  } catch {
    // Ignora falha de limpeza porque a próxima inicialização pode tentar de novo.
  }
}

/**
 * Sleep curto usado para dar tempo da splash refletir estados transitórios.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Registra falha ocorrida na etapa de aplicação do staging do update.
 *
 * O erro acontece cedo no boot, antes da splash existir. Por isso persistimos
 * log em disco e guardamos um payload em memória para a próxima tela inicial.
 */
function registerPendingStartupUpdaterFailure(message: string, error: unknown): void {
  const details = error instanceof Error ? error.message : String(error);
  pendingStartupUpdaterFailure = {
    phase: "error",
    message,
    error: details,
    errorLogPath: appendUpdaterErrorLog(error),
    requiresAction: true
  };
}

/**
 * Adiciona `timestamp` na URL do ZIP para evitar cache intermediário no CDN.
 *
 * O manifesto continua estável com `latest.zip`, mas cada download real recebe
 * uma query string única para forçar busca do arquivo mais recente.
 */
function appendTimestampQuery(url: string): string {
  const nextUrl = new URL(url);
  nextUrl.searchParams.set("timestamp", String(Date.now()));
  return nextUrl.toString();
}

/** Dados locais do app exibidos na splash via IPC. */
export const updaterAppInfo = {
  version: app.getVersion(),
  buildNumber: BUILD_NUMBER
};

/**
 * Decide se a release remota deve ser aplicada sobre a instalação local.
 *
 * Regras:
 * - versão remota maior -> atualiza
 * - versão igual + build diferente -> atualiza
 * - versão menor -> não atualiza
 */
function shouldApplyRemoteUpdate(
  manifest: UpdateManifest,
  localVersion: string,
  localBuildNumber: string
): boolean {
  const versionComparison = compareSemver(manifest.version, localVersion);
  if (versionComparison > 0) return true;
  if (versionComparison < 0) return false;

  // Quando a versão é igual, qualquer build diferente indica artefato novo.
  return normalizeBuildNumber(manifest.buildNumber) !== normalizeBuildNumber(localBuildNumber);
}

/**
 * Extrai o ZIP de update em worker thread para evitar bloquear a splash.
 */
async function extractUpdateArchive(zipPath: string, stagingRoot: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const worker = new Worker(path.join(__dirname, "updateExtractWorker.js"), {
      workerData: { zipPath, stagingRoot }
    });

    worker.once("message", (message: { ok: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      if (message.ok) {
        resolve();
        return;
      }

      reject(new Error(message.error ?? "Falha ao extrair ZIP de update."));
    });

    worker.once("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    worker.once("exit", (code) => {
      if (settled) return;
      settled = true;
      if (code !== 0) {
        reject(new Error(`Worker de extração encerrou com código ${code}.`));
        return;
      }

      resolve();
    });
  });
}

/**
 * Verifica se o staging extraído contém um formato de payload suportado.
 */
function hasSupportedStagingPayload(stagingRoot: string): boolean {
  return fs.existsSync(path.join(stagingRoot, "app"))
    || hasReadableFile(path.join(stagingRoot, "resources", "app.asar"));
}

/**
 * Confirma que o arquivo principal do pacote existe e nao esta vazio.
 */
function hasReadableFile(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

/**
 * Normaliza identificador de build para comparação estável entre número e string.
 */
function normalizeBuildNumber(buildNumber: string | number): string {
  return String(buildNumber).trim();
}

/**
 * Persiste erro do updater em arquivo local para diagnóstico pós-falha.
 */
function appendUpdaterErrorLog(error: unknown): string {
  try {
    const logsDir = path.join(getAppUserDataDir(), "logs");
    const logPath = path.join(logsDir, "updater-error.log");
    const details = error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack ?? "stack indisponivel"}`
      : String(error);
    const entry = `[${new Date().toISOString()}]\n${details}\n\n`;

    fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(logPath, entry, "utf8");
    return logPath;
  } catch {
    return "";
  }
}
