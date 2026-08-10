/**
 * Bootstrap minimo do processo principal.
 *
 * Configura caminhos e workarounds do Electron antes de carregar `index.ts`.
 * Atualizacao NSIS e executada pelo electron-updater fora deste processo.
 */

import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { getAppUserDataDir } from "./appPaths";

/**
 * Aplica workarounds de GPU antes do `app.whenReady()`.
 */
function configureGraphicsWorkarounds(): void {
  if (process.platform !== "linux" || process.env.GAMESTOCK_DISABLE_GPU !== "1") return;

  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch("disable-gpu");
}

/**
 * Configura diretorios de dados, sessao e cache antes do processo principal.
 */
function configureElectronStoragePaths(): void {
  const dataDir = getAppUserDataDir();
  const sessionDir = path.join(dataDir, "session");
  const cacheDir = path.join(sessionDir, "Cache");

  fs.mkdirSync(cacheDir, { recursive: true });
  app.setPath("userData", dataDir);
  app.setPath("sessionData", sessionDir);
  app.commandLine.appendSwitch("disk-cache-dir", cacheDir);
  app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
}

configureGraphicsWorkarounds();
configureElectronStoragePaths();

// NSIS substitui o app apos `quitAndInstall`; nao existe staging local no boot.
require("./index");
