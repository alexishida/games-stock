/**
 * Resolução e validação de executáveis usados para launch de emuladores.
 *
 * Centraliza regras de portabilidade entre Windows, Linux e macOS:
 * - aceita caminho absoluto ou relativo;
 * - aceita nome de comando resolvível via `PATH`;
 * - valida permissão de execução em plataformas POSIX quando o alvo é local.
 */

import fs from "node:fs";
import path from "node:path";

/** Resultado da resolução de um executável configurado pelo usuário. */
export interface ResolvedExecutable {
  configuredValue: string;
  resolvedPath: string;
  source: "filesystem" | "path";
}

/** Erro de resolução usado para diferenciar falha de lookup de falha de permissão. */
export class ExecutableResolutionError extends Error {
  code: "NOT_FOUND" | "NOT_EXECUTABLE";
  targetPath: string;

  /**
   * Cria erro rico para exibição consistente na UI.
   *
   * @param code Código semântico do erro.
   * @param message Mensagem final orientada ao usuário.
   * @param targetPath Caminho ou comando relacionado à falha.
   */
  constructor(code: "NOT_FOUND" | "NOT_EXECUTABLE", message: string, targetPath: string) {
    super(message);
    this.code = code;
    this.targetPath = targetPath;
  }
}

/**
 * Resolve um executável configurado pelo usuário para caminho absoluto executável.
 *
 * @param configuredValue Valor salvo no cadastro do emulador.
 * @returns Caminho resolvido e origem do lookup.
 */
export function resolveConfiguredExecutable(configuredValue: string): ResolvedExecutable {
  const normalizedValue = configuredValue.trim();
  if (!normalizedValue) {
    throw new ExecutableResolutionError("NOT_FOUND", "Executável do emulador não configurado", configuredValue);
  }

  if (looksLikePath(normalizedValue)) {
    const resolvedFromFilesystem = resolveFilesystemExecutable(normalizedValue);
    if (!resolvedFromFilesystem) {
      throw new ExecutableResolutionError(
        "NOT_FOUND",
        `Executável do emulador não encontrado: ${configuredValue}`,
        configuredValue
      );
    }

    ensureLocalExecutablePermission(resolvedFromFilesystem);
    return {
      configuredValue,
      resolvedPath: resolvedFromFilesystem,
      source: "filesystem"
    };
  }

  const resolvedFromPath = resolveExecutableFromPath(normalizedValue);
  if (!resolvedFromPath) {
    throw new ExecutableResolutionError(
      "NOT_FOUND",
      `Executável do emulador não encontrado: ${configuredValue}`,
      configuredValue
    );
  }

  ensureLocalExecutablePermission(resolvedFromPath);
  return {
    configuredValue,
    resolvedPath: resolvedFromPath,
    source: "path"
  };
}

/**
 * Indica se o texto informado deve ser tratado como caminho local.
 *
 * Exemplos:
 * - `/usr/bin/retroarch`
 * - `./pcsx2/pcsx2-qt`
 * - `..\RetroArch\retroarch.exe`
 */
function looksLikePath(value: string): boolean {
  return path.isAbsolute(value)
    || value.startsWith(`.${path.sep}`)
    || value.startsWith("./")
    || value.startsWith(`..${path.sep}`)
    || value.startsWith("../")
    || value.includes("/")
    || value.includes("\\");
}

/**
 * Resolve um caminho local para absoluto, aceitando relativo ao `cwd`.
 */
function resolveFilesystemExecutable(value: string): string | null {
  const resolvedPath = path.resolve(value);
  return isExistingFile(resolvedPath) ? resolvedPath : null;
}

/**
 * Procura um comando simples dentro do `PATH` do processo atual.
 */
function resolveExecutableFromPath(commandName: string): string | null {
  const pathEntries = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const extensions = getExecutableExtensions(commandName);

  for (const baseDir of pathEntries) {
    for (const extension of extensions) {
      const candidatePath = path.join(baseDir, `${commandName}${extension}`);
      if (!isExistingFile(candidatePath)) continue;
      return candidatePath;
    }
  }

  return null;
}

/**
 * Retorna extensões candidatas compatíveis com lookup por `PATH`.
 *
 * No Windows respeita `PATHEXT`; em POSIX, comandos normalmente não usam extensão.
 */
function getExecutableExtensions(commandName: string): string[] {
  if (path.extname(commandName)) return [""];

  if (process.platform !== "win32") return [""];

  const rawExtensions = (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean);

  return ["", ...rawExtensions];
}

/**
 * Valida permissão de execução para arquivos locais em plataformas POSIX.
 */
function ensureLocalExecutablePermission(targetPath: string): void {
  if (process.platform === "win32") return;

  try {
    fs.accessSync(targetPath, fs.constants.X_OK);
  } catch {
    throw new ExecutableResolutionError(
      "NOT_EXECUTABLE",
      `Executável do emulador sem permissão de execução: ${targetPath}`,
      targetPath
    );
  }
}

/**
 * Retorna `true` apenas para arquivos regulares já existentes.
 */
function isExistingFile(targetPath: string): boolean {
  try {
    return fs.statSync(targetPath).isFile();
  } catch {
    return false;
  }
}
