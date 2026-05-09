import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export const USER_DATA_DIR_NAME = "gamestock";

export function getAppUserDataDir(): string {
  if (process.env.GAMESTOCK_USER_DATA_DIR) return process.env.GAMESTOCK_USER_DATA_DIR;
  const appDataDir = app.getPath("appData");
  normalizeUserDataDirCasing(appDataDir);
  return path.join(appDataDir, USER_DATA_DIR_NAME);
}

function normalizeUserDataDirCasing(appDataDir: string): void {
  let currentName: string | undefined;
  try {
    currentName = fs.readdirSync(appDataDir).find((entry) => entry.toLowerCase() === USER_DATA_DIR_NAME);
  } catch {
    return;
  }

  if (!currentName || currentName === USER_DATA_DIR_NAME) return;

  const source = path.join(appDataDir, currentName);
  const temp = path.join(appDataDir, `${USER_DATA_DIR_NAME}-case-rename-${Date.now()}`);
  const target = path.join(appDataDir, USER_DATA_DIR_NAME);

  try {
    fs.renameSync(source, temp);
    fs.renameSync(temp, target);
  } catch {
    try {
      if (fs.existsSync(temp)) fs.renameSync(temp, source);
    } catch {
      // Best effort only. Lowercase path still resolves on case-insensitive file systems.
    }
  }
}
