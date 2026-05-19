/**
 * Worker thread dedicado à extração do ZIP de update.
 *
 * A extração via `adm-zip` é síncrona e pesada. Rodar isso em worker evita
 * travar o event loop do processo principal e congelar a splash em 92%.
 */

import AdmZip from "adm-zip";
import fs from "node:fs";
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

    const archive = new AdmZip(zipPath);
    archive.extractAllTo(stagingRoot, true);
    parentPort?.postMessage({ ok: true });
  } catch (error) {
    parentPort?.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao extrair ZIP de update."
    });
  }
}

main();
