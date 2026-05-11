/**
 * Worker thread para operações de portabilidade de dados (exportação e importação).
 *
 * Executa em thread separada para não bloquear o processo principal durante
 * operações potencialmente longas (empacotar/desempacotar backup com imagens).
 *
 * Recebe os parâmetros via `workerData`, executa a operação correspondente
 * e comunica progresso e resultado ao processo principal via `parentPort`.
 *
 * O diretório de dados do usuário é configurado via variável de ambiente antes
 * de qualquer import dos módulos que dependem do banco SQLite, garantindo que
 * o worker acesse o mesmo banco que o processo principal.
 */

import { parentPort, workerData } from "node:worker_threads";
import {
  DataPortabilityExportRequest,
  DataPortabilityImportRequest,
  DataPortabilityJobKind,
  DataPortabilityProgress
} from "../shared/types";

/** União discriminada dos dados recebidos via workerData. */
type WorkerRequest =
  | {
    jobId: string;
    kind: "export";
    userDataDir: string;
    appVersion: string;
    request: DataPortabilityExportRequest & { targetPath: string };
  }
  | {
    jobId: string;
    kind: "import";
    userDataDir: string;
    request: DataPortabilityImportRequest;
  };

const input = workerData as WorkerRequest;

// Configura o caminho de dados antes de importar módulos que abrem o SQLite,
// garantindo que o worker use o mesmo banco de dados do processo principal.
process.env.GAMESTOCK_USER_DATA_DIR = input.userDataDir;

// Importação via require para carregar após a configuração da variável de ambiente
const { exportDataPackage, importDataPackage } = require("./dataPortability") as typeof import("./dataPortability");
const { closeDatabase } = require("./db/database") as typeof import("./db/database");

/**
 * Envia uma mensagem de progresso ao processo principal, enriquecida com
 * o `jobId` e o `kind` do job corrente.
 */
function postProgress(progress: Omit<DataPortabilityProgress, "jobId" | "kind">): void {
  parentPort?.postMessage({
    type: "progress",
    progress: {
      ...progress,
      jobId: input.jobId,
      kind: input.kind as DataPortabilityJobKind
    }
  });
}

try {
  if (input.kind === "export") {
    // Executa exportação síncrona e envia resultado ao processo principal
    const result = exportDataPackage({ ...input.request, appVersion: input.appVersion }, postProgress);
    closeDatabase();
    parentPort?.postMessage({ type: "completed", result });
  } else {
    // Executa importação síncrona e envia resultado ao processo principal
    const result = importDataPackage(input.request, postProgress);
    closeDatabase();
    parentPort?.postMessage({ type: "completed", result });
  }
} catch (error) {
  // Fecha o banco antes de reportar o erro para evitar conexão aberta em estado inconsistente
  closeDatabase();
  parentPort?.postMessage({
    type: "error",
    error: error instanceof Error ? error.message : String(error)
  });
}
