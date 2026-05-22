/**
 * Gera os artefatos finais usados pelo bucket S3 após `npm run dist:windows`.
 *
 * Saídas:
 * - `release/s3/latest.zip` com o payload aplicavel da pasta `release/win-unpacked`
 * - `release/s3/meta-dados.json` com versão, build, data e URL pública fixa do ZIP
 *
 * Regras:
 * - O ZIP contem `resources/app.asar` e `resources/app.asar.unpacked` quando houver
 * - `_update_staging*` e outros artefatos transitórios não entram no pacote
 * - A URL final do update é fixa para manter o mesmo endpoint público
 *   consumido pelo updater: `http://s3.alexishida.com/gamestock/latest.zip`
 */

const fs = require("node:fs");
const path = require("node:path");
const AdmZip = require("adm-zip");

/** Diretório raiz do repositório. */
const rootDir = path.resolve(__dirname, "..");

/** Diretório de saída padrão do electron-builder no Windows. */
const releaseDir = path.join(rootDir, "release");

/** Pasta com a build extraída usada como base do ZIP para update. */
const unpackedDir = path.join(releaseDir, "win-unpacked");

/** Pasta `resources` da build extraida, onde ficam app.asar e nativos. */
const unpackedResourcesDir = path.join(unpackedDir, "resources");

/** Pasta final com artefatos prontos para upload ao S3. */
const s3Dir = path.join(releaseDir, "s3");

/** Caminho do package.json do projeto. */
const packageJsonPath = path.join(rootDir, "package.json");

/** Caminho do arquivo gerado com metadados da build atual. */
const buildMetaPath = path.join(rootDir, "src", "shared", "build-meta.ts");

/** Nome fixo do ZIP publicado para o fluxo de atualização automática. */
const latestZipFileName = "latest.zip";

/** URL pública fixa consumida pelo updater para sempre apontar ao pacote atual. */
const latestZipPublicUrl = "http://s3.alexishida.com/gamestock/latest.zip";

/** Prefixos transitórios que não devem ser distribuídos no ZIP de update. */
const excludedTopLevelPrefixes = ["_update_staging"];

/**
 * Lê a versão base diretamente do package.json.
 */
function readVersion() {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  return String(packageJson.version || "0.0.0");
}

/**
 * Lê o hash da build a partir de `src/shared/build-meta.ts`.
 *
 * Reutilizamos o arquivo já gerado no pipeline para manter consistência entre
 * splash, release e metadados publicados.
 */
function readBuildCommit() {
  const content = fs.readFileSync(buildMetaPath, "utf8");
  const match = content.match(/APP_BUILD_COMMIT = "([^"]*)"/);
  return match?.[1]?.trim() || "local";
}

/**
 * Retorna timestamp no formato `YYYY-MM-DD HH:mm:ss`.
 */
function formatPublishedAt(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Garante que a build `win-unpacked` exista antes de tentar empacotar.
 */
function ensureUnpackedBuildExists() {
  if (!fs.existsSync(unpackedDir)) {
    throw new Error(`Pasta de build não encontrada: ${unpackedDir}`);
  }
}

/**
 * Remove artefatos antigos da pasta `release/s3` para evitar lixo entre builds.
 */
function prepareS3Directory() {
  fs.rmSync(s3Dir, { recursive: true, force: true });
  fs.mkdirSync(s3Dir, { recursive: true });
}

/**
 * Adiciona arquivos ao ZIP preservando caminhos relativos.
 *
 * O filtro remove diretórios transitórios do topo e ignora paths ausentes.
 */
function addDirectoryToZip(zip, sourceDir, relativePrefix = "") {
  if (!fs.existsSync(sourceDir)) return;

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!relativePrefix && isExcludedTopLevelEntry(entry.name)) {
      continue;
    }

    const absolutePath = path.join(sourceDir, entry.name);
    const relativePath = relativePrefix ? path.posix.join(relativePrefix, entry.name) : entry.name;

    if (entry.isDirectory()) {
      addDirectoryToZip(zip, absolutePath, relativePath);
      continue;
    }

    if (entry.isFile()) {
      zip.addLocalFile(absolutePath, path.posix.dirname(relativePath) === "." ? "" : path.posix.dirname(relativePath), path.posix.basename(relativePath));
    }
  }
}

/**
 * Evita empacotar staging fixo antigo ou staging unico novo.
 */
function isExcludedTopLevelEntry(name) {
  return excludedTopLevelPrefixes.some((prefix) => name.startsWith(prefix));
}

/**
 * Adiciona arquivo unico ao ZIP com caminho interno explicito.
 */
function addFileToZip(zip, sourceFilePath, zipEntryPath) {
  const zipDirectory = path.posix.dirname(zipEntryPath);
  const zipFileName = path.posix.basename(zipEntryPath);
  zip.addLocalFile(sourceFilePath, zipDirectory === "." ? "" : zipDirectory, zipFileName);
}

/**
 * Adiciona ao ZIP somente o payload que o updater sabe aplicar.
 */
function addUpdatePayloadToZip(zip) {
  const appAsarPath = path.join(unpackedResourcesDir, "app.asar");
  const appAsarUnpackedDir = path.join(unpackedResourcesDir, "app.asar.unpacked");
  const appDir = path.join(unpackedResourcesDir, "app");

  if (fs.existsSync(appAsarPath)) {
    addFileToZip(zip, appAsarPath, "resources/app.asar");
    addDirectoryToZip(zip, appAsarUnpackedDir, "resources/app.asar.unpacked");
    return;
  }

  if (fs.existsSync(appDir)) {
    addDirectoryToZip(zip, appDir, "app");
    return;
  }

  throw new Error(`Payload de update nao encontrado em: ${unpackedResourcesDir}`);
}

/**
 * Gera ZIP final com o payload de update na raiz do pacote.
 */
function createS3Zip(zipFilePath) {
  const zip = new AdmZip();
  addUpdatePayloadToZip(zip);
  zip.writeZip(zipFilePath);
}

/**
 * Escreve manifesto `meta-dados.json` consumido pelo updater.
 */
function writeMetadataFile(version, buildCommit, zipFileName) {
  const metadata = {
    data: formatPublishedAt(),
    versao: version,
    build: buildCommit,
    path: latestZipPublicUrl
  };

  fs.writeFileSync(
    path.join(s3Dir, "meta-dados.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8"
  );
}

/**
 * Executa a geração completa dos artefatos de upload S3.
 */
function main() {
  ensureUnpackedBuildExists();
  prepareS3Directory();

  const version = readVersion();
  const buildCommit = readBuildCommit();
  const zipFileName = latestZipFileName;
  const zipFilePath = path.join(s3Dir, zipFileName);

  createS3Zip(zipFilePath);
  writeMetadataFile(version, buildCommit, zipFileName);

  console.log(`Artefatos S3 gerados em: ${s3Dir}`);
  console.log(`ZIP: ${zipFileName}`);
  console.log("Manifesto: meta-dados.json");
}

main();
