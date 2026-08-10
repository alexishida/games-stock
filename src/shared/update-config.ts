/**
 * Identificacao de build compartilhada pelo updater e renderer.
 *
 * Fonte de update vem de `app-update.yml`, gerado pelo electron-builder a
 * partir da configuracao de publicacao GitHub.
 */

import { APP_BUILD_COMMIT } from "./build-meta";

/** Constante injetada pelo Vite com identificador textual da build atual. */
declare const __BUILD_NUMBER__: string | number | undefined;

/**
 * Resolve identificador de build local exibido nas telas do aplicativo.
 */
function readBuildNumber(): string {
  if (typeof __BUILD_NUMBER__ === "string" && __BUILD_NUMBER__.trim()) {
    return __BUILD_NUMBER__.trim();
  }

  if (typeof __BUILD_NUMBER__ === "number") return String(__BUILD_NUMBER__);
  return APP_BUILD_COMMIT || "local";
}

/** Identificador textual da build instalada, exibido na splash. */
export const BUILD_NUMBER = readBuildNumber();
