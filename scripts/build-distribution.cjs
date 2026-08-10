/**
 * Orquestra build e empacotamento do app sem depender de operadores de shell.
 *
 * Suporta distribuição Windows e Linux usando o mesmo fluxo de preparação:
 * sincronizar metadados da build, compilar renderer/main e chamar o
 * `electron-builder` com o target apropriado.
 */

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/** Diretório raiz do repositório. */
const rootDir = path.resolve(__dirname, "..");

/** Diretorio descartavel que recebe somente artefatos da build atual. */
const releaseDir = path.join(rootDir, "release");

/** CLI do electron-builder instalada localmente no projeto. */
const electronBuilderCliPath = require.resolve("electron-builder/out/cli/cli.js");

/**
 * Retorna descritor de comando para executar scripts npm.
 *
 * No Windows, alguns ambientes/versoes de Node falham com `spawn EINVAL`
 * ao iniciar `.cmd` diretamente. Encapsular em `cmd.exe /c` evita esse problema.
 */
function getNpmCommandDescriptor() {
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", "npm.cmd"]
    };
  }

  return {
    command: "npm",
    args: []
  };
}

/**
 * Executa um comando herdando stdout/stderr e falha ao receber exit code != 0.
 *
 * @param {string} command Comando a ser executado.
 * @param {string[]} args Argumentos do comando.
 */
function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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

      reject(new Error(`Comando falhou (${command} ${args.join(" ")}), exit code ${code ?? "desconhecido"}.`));
    });
  });
}

/** Executa um script npm já definido no package.json. */
async function runNpmScript(scriptName) {
  const npmCommand = getNpmCommandDescriptor();
  await runCommand(npmCommand.command, [...npmCommand.args, "run", scriptName]);
}

/**
 * Executa electron-builder com configuracao GitHub para tambem gerar `latest.yml`.
 *
 * Sem token de publicacao em ambiente local, electron-builder apenas escreve os
 * artefatos em `release/`; upload continua responsabilidade do mantenedor.
 */
async function runElectronBuilder(builderArgs) {
  await runCommand(process.execPath, [electronBuilderCliPath, ...builderArgs]);
}

/** Converte flags da CLI em configuração simples de build. */
function parseCliArgs(argv) {
  const wantsWindows = argv.includes("--win");
  const wantsLinux = argv.includes("--linux");

  if (!wantsWindows && !wantsLinux) {
    throw new Error("Informe --win ou --linux para escolher a plataforma de distribuição.");
  }

  return { wantsWindows, wantsLinux };
}

/**
 * Remove artefatos anteriores para `latest.yml` nunca apontar para upload antigo.
 *
 * O alvo e validado contra raiz do projeto antes da remocao recursiva, pois
 * `release/` e saida gerada e nao armazena arquivos-fonte do aplicativo.
 */
function cleanReleaseOutput() {
  if (path.resolve(releaseDir) === rootDir) {
    throw new Error("Diretorio de release invalido: nao pode ser raiz do projeto.");
  }

  fs.rmSync(releaseDir, { recursive: true, force: true });
}

/** Executa build completa para a plataforma solicitada. */
async function main() {
  const options = parseCliArgs(process.argv.slice(2));

  cleanReleaseOutput();
  await runNpmScript("build:renderer");
  await runNpmScript("build:main");

  if (options.wantsWindows) {
    await runElectronBuilder(["--win"]);
  }

  if (options.wantsLinux) {
    await runElectronBuilder(["--linux"]);
  }
}

main().catch((error) => {
  console.error("[build-distribution] Falha ao gerar distribuição:", error);
  process.exit(1);
});
