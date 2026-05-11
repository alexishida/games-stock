/**
 * Ponto de entrada do renderer process.
 * Monta o componente raiz `App` dentro do elemento #root do HTML,
 * envolvido em React.StrictMode para detectar problemas em desenvolvimento.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
