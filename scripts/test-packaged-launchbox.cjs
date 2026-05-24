/**
 * Gera a build Windows empacotada e roda o E2E do LaunchBox contra ela.
 *
 * Mantém o fluxo atual de teste empacotado, mas sem depender de `&&` e `set`.
 */

const path = require("node:path");
const { spawn } = require("node:child_process");
const { runElectron } = require("./run-electron.cjs");

/** Diretório raiz do projeto. */
const rootDir = path.resolve(__dirname, "..");

/** Retorna o executável do npm compatível com a plataforma atual. */
function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

/** Executa um script npm antes de iniciar o E2E empacotado. */
function runNpmScript(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn(getNpmCommand(), ["run", scriptName], {
      cwd: rootDir,
      env: process.env,
      stdio: "inherit"
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`npm run ${scriptName} falhou com exit code ${code ?? "desconhecido"}.`));
    });
  });
}

/** Gera build Windows e dispara o script E2E em modo empacotado. */
async function main() {
  await runNpmScript("dist:windows");
  runElectron(["scripts/e2e-launchbox.cjs"], { GAMESTOCK_E2E_PACKAGED: "1" });
}

main().catch((error) => {
  console.error("[test-packaged-launchbox] Falha no preparo do E2E empacotado:", error);
  process.exit(1);
});
