/**
 * Gerenciamento do cache local de metadados e índice do LaunchBox.
 *
 * Responsável por:
 * - Baixar e manter atualizado o Metadata.zip do LaunchBox
 * - Extrair o Metadata.xml via worker thread (extract-worker)
 * - Construir e persistir o índice JSON (index.json) via worker thread (index-worker)
 * - Expor o índice em memória para consultas rápidas sem re-leitura de disco
 */

import fs from "node:fs";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Worker } from "node:worker_threads";
import type { LaunchBoxGame, LaunchBoxProgress } from "../../../shared/types";
import { CACHE_AGE_H, getIndexFile, getLaunchBoxCacheDir, getMetadataFile, METADATA_URL } from "./config";

type ProgressCallback = (progress: LaunchBoxProgress) => void;

/** Cache em memória do índice; evita releitura do JSON a cada consulta. */
let memoryIndex: Record<string, LaunchBoxGame> | null = null;

/** Operações compartilhadas impedem downloads e workers concorrentes sobre o mesmo cache. */
let pendingMetadata: Promise<{ status: "cached" | "downloaded" }> | null = null;
let pendingIndex: Promise<Record<string, LaunchBoxGame>> | null = null;

/** Cada consumidor recebe progresso mesmo quando compartilha uma operação já iniciada. */
const progressListeners = new Set<ProgressCallback>();

/** Isola falhas de observadores para não interromper download ou deixar promises pendentes. */
function notifyProgress(progress: LaunchBoxProgress): void {
  for (const listener of progressListeners) {
    try {
      listener(progress);
    } catch (error) {
      console.error("Falha ao notificar progresso do LaunchBox", error);
    }
  }
}

/**
 * Garante que o Metadata.xml esteja presente e atualizado no cache local.
 *
 * Se o arquivo existir e tiver sido modificado há menos de `CACHE_AGE_H` horas,
 * retorna `"cached"` sem fazer download. Caso contrário, baixa o Metadata.zip,
 * extrai o XML via worker e invalida o índice em memória.
 *
 * @param force - Força o download mesmo que o cache seja recente.
 * @param onProgress - Callback opcional de progresso para exibir ao usuário.
 */
export async function ensureMetadata(force = false, onProgress?: ProgressCallback): Promise<{ status: "cached" | "downloaded" }> {
  // Wrapper próprio permite que chamadas usando o mesmo callback tenham ciclos independentes.
  const listener: ProgressCallback = (progress) => onProgress?.(progress);
  if (onProgress) progressListeners.add(listener);
  try {
    if (!pendingMetadata) {
      if (!force && !needsUpdate(getMetadataFile())) return { status: "cached" };
      // Captura somente o worker já ativo; novos leitores aguardam este download.
      const activeIndex = pendingIndex;
      pendingMetadata = (async () => {
        try {
          await activeIndex;
        } catch (error) {
          // Metadados novos podem reparar o XML que fez a indexação anterior falhar.
          console.warn("Índice anterior falhou antes da atualização de metadados", error);
        }
        return downloadMetadata();
      })().finally(() => { pendingMetadata = null; });
    }
    return await pendingMetadata;
  } finally {
    progressListeners.delete(listener);
  }
}

