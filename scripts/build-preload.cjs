/**
 * Gera o preload como arquivo único compatível com renderer sandboxed do Electron.
 *
 * Preloads em sandbox não podem carregar módulos locais com `require`. O bundle
 * incorpora os canais IPC compartilhados e mantém somente `electron` externo.
 */

const esbuild = require("esbuild");
const path = require("node:path");

/** Diretório raiz do projeto, usado para resolver entrada e saída de modo estável. */
const rootDir = path.resolve(__dirname, "..");

/** Opções compartilhadas entre build único e modo watch. */
const buildOptions = {
  entryPoints: [path.join(rootDir, "src", "preload", "index.ts")],
  outfile: path.join(rootDir, "dist", "preload", "index.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["electron"],
  logLevel: "info"
};

/**
 * Compila o preload uma vez ou o mantém recompilando durante desenvolvimento.
 *
 * @returns {Promise<void>} Resolve quando a build única termina ou o watch inicia.
 */
async function main() {
  if (process.argv.includes("--watch")) {
    const context = await esbuild.context(buildOptions);
    await context.watch();
    return;
  }

  await esbuild.build(buildOptions);
}

main().catch((error) => {
  console.error("[build-preload] Falha ao gerar preload:", error);
  process.exit(1);
});
