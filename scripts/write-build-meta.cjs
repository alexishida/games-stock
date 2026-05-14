/**
 * Gera arquivo TypeScript com metadados de build do app.
 *
 * Motivo:
 * - `app.getVersion()` expõe apenas a versão semântica do package.json.
 * - O app também precisa mostrar o commit curto da build no renderer e no main.
 * - Build empacotada não pode depender de pasta `.git` existir em runtime.
 *
 * Estratégia:
 * - Lê `package.json`.
 * - Tenta obter hash curto do commit atual via `git rev-parse --short=7 HEAD`.
 * - Gera `src/shared/build-meta.ts` com constantes estáticas consumidas pelo app.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

/** Diretório raiz do repositório. */
const rootDir = path.resolve(__dirname, "..");

/** Caminho do `package.json` do projeto. */
const packageJsonPath = path.join(rootDir, "package.json");

/** Caminho do arquivo TypeScript gerado com os metadados da build. */
const outputPath = path.join(rootDir, "src", "shared", "build-meta.ts");

/**
 * Lê hash curto do commit atual.
 *
 * Retorna `null` quando `git` não está disponível ou quando o diretório atual
 * não é um checkout Git válido. Isso mantém fluxo de build funcional em ZIPs
 * soltos ou ambientes sem Git instalado.
 */
function readCommitHash() {
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Escapa texto para string literal TypeScript.
 *
 * Usa `JSON.stringify` para garantir aspas e escapes corretos no arquivo gerado.
 */
function toTsString(value) {
  return JSON.stringify(value);
}

/** Gera conteúdo TypeScript final com comentários e constantes exportadas. */
function buildFileContent(version, commitHash) {
  const versionLabel = commitHash ? `${version} (build ${commitHash})` : version;
  const generatedAt = new Date().toISOString();

  return `/**
 * Metadados de build gerados automaticamente.
 *
 * Este arquivo é atualizado por \`npm run sync:build-meta\`.
 * Não editar manualmente, porque mudanças serão sobrescritas no próximo build.
 *
 * Gerado em: ${generatedAt}
 */

/** Versão semântica base lida do package.json. */
export const APP_SEMVER = ${toTsString(version)};

/** Hash curto do commit usado nesta build, ou string vazia quando indisponível. */
export const APP_BUILD_COMMIT = ${toTsString(commitHash ?? "")};

/** Versão completa exibida na UI, incluindo metadado de build quando existir. */
export const APP_VERSION_LABEL = ${toTsString(versionLabel)};
`;
}

/** Executa geração do arquivo de metadados de build. */
function main() {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const version = String(packageJson.version || "0.0.0");
  const commitHash = readCommitHash();
  const nextContent = buildFileContent(version, commitHash);
  const previousContent = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : null;

  if (previousContent === nextContent) return;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, nextContent, "utf8");
}

main();
