/**
 * Contratos compartilhados do histórico de logs do GameStock.
 *
 * Mantém a comunicação entre processo principal e renderer tipada, sem expor
 * detalhes do arquivo NDJSON usado para persistência local.
 */

/** Níveis de severidade registrados pelo aplicativo. */
export type AppLogLevel = "info" | "warn" | "error";

/** Origem do evento registrada para facilitar o diagnóstico. */
export type AppLogSource = "main" | "renderer";

/** Entrada serializável exibida na tela de logs. */
export interface AppLogEntry {
  /** Identificador estável da entrada no arquivo de log. */
  id: string;
  /** Data e hora no formato ISO 8601. */
  timestamp: string;
  /** Nível de severidade da entrada. */
  level: AppLogLevel;
  /** Processo que originou o evento. */
  source: AppLogSource;
  /** Conteúdo textual seguro para exibição. */
  message: string;
}

/** Resultado de consulta do histórico local. */
export interface AppLogListResult {
  /** Entradas mais recentes, em ordem decrescente de data. */
  entries: AppLogEntry[];
  /** Caminho absoluto do arquivo atual de logs. */
  filePath: string;
}
