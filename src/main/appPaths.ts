/**
 * Resolução de caminhos de dados do usuário no sistema operacional.
 *
 * Responsável por determinar o diretório onde o GameStock armazena dados
 * persistentes (banco SQLite, cache, imagens) de forma portável entre
 * Windows, macOS e Linux. Também corrige inconsistências de capitalização
 * do diretório de dados em sistemas de arquivos case-insensitive.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Nome do subdiretório de dados do app dentro do diretório persistente do SO. */
export const USER_DATA_DIR_NAME = "gamestock";

/**
 * Retorna o caminho absoluto do diretório de dados do usuário para o GameStock.
 *
 * Respeita a variável de ambiente `GAMESTOCK_USER_DATA_DIR` quando definida,
 * permitindo sobrescrever o caminho em ambientes de teste ou portáveis.
 */
export function getAppUserDataDir(): string {
  if (process.env.GAMESTOCK_USER_DATA_DIR) return process.env.GAMESTOCK_USER_DATA_DIR;
  const appDataDir = getBaseAppDataDir();
  // Garante capitalização consistente antes de retornar o caminho
  normalizeUserDataDirCasing(appDataDir);
  return path.join(appDataDir, USER_DATA_DIR_NAME);
}

/**
 * Retorna o diretório base de dados de aplicativos conforme a plataforma:
 * - Windows: %APPDATA% (ex.: C:\Users\User\AppData\Roaming)
 * - macOS:   ~/Library/Application Support
 * - Linux:   $XDG_DATA_HOME ou ~/.local/share
 */
function getBaseAppDataDir(): string {
  if (process.platform === "win32") {
    return process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support");
  }
  return process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
}

/**
 * Corrige a capitalização do diretório de dados caso ele exista com nome diferente
 * (ex.: "GameStock" em vez de "gamestock") em sistemas de arquivos case-insensitive.
 *
 * Usa renomeação via diretório temporário para contornar limitações do Windows,
 * onde não é possível renomear diretamente para o mesmo nome com casing diferente.
 */
function normalizeUserDataDirCasing(appDataDir: string): void {
  let currentName: string | undefined;
  try {
    // Busca entrada no diretório pai que corresponda ao nome esperado (ignorando case)
    currentName = fs.readdirSync(appDataDir).find((entry) => entry.toLowerCase() === USER_DATA_DIR_NAME);
  } catch {
    return;
  }

  // Já está com o nome correto; nada a fazer
  if (!currentName || currentName === USER_DATA_DIR_NAME) return;

  const source = path.join(appDataDir, currentName);
  // Nome temporário para contornar a limitação de renomeação case-only no Windows
  const temp = path.join(appDataDir, `${USER_DATA_DIR_NAME}-case-rename-${Date.now()}`);
  const target = path.join(appDataDir, USER_DATA_DIR_NAME);

  try {
    fs.renameSync(source, temp);
    fs.renameSync(temp, target);
  } catch {
    try {
      // Tenta reverter para o nome original em caso de falha na segunda renomeação
      if (fs.existsSync(temp)) fs.renameSync(temp, source);
    } catch {
      // Best effort only. Lowercase path still resolves on case-insensitive file systems.
    }
  }
}
