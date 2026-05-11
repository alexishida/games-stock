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
  const cacheDir = getLaunchBoxCacheDir();
  const metadataFile = getMetadataFile();
  fs.mkdirSync(cacheDir, { recursive: true });

  // Cache ainda válido e download não foi forçado
  if (!force && !needsUpdate(metadataFile)) return { status: "cached" };

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
    onProgress?.({ current: downloaded, total, filename: "Metadata.zip", status: "downloading" });
  });

  await pipeline(body, dest);

  // Extrai o XML do ZIP via worker thread
  await runExtractWorker(zipPath, cacheDir, metadataFile, onProgress);

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
  // Retorna cache em memória se disponível
  if (memoryIndex) return memoryIndex;

  const indexFile = getIndexFile();
  const metadataFile = getMetadataFile();

  // Garante que o Metadata.xml existe antes de tentar indexar
  if (!fs.existsSync(metadataFile)) await ensureMetadata(false, onProgress);

  if (fs.existsSync(indexFile)) {
    const xmlMtime = fs.statSync(metadataFile).mtimeMs;
    const idxMtime = fs.statSync(indexFile).mtimeMs;
    // Usa o índice em disco apenas se for mais recente que o XML fonte
    if (idxMtime >= xmlMtime) {
      memoryIndex = JSON.parse(fs.readFileSync(indexFile, "utf8")) as Record<string, LaunchBoxGame>;
      return memoryIndex;
    }
  }

  // Reconstrói o índice via worker thread
  memoryIndex = await runIndexWorker(metadataFile, indexFile, onProgress);
  return memoryIndex;
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
 */
function runExtractWorker(zipPath: string, cacheDir: string, metadataFile: string, onProgress?: ProgressCallback): Promise<void> {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, "extract-worker.js");
    const worker = new Worker(workerPath, { workerData: { zipPath, cacheDir, metadataFile } });
    worker.on("message", (result: { ok?: boolean; error?: string; status?: string }) => {
      if (result.status) {
        // Mensagem de progresso intermediária
        onProgress?.(result as Parameters<ProgressCallback>[0]);
      } else if (result.error) {
        reject(new Error(result.error));
      } else {
        resolve();
      }
    });
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Extract worker saiu com codigo ${code}`));
    });
  });
}

/**
 * Inicia o index-worker para construir o índice JSON a partir do XML em thread separada.
 * Resolve com o índice pronto ou rejeita em caso de erro de parsing.
 */
function runIndexWorker(metadataFile: string, indexFile: string, onProgress?: ProgressCallback): Promise<Record<string, LaunchBoxGame>> {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, "index-worker.js");
    const worker = new Worker(workerPath, { workerData: { metadataFile, indexFile } });
    worker.on("message", (result: Record<string, LaunchBoxGame> | { error: string; status?: never } | { status: string }) => {
      if ("status" in result && result.status) {
        // Mensagem de progresso intermediária do worker
        onProgress?.(result as Parameters<ProgressCallback>[0]);
      } else if ("error" in result) {
        reject(new Error((result as { error: string }).error));
      } else {
        resolve(result as Record<string, LaunchBoxGame>);
      }
    });
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Index worker saiu com codigo ${code}`));
    });
  });
}
