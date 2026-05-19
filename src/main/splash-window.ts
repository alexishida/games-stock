/**
 * Janela Electron dedicada da splash screen de inicialização.
 *
 * Ela existe separada da janela principal porque precisa aparecer antes do
 * bundle principal carregar e antes da verificação de updates terminar.
 */

import { app, BrowserWindow } from "electron";
import path from "node:path";

/** Alias semântico para deixar explícito onde esperamos receber a splash. */
export type SplashWindow = BrowserWindow;

/**
 * Cria e carrega a janela da splash.
 *
 * A janela usa preload padrão do projeto para acessar o namespace `updater`
 * exposto via `window.gameStockAPI`.
 */
export async function createSplashWindow(): Promise<SplashWindow> {
  const splashWindow = new BrowserWindow({
    width: 480,
    height: 320,
    minWidth: 480,
    minHeight: 320,
    maxWidth: 480,
    maxHeight: 320,
    show: false,
    frame: false,
    transparent: false,
    center: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: "#131313",
    title: "GameStock",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, "../preload/index.js")
    }
  });

  // Espera o renderer estar pronto para evitar flash de tela branca.
  splashWindow.once("ready-to-show", () => splashWindow.show());

  if (process.env.VITE_DEV_SERVER_URL || !app.isPackaged) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173";
    await splashWindow.loadURL(new URL("/src/splash/index.html", devServerUrl).toString());
  } else {
    await splashWindow.loadFile(path.join(__dirname, "../renderer/src/splash/index.html"));
  }

  return splashWindow;
}
