/**
 * Worker dedicado ao scan de pastas de ROM.
 *
 * Mantém `readdirSync` recursivo fora do processo principal para que bibliotecas
 * grandes não congelem janela, menus ou progresso de outros jobs.
 */

import { parentPort, workerData } from "node:worker_threads";
import { scanRomFolder } from "./romFolderImport";
import type { RomFolderScanRequest } from "../shared/types";

/** Dados recebidos do main para executar scan no mesmo diretório de dados. */
interface RomFolderScanWorkerData {
  request: RomFolderScanRequest;
  userDataDir: string;
}

/** Executa scan e devolve payload serializável ao processo principal. */
function main(): void {
  const { request, userDataDir } = workerData as RomFolderScanWorkerData;
  process.env.GAMESTOCK_USER_DATA_DIR = userDataDir;

  try {
    parentPort?.postMessage({ ok: true, result: scanRomFolder(request) });
  } catch (error) {
    parentPort?.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao escanear pastas de ROM."
    });
  }
}

main();
