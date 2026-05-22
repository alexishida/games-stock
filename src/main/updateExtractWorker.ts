/**
 * Worker thread dedicado à extração do ZIP de update.
 *
 * A extração via `adm-zip` é síncrona e pesada. Rodar isso em worker evita
 * travar o event loop do processo principal e congelar a splash em 92%.
 */

import AdmZip from "adm-zip";
import fs from "node:fs";
import path from "node:path";
import { parentPort, workerData } from "node:worker_threads";

/** Payload recebido do processo principal para executar a extração. */
type UpdateExtractWorkerData = {
  zipPath: string;
  stagingRoot: string;
};

/** Executa a extração e responde ao processo principal com sucesso/erro. */
function main(): void {
  const { zipPath, stagingRoot } = workerData as UpdateExtractWorkerData;

  try {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
    fs.mkdirSync(stagingRoot, { recursive: true });

    extractArchiveToDirectory(zipPath, stagingRoot);
    parentPort?.postMessage({ ok: true });
  } catch (error) {
    parentPort?.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao extrair ZIP de update."
    });
  }
}

/**
 * Extrai o ZIP sem usar `extractAllTo`, porque o `adm-zip` chama `chmod` apos
 * escrever cada arquivo e pode mascarar falhas no Windows quando ha corrida.
 */
function extractArchiveToDirectory(zipPath: string, stagingRoot: string): void {
  const archive = new AdmZip(zipPath);
  const resolvedStagingRoot = path.resolve(stagingRoot);

  for (const entry of archive.getEntries()) {
    const targetPath = resolveEntryTarget(resolvedStagingRoot, entry.entryName);

    if (entry.isDirectory) {
      fs.mkdirSync(targetPath, { recursive: true });
      continue;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    writeEntryFile(targetPath, entry.getData());
    preserveEntryTime(targetPath, entry.header.time);
  }
}

/**
 * Resolve caminho de entrada do ZIP e bloqueia zip-slip fora do staging.
 */
function resolveEntryTarget(stagingRoot: string, entryName: string): string {
  const normalizedEntryName = entryName.replace(/\\/g, "/");
  const targetPath = path.resolve(stagingRoot, normalizedEntryName);

  if (!isPathInsideDirectory(targetPath, stagingRoot)) {
    throw new Error(`Entrada de update fora do staging: ${entryName}`);
  }

  return targetPath;
}

/**
 * Compara caminhos respeitando Windows case-insensitive.
 */
function isPathInsideDirectory(targetPath: string, directoryPath: string): boolean {
  const normalizedTarget = process.platform === "win32" ? targetPath.toLowerCase() : targetPath;
  const normalizedDirectory = process.platform === "win32" ? directoryPath.toLowerCase() : directoryPath;
  return normalizedTarget === normalizedDirectory || normalizedTarget.startsWith(`${normalizedDirectory}${path.sep}`);
}

/**
 * Escreve arquivo com retentativa curta para tolerar antivirus/indexador.
 */
function writeEntryFile(targetPath: string, content: Buffer): void {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      fs.writeFileSync(targetPath, content);
      return;
    } catch (error) {
      lastError = error;
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      waitBeforeRetry(attempt);
    }
  }

  throw new Error(`Falha ao escrever arquivo extraido ${targetPath}: ${formatErrorMessage(lastError)}`);
}

/**
 * Mantem timestamp original quando possivel, sem invalidar update por metadado.
 */
function preserveEntryTime(targetPath: string, time: Date): void {
  try {
    fs.utimesSync(targetPath, time, time);
  } catch {
    // Timestamp do ZIP nao e essencial para aplicar o update.
  }
}

/**
 * Pausa sincrona pequena dentro do worker, sem bloquear processo principal.
 */
function waitBeforeRetry(attempt: number): void {
  const sharedBuffer = new SharedArrayBuffer(4);
  const sharedView = new Int32Array(sharedBuffer);
  Atomics.wait(sharedView, 0, 0, attempt * 75);
}

/**
 * Converte erro desconhecido em mensagem curta para log do updater.
 */
function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main();
