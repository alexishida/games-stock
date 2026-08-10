/**
 * Persistência local e consulta do histórico de logs do GameStock.
 *
 * Captura saídas relevantes do processo principal em NDJSON, rotaciona o
 * arquivo antes que fique excessivo e entrega entradas recentes ao renderer.
 */

import fs from "node:fs";
import path from "node:path";
import type { AppLogEntry, AppLogLevel, AppLogListResult, AppLogSource } from "../shared/logs";
import { getAppUserDataDir } from "./appPaths";

/** Nome do arquivo atual de logs dentro da pasta de dados do aplicativo. */
const LOG_FILE_NAME = "gamestock.log";
/** Nome do arquivo anterior preservado durante a rotação. */
const PREVIOUS_LOG_FILE_NAME = "gamestock.previous.log";
/** Tamanho máximo do arquivo atual antes da rotação. */
const MAX_LOG_FILE_BYTES = 1_500_000;
/** Quantidade máxima de entradas retornadas para não sobrecarregar a interface. */
const MAX_VISIBLE_LOG_ENTRIES = 500;

/** Evita instalar a captura de console mais de uma vez em recargas de módulo. */
let consoleCaptureInstalled = false;

/** Retorna caminho absoluto do arquivo atual, criando diretório quando necessário. */
export function getLogFilePath(): string {
  const logsDir = path.join(getAppUserDataDir(), "logs");
  fs.mkdirSync(logsDir, { recursive: true });
  return path.join(logsDir, LOG_FILE_NAME);
}

/** Transforma valor arbitrário em texto de log, preservando stacks de Error. */
function formatLogValue(value: unknown): string {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === "string") return value;
  if (typeof value === "undefined") return "undefined";

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Gira arquivo atual quando ele alcança limite definido, mantendo uma cópia anterior. */
function rotateLogFileIfNeeded(filePath: string): void {
  try {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size < MAX_LOG_FILE_BYTES) return;
    fs.rmSync(path.join(path.dirname(filePath), PREVIOUS_LOG_FILE_NAME), { force: true });
    fs.renameSync(filePath, path.join(path.dirname(filePath), PREVIOUS_LOG_FILE_NAME));
  } catch {
    // Log não pode impedir o fluxo principal caso o disco esteja indisponível.
  }
}

/** Grava uma entrada no arquivo local sem deixar uma falha de I/O derrubar o app. */
export function writeAppLog(level: AppLogLevel, source: AppLogSource, ...values: unknown[]): void {
  try {
    const filePath = getLogFilePath();
    rotateLogFileIfNeeded(filePath);
    const entry: AppLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      level,
      source,
      message: values.map(formatLogValue).join(" ")
    };
    fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // Evita recursão: esta função não usa console quando a gravação falha.
  }
}

/** Instala captura das saídas de console do processo principal uma única vez. */
export function installConsoleLogCapture(): void {
  if (consoleCaptureInstalled) return;
  consoleCaptureInstalled = true;

  const intercept = (method: "log" | "info" | "warn" | "error", level: AppLogLevel): void => {
    const original = console[method].bind(console);
    console[method] = (...values: unknown[]) => {
      writeAppLog(level, "main", ...values);
      original(...values);
    };
  };

  intercept("log", "info");
  intercept("info", "info");
  intercept("warn", "warn");
  intercept("error", "error");
  writeAppLog("info", "main", "Captura de logs iniciada.");
}

/** Lê e valida entradas persistidas, ignorando linhas incompletas após desligamento inesperado. */
function parseLogEntries(filePath: string): AppLogEntry[] {
  try {
    return fs.readFileSync(filePath, "utf8")
      .split("\n")
      .flatMap((line) => {
        if (!line.trim()) return [];
        try {
          const entry = JSON.parse(line) as AppLogEntry;
          return entry.id && entry.timestamp && entry.message ? [entry] : [];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

/** Retorna histórico recente do arquivo atual e do arquivo rotacionado, se existir. */
export function listAppLogs(): AppLogListResult {
  const filePath = getLogFilePath();
  const previousPath = path.join(path.dirname(filePath), PREVIOUS_LOG_FILE_NAME);
  const entries = [...parseLogEntries(previousPath), ...parseLogEntries(filePath)]
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, MAX_VISIBLE_LOG_ENTRIES);

  return { entries, filePath };
}

/** Remove histórico atual e anterior solicitado explicitamente pelo usuário. */
export function clearAppLogs(): void {
  const filePath = getLogFilePath();
  try {
    fs.rmSync(filePath, { force: true });
    fs.rmSync(path.join(path.dirname(filePath), PREVIOUS_LOG_FILE_NAME), { force: true });
    writeAppLog("info", "main", "Histórico de logs limpo pelo usuário.");
  } catch {
    // Falha de limpeza não deve afetar o restante do aplicativo.
  }
}
