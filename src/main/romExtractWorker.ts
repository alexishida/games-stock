/**
 * Worker thread dedicado à extração de ROM compactada (.zip) para launch.
 *
 * A extração via `adm-zip` é síncrona e pesada; rodar em worker evita travar
 * o event loop do processo principal enquanto ROMs grandes (ex.: jogos de
 * CD com centenas de MB) são descompactadas para a pasta temporária.
 */

import AdmZip from "adm-zip";
import fs from "node:fs";
import path from "node:path";
import { parentPort, workerData } from "node:worker_threads";

/** Payload recebido do processo principal para executar a extração. */
type RomExtractWorkerData = {
  /** Caminho absoluto do arquivo .zip da ROM. */
  zipPath: string;
  /** Diretório temporário de destino da extração. */
  targetDir: string;
};

/** Limites defensivos contra ZIP bombs em ROMs selecionadas pelo usuário. */
const MAX_ARCHIVE_ENTRIES = 10_000;
const MAX_ENTRY_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024 * 1024;

/** Executa a extração e responde ao processo principal com sucesso/erro. */
function main(): void {
  const { zipPath, targetDir } = workerData as RomExtractWorkerData;

  try {
    // Remove resíduo de extração anterior incompleta antes de extrair de novo
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });

    extractArchiveToDirectory(zipPath, targetDir);
    parentPort?.postMessage({ ok: true });
  } catch (error) {
    parentPort?.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao extrair ROM compactada."
    });
  }
}

/**
 * Extrai todas as entradas do ZIP preservando a estrutura interna de pastas.
 * Estrutura preservada é importante para jogos de disco (.cue referencia .bin
 * por caminho relativo). Não usa `extractAllTo` para manter a proteção
 * explícita contra zip-slip.
 */
function extractArchiveToDirectory(zipPath: string, targetDir: string): void {
  const archive = new AdmZip(zipPath);
  const resolvedTargetDir = path.resolve(targetDir);
  const entries = archive.getEntries();
  if (entries.length > MAX_ARCHIVE_ENTRIES) throw new Error("ZIP contém entradas demais para extração segura.");
  let totalBytes = 0;

  for (const entry of entries) {
    const entryTarget = resolveEntryTarget(resolvedTargetDir, entry.entryName);

    if (entry.isDirectory) {
      fs.mkdirSync(entryTarget, { recursive: true });
      continue;
    }

    const declaredSize = Number(entry.header.size);
    if (!Number.isSafeInteger(declaredSize) || declaredSize < 0 || declaredSize > MAX_ENTRY_BYTES) {
      throw new Error(`Entrada ZIP excede limite seguro: ${entry.entryName}`);
    }
    totalBytes += declaredSize;
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error("ZIP excede limite total de extração segura.");

    fs.mkdirSync(path.dirname(entryTarget), { recursive: true });
    fs.writeFileSync(entryTarget, entry.getData());
  }
}

/** Resolve caminho da entrada do ZIP e bloqueia zip-slip fora do diretório alvo. */
function resolveEntryTarget(targetDir: string, entryName: string): string {
  const normalizedEntryName = entryName.replace(/\\/g, "/");
  const entryTarget = path.resolve(targetDir, normalizedEntryName);

  if (!isPathInsideDirectory(entryTarget, targetDir)) {
    throw new Error(`Entrada do ZIP fora do diretório de extração: ${entryName}`);
  }

  return entryTarget;
}

/** Compara caminhos respeitando sistemas de arquivos case-insensitive (Windows). */
function isPathInsideDirectory(targetPath: string, directoryPath: string): boolean {
  const normalizedTarget = process.platform === "win32" ? targetPath.toLowerCase() : targetPath;
  const normalizedDirectory = process.platform === "win32" ? directoryPath.toLowerCase() : directoryPath;
  return normalizedTarget === normalizedDirectory || normalizedTarget.startsWith(`${normalizedDirectory}${path.sep}`);
}

main();
