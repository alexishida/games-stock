/**
 * Bootstrap minimo do processo principal.
 *
 * Este modulo existe para aplicar update em staging antes de carregar modulos
 * nativos do app principal, como `better-sqlite3` e `sharp`, que extraem DLLs
 * para `app.asar.unpacked` e podem bloquear a substituicao no Windows.
 */

import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { getAppUserDataDir } from "./appPaths";
import { applyStagedUpdateFromLaunchArgs } from "./updater";

/**
 * Configura os diretorios de dados, sessao e cache do Electron antes de
 * carregar o restante do main process.
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

/**
 * Remove flags antigas do updater antes do relaunch final.
 */
function buildPostApplyRelaunchArgs(): string[] {
  const cleanArgs: string[] = [];

  for (let index = 1; index < process.argv.length; index += 1) {
    if (process.argv[index] === "--apply-update") {
      index += 1;
      continue;
    }

    cleanArgs.push(process.argv[index]);
  }

  return cleanArgs;
}

configureElectronStoragePaths();

// Aplica staging pendente antes de carregar `index.ts`, que importa modulos
// nativos e pode travar arquivos dentro de `app.asar.unpacked`.
if (applyStagedUpdateFromLaunchArgs()) {
  app.relaunch({ args: buildPostApplyRelaunchArgs() });
  app.exit(0);
} else {
  require("./index");
}
