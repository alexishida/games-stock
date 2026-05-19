/**
 * Constantes de configuração do updater compartilhadas entre main e renderer.
 *
 * Este módulo usa `define` do Vite quando disponível no renderer, mas mantém
 * fallback seguro para o processo main compilado via TypeScript puro.
 */

import { app } from "electron";
import { APP_BUILD_COMMIT } from "./build-meta";

/** Endpoint padrão publicado para o manifesto remoto do GameStock. */
const DEFAULT_UPDATE_MANIFEST_URL = "https://s3.alexishida.com/gamestock/meta-dados.json";

/** Constante injetada pelo Vite com a URL do manifesto remoto de updates. */
declare const __UPDATE_MANIFEST_URL__: string | undefined;

/** Constante injetada pelo Vite com o identificador textual da build atual. */
declare const __BUILD_NUMBER__: string | number | undefined;

/**
 * Lê valor textual de update com fallback para `process.env` no main.
 *
 * O `typeof` evita `ReferenceError` quando a constante do Vite não existe no
 * runtime Node.js do Electron. Em desenvolvimento local, retornamos string
 * vazia para pular splash/updater e não travar `npm run dev:windows`.
 */
function readUpdateManifestUrl(): string {
  if (typeof __UPDATE_MANIFEST_URL__ === "string") {
    return __UPDATE_MANIFEST_URL__.trim();
  }

  if (typeof process.env.UPDATE_MANIFEST_URL === "string") {
    return process.env.UPDATE_MANIFEST_URL.trim();
  }

  // Mantém endpoint padrão só na build empacotada; no app solto/desenvolvimento
  // o boot segue direto para janela principal.
  return app.isPackaged ? DEFAULT_UPDATE_MANIFEST_URL : "";
}

/**
 * Resolve identificador de build local mostrado na splash.
 *
 * Preferimos a constante do build; quando ela não existir, reutilizamos o hash
 * de commit já gerado pelo projeto para manter a UI informativa.
 */
function readBuildNumber(): string {
  if (typeof __BUILD_NUMBER__ === "string" && __BUILD_NUMBER__.trim()) {
    return __BUILD_NUMBER__.trim();
  }

  if (typeof __BUILD_NUMBER__ === "number") {
    return String(__BUILD_NUMBER__);
  }

  return APP_BUILD_COMMIT || "local";
}

/** URL completa do JSON remoto com metadados da última release. */
export const UPDATE_MANIFEST_URL = readUpdateManifestUrl();

/** Identificador textual da build instalada, exibido na splash. */
export const BUILD_NUMBER = readBuildNumber();
