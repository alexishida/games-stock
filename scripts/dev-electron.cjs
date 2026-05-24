/**
 * Aguarda artefatos do modo dev e inicia o Electron sem depender de `&&`.
 *
 * Mantém fluxo único para Linux, macOS e Windows usando a API do `wait-on`
 * já instalada no projeto.
 */

const path = require("node:path");
const waitOn = require("wait-on");
const { runElectron } = require("./run-electron.cjs");

/** Recursos mínimos exigidos antes de abrir a janela principal em dev. */
const RESOURCES = [
  "tcp:5173",
  `file:${path.resolve(__dirname, "..", "dist/main/bootstrap.js")}`,
  `file:${path.resolve(__dirname, "..", "dist/preload/index.js")}`
];

/** Espera o ambiente de dev ficar pronto e só então abre o app. */
async function main() {
  await waitOn({
    resources: RESOURCES,
    timeout: 120_000,
    validateStatus: (status) => status >= 200 && status < 500
  });

  runElectron([path.resolve(__dirname, "..")]);
}

main().catch((error) => {
  console.error("[dev-electron] Falha ao aguardar ambiente de desenvolvimento:", error);
  process.exit(1);
});
