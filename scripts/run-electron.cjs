/**
 * Executa o binário do Electron limpando variáveis que forçam modo Node.
 *
 * Usado por testes e scripts locais para evitar dependência de sintaxe de shell
 * como `set ELECTRON_RUN_AS_NODE=` ou `export ELECTRON_RUN_AS_NODE=`.
 */

const { spawn } = require("node:child_process");
const path = require("node:path");

/** Resolve o executável real do Electron instalado no projeto. */
function getElectronBinaryPath() {
  return require("electron");
}

/** Monta ambiente limpo para iniciar o Electron em modo de app desktop. */
function buildElectronEnv(extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

/** Executa o Electron e replica o código de saída no processo atual. */
function runElectron(targetArgs, extraEnv = {}) {
  const electronBinaryPath = getElectronBinaryPath();
  const child = spawn(electronBinaryPath, targetArgs, {
    stdio: "inherit",
    env: buildElectronEnv(extraEnv)
  });

  child.once("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.once("error", (error) => {
    console.error("[run-electron] Falha ao iniciar Electron:", error);
    process.exit(1);
  });
}

/** Permite uso direto via CLI: `node scripts/run-electron.cjs .` */
function main() {
  const targetArgs = process.argv.slice(2);
  const normalizedArgs = targetArgs.length > 0 ? targetArgs : [path.resolve(__dirname, "..")];
  runElectron(normalizedArgs);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildElectronEnv,
  runElectron
};
