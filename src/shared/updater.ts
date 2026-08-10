/**
 * Tipos compartilhados do fluxo de atualização automática.
 *
 * Centraliza o contrato entre processo main, preload e renderer da splash.
 */

/** Fases visíveis do updater usadas para mensagens e estados da splash. */
export type UpdaterPhase =
  | "checking"
  | "downloading"
  | "applying"
  | "up-to-date"
  | "external-update"
  | "error"
  | "no-connection";

/** Identificador de build aceito tanto localmente quanto no manifesto remoto. */
export type UpdaterBuildNumber = number | string;

/** Estrutura esperada do JSON de release publicado no servidor. */
export interface UpdateManifest {
  version: string;
  buildNumber: UpdaterBuildNumber;
  releaseDate: string;
  downloadUrl: string;
  /** SHA-256 hexadecimal do ZIP publicado; valida integridade antes de aplicar. */
  sha256: string;
  releaseNotes: string;
}

/** Payload enviado do main para o renderer da splash com estado do fluxo. */
export interface UpdaterStatus {
  phase: UpdaterPhase;
  message: string;
  percent?: number;
  error?: string;
  errorLogPath?: string;
  requiresAction?: boolean;
  version?: string;
  buildNumber?: UpdaterBuildNumber;
  /** Data de publicação da release remota, quando o manifesto já foi consultado. */
  releaseDate?: string;
  /** Notas da release remota, quando o manifesto já foi consultado. */
  releaseNotes?: string;
}

/** Dados locais da instalação exibidos na splash. */
export interface UpdaterAppInfo {
  version: string;
  buildNumber: string;
}