/** Baixa e extrai metadados depois que leitores anteriores liberam os arquivos do cache. */
async function downloadMetadata(): Promise<{ status: "downloaded" }> {
  const cacheDir = getLaunchBoxCacheDir();
  const metadataFile = getMetadataFile();
  fs.mkdirSync(cacheDir, { recursive: true });

  const response = await fetch(METADATA_URL);
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status} ao baixar Metadata.zip`);

  const total = Number(response.headers.get("content-length") ?? 0);
  const zipPath = path.join(cacheDir, "Metadata.zip");
  const dest = createWriteStream(zipPath);
  let downloaded = 0;
  const body = Readable.fromWeb(response.body as never);

  // Reporta progresso de download chunk a chunk
  body.on("data", (chunk: Buffer) => {
    downloaded += chunk.length;
    notifyProgress({ current: downloaded, total, filename: "Metadata.zip", status: "downloading" });
  });

  await pipeline(body, dest);

  // Extrai o XML do ZIP via worker thread
  await runExtractWorker(zipPath, cacheDir, metadataFile, notifyProgress);

  // Remove o ZIP temporário após extração bem-sucedida
  fs.rmSync(zipPath, { force: true });
  // Invalida o índice em disco e em memória para forçar reconstrução
  fs.rmSync(getIndexFile(), { force: true });
  memoryIndex = null;
  return { status: "downloaded" };
}

/**
 * Retorna o índice de jogos LaunchBox, construindo-o se necessário.
 *
 * Prioridade de fonte:
 * 1. Cache em memória (mais rápido)
 * 2. index.json em disco (se mais recente que o Metadata.xml)
 * 3. Reconstrução via index-worker a partir do Metadata.xml
 *
 * @param onProgress - Callback opcional de progresso repassado ao worker.
 */
export async function buildIndex(onProgress?: ProgressCallback): Promise<Record<string, LaunchBoxGame>> {
  // Serializa leitura com download e compartilha a desserialização entre consumidores.
  const listener: ProgressCallback = (progress) => onProgress?.(progress);
  if (onProgress) progressListeners.add(listener);
  try {
    if (pendingMetadata) await pendingMetadata;
    if (memoryIndex) return memoryIndex;
    if (!fs.existsSync(getMetadataFile())) await ensureMetadata(false);

    if (!pendingIndex) {
      pendingIndex = runIndexWorker(getMetadataFile(), getIndexFile(), notifyProgress)
        .then((index) => {
          memoryIndex = index;
          return index;
        })
        .finally(() => { pendingIndex = null; });
    }
    return await pendingIndex;
  } finally {
    progressListeners.delete(listener);
  }
}

/** Verifica se o Metadata.xml já existe em cache. */
export function metadataExists(): boolean {
  return fs.existsSync(getMetadataFile());
}

/**
 * Retorna a data/hora (ISO 8601) da última atualização do Metadata.xml,
 * ou `null` se o arquivo ainda não foi baixado.
 */
export function getMetadataDownloadedAt(): string | null {
  const metadataFile = getMetadataFile();
  if (!fs.existsSync(metadataFile)) return null;
  return new Date(fs.statSync(metadataFile).mtimeMs).toISOString();
}

/**
 * Verifica se o arquivo de cache precisa ser atualizado.
 * Retorna `true` se não existir ou se a idade ultrapassar `CACHE_AGE_H` horas.
 */
function needsUpdate(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return true;
  const ageMs = Date.now() - fs.statSync(filePath).mtimeMs;
  return ageMs > CACHE_AGE_H * 3_600_000;
}

/**
 * Inicia o extract-worker para descompactar o Metadata.zip em thread separada.
 * Resolve quando a extração concluir ou rejeita em caso de erro.
 * Resolve também no `exit` limpo (código 0) para o fluxo nunca pendurar se o
 * worker terminar sem postar mensagem; sempre encerra o thread ao terminar.
 */
function runExtractWorker(zipPath: string, cacheDir: string, metadataFile: string, onProgress?: ProgressCallback): Promise<void> {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, "extract-worker.js");
    const worker = new Worker(workerPath, { workerData: { zipPath, cacheDir, metadataFile } });
    let settled = false;
    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      void worker.terminate();
      callback();
    };
    worker.on("message", (result: { ok?: boolean; error?: string; status?: string }) => {
      if (result.status) {
        // Mensagem de progresso intermediária
        onProgress?.(result as Parameters<ProgressCallback>[0]);
      } else if (result.error) {
        finish(() => reject(new Error(result.error)));
      } else {
        finish(() => resolve());
      }
    });
    worker.on("error", (error) => finish(() => reject(error)));
    worker.on("exit", (code) => {
      if (code !== 0) finish(() => reject(new Error(`Extract worker saiu com codigo ${code}`)));
      else finish(() => resolve());
    });
  });
}

/**
 * Inicia o index-worker para construir o índice JSON a partir do XML em thread separada.
 * Resolve com o índice pronto ou rejeita em caso de erro de parsing.
 * Saída sem resultado rejeita explicitamente, sem leitura síncrona ou exceção fora da promise.
 */
function runIndexWorker(metadataFile: string, indexFile: string, onProgress?: ProgressCallback): Promise<Record<string, LaunchBoxGame>> {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, "index-worker.js");
    const worker = new Worker(workerPath, { workerData: { metadataFile, indexFile } });
    let settled = false;
    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      void worker.terminate();
      callback();
    };
    worker.on("message", (result: Record<string, LaunchBoxGame> | { error: string; status?: never } | { status: string }) => {
      if ("status" in result && result.status) {
        // Mensagem de progresso intermediária do worker
        onProgress?.(result as Parameters<ProgressCallback>[0]);
      } else if ("error" in result) {
        finish(() => reject(new Error((result as { error: string }).error)));
      } else {
        finish(() => resolve(result as Record<string, LaunchBoxGame>));
      }
    });
    worker.on("error", (error) => finish(() => reject(error)));
    worker.on("exit", (code) => {
      if (code !== 0) finish(() => reject(new Error(`Index worker saiu com codigo ${code}`)));
      else finish(() => reject(new Error("Index worker terminou sem retornar o índice")));
    });
  });
}
