/**
 * Entry point isolado da splash screen.
 *
 * Reutiliza as variáveis globais do design system do app para manter coesão
 * visual com a janela principal.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { SplashScreen } from "./SplashScreen";
import "../renderer/styles/global.css";
import "./SplashScreen.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SplashScreen />
  </React.StrictMode>
);
