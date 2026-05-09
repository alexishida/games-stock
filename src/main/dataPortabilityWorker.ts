import { parentPort, workerData } from "node:worker_threads";
import {
  DataPortabilityExportRequest,
  DataPortabilityImportRequest,
  DataPortabilityJobKind,
  DataPortabilityProgress
} from "../shared/types";

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
process.env.GAMESTOCK_USER_DATA_DIR = input.userDataDir;

const { exportDataPackage, importDataPackage } = require("./dataPortability") as typeof import("./dataPortability");
const { closeDatabase } = require("./db/database") as typeof import("./db/database");

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
    const result = exportDataPackage({ ...input.request, appVersion: input.appVersion }, postProgress);
    closeDatabase();
    parentPort?.postMessage({ type: "completed", result });
  } else {
    const result = importDataPackage(input.request, postProgress);
    closeDatabase();
    parentPort?.postMessage({ type: "completed", result });
  }
} catch (error) {
  closeDatabase();
  parentPort?.postMessage({
    type: "error",
    error: error instanceof Error ? error.message : String(error)
  });
}
