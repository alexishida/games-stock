/**
 * Preparação de ROM compactada (.zip/.7z) para launch no emulador.
 *
 * Quando o jogo aponta para um arquivo compactado, o conteúdo é extraído para
 * uma pasta temporária do GameStock e o emulador recebe o caminho do arquivo
 * extraído em vez do pacote. A extração de .zip roda em worker thread (ver
 * `romExtractWorker.ts`); a de .7z roda via binário `7za` do pacote `7zip-bin`
 * em processo filho (assíncrono, não bloqueia o event loop). Ambas são
 * cacheadas por arquivo (caminho + tamanho + mtime), então launches repetidos
 * do mesmo jogo reaproveitam a extração anterior.
 *
 * Extrações sem uso há mais de `STALE_EXTRACTION_TTL_MS` são removidas de
 * forma oportunista após cada launch, para a pasta temporária não crescer
 * indefinidamente.
 */

import { path7za } from "7zip-bin";
import { app } from "electron";
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { ALL_SUPPORTED_ROM_EXTENSIONS } from "./db/platformCatalog";

/** Nome do marcador gravado em cada extração com o arquivo de launch escolhido. */
const LAUNCH_MARKER_FILE = ".gamestock-launch.json";

/** Tempo de vida de uma extração sem uso antes de ser removida da pasta temporária. */
const STALE_EXTRACTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Extensões de "índice de disco" preferidas como arquivo de launch, em ordem
 * de prioridade. O .m3u agrupa multi-disco; .cue/.gdi/.ccd/.toc apontam para
 * as trilhas binárias do disco.
 */
const DISC_INDEX_EXTENSIONS = [".m3u", ".cue", ".gdi", ".ccd", ".toc"];

/** Extensões compactadas que nunca devem ser escolhidas como arquivo de launch. */
const COMPRESSED_EXTENSIONS = new Set([".zip", ".7z"]);

/** Extensões de pacote que o fluxo de launch sabe extrair para a pasta temporária. */
const EXTRACTABLE_ARCHIVE_EXTENSIONS = new Set([".zip", ".7z"]);

/** Conteúdo persistido no marcador de extração. */
interface LaunchMarker {
  /** Caminho relativo (dentro da pasta de extração) do arquivo escolhido para launch. */
  launchFile: string;
}

/** Arquivo encontrado dentro da pasta de extração, com metadados para a escolha. */
interface ExtractedFile {
  /** Caminho relativo à pasta de extração. */
  relativePath: string;
  /** Tamanho em bytes (usado como heurística de "arquivo principal"). */
  size: number;
}

/**
 * Resolve o caminho de ROM que deve ser passado ao emulador.
 *
 * - ROM que não é .zip/.7z: retorna o caminho original sem tocar no disco.
 * - ROM compactada: extrai (ou reaproveita extração cacheada) e retorna o
 *   caminho do arquivo extraído.
 * - Falha na extração: retorna o próprio pacote como fallback, preservando o
 *   comportamento antigo para setups que já funcionavam com pacote nativo
 *   (ex.: cores do RetroArch que leem zip diretamente).
 */
export async function prepareRomPathForLaunch(romPath: string): Promise<string> {
  if (!EXTRACTABLE_ARCHIVE_EXTENSIONS.has(path.extname(romPath).toLowerCase())) return romPath;

  try {
    return await resolveExtractedLaunchPath(romPath);
  } catch (error) {
    console.warn("[romLaunchExtraction] Falha ao extrair ROM compactada; usando o arquivo original:", error);
    return romPath;
  } finally {
    // Limpeza oportunista de extrações antigas; nunca bloqueia nem falha o launch.
    void pruneStaleExtractions().catch(() => {});
  }
}

/**
 * Garante que o pacote esteja extraído na pasta temporária e retorna o caminho
 * absoluto do arquivo escolhido para launch.
 */
async function resolveExtractedLaunchPath(archivePath: string): Promise<string> {
  const resolvedArchivePath = path.resolve(archivePath);
  const archiveStats = await fs.promises.stat(resolvedArchivePath);
  const extractionDir = path.join(getExtractionRootDir(), buildExtractionKey(resolvedArchivePath, archiveStats));

  // Reaproveita extração anterior do mesmo pacote (mesmo caminho, tamanho e mtime)
  const cachedLaunchPath = await readReusableLaunchPath(extractionDir);
  if (cachedLaunchPath) return cachedLaunchPath;

  await extractArchiveForLaunch(resolvedArchivePath, extractionDir);

  const launchFile = await pickLaunchFile(extractionDir);
  if (!launchFile) throw new Error(`Nenhum arquivo de ROM encontrado dentro de ${path.basename(resolvedArchivePath)}`);

  await writeLaunchMarker(extractionDir, launchFile);
  return path.join(extractionDir, launchFile);
}

/**
 * Roteia a extração pelo formato do pacote: .zip usa worker com `adm-zip`;
 * .7z usa o binário `7za` em processo filho.
 */
async function extractArchiveForLaunch(archivePath: string, targetDir: string): Promise<void> {
  if (path.extname(archivePath).toLowerCase() === ".7z") {
    await extract7zArchive(archivePath, targetDir);
    return;
  }

  await extractZipInWorker(archivePath, targetDir);
}

/** Raiz das extrações temporárias do GameStock dentro do temp do sistema. */
function getExtractionRootDir(): string {
  return path.join(app.getPath("temp"), "gamestock", "extracted-roms");
}

/**
 * Gera o nome da pasta de extração para um pacote específico.
 *
 * O hash inclui caminho, tamanho e mtime: se o usuário substituir o pacote por
 * outra versão, a chave muda e a extração antiga deixa de ser reaproveitada.
 */
function buildExtractionKey(resolvedArchivePath: string, archiveStats: fs.Stats): string {
  const hash = crypto
    .createHash("sha1")
    .update(`${resolvedArchivePath}|${archiveStats.size}|${archiveStats.mtimeMs}`)
    .digest("hex")
    .slice(0, 12);
  const safeBaseName = path
    .basename(resolvedArchivePath, path.extname(resolvedArchivePath))
    .replace(/[^a-z0-9-_]+/gi, "_")
    .slice(0, 60);
  return `${safeBaseName}-${hash}`;
}

/**
 * Tenta reaproveitar uma extração anterior. Retorna o caminho absoluto do
 * arquivo de launch quando o marcador é válido e o arquivo ainda existe.
 * Leitura tolerante: marcador corrompido ou incompleto apenas força reextração.
 */
async function readReusableLaunchPath(extractionDir: string): Promise<string | null> {
  const markerPath = path.join(extractionDir, LAUNCH_MARKER_FILE);

  try {
    const marker = JSON.parse(await fs.promises.readFile(markerPath, "utf8")) as Partial<LaunchMarker>;
    if (!marker.launchFile || typeof marker.launchFile !== "string") return null;

    const launchPath = path.join(extractionDir, marker.launchFile);
    await fs.promises.access(launchPath, fs.constants.R_OK);

    // Atualiza o mtime do marcador: ele é o critério de "uso recente" na limpeza
    const now = new Date();
    await fs.promises.utimes(markerPath, now, now).catch(() => {});
    return launchPath;
  } catch {
    return null;
  }
}

/** Persiste o arquivo de launch escolhido para reaproveitamento em launches futuros. */
async function writeLaunchMarker(extractionDir: string, launchFile: string): Promise<void> {
  const marker: LaunchMarker = { launchFile };
  await fs.promises.writeFile(path.join(extractionDir, LAUNCH_MARKER_FILE), JSON.stringify(marker), "utf8");
}

/**
 * Escolhe qual arquivo extraído deve ser passado ao emulador:
 * 1. Índice de disco (.m3u > .cue > .gdi > .ccd > .toc), em ordem alfabética
 *    para multi-disco sem .m3u abrir o disco 1.
 * 2. Maior arquivo com extensão de ROM conhecida do catálogo (exceto compactados).
 * 3. Maior arquivo do zip, como último recurso (cobre .bin sem .cue etc.).
 */
async function pickLaunchFile(extractionDir: string): Promise<string | null> {
  const files = await listExtractedFiles(extractionDir);
  if (files.length === 0) return null;

  for (const discExtension of DISC_INDEX_EXTENSIONS) {
    const discCandidates = files
      .filter((file) => path.extname(file.relativePath).toLowerCase() === discExtension)
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    if (discCandidates.length > 0) return discCandidates[0].relativePath;
  }

  const knownRomExtensions = new Set(
    ALL_SUPPORTED_ROM_EXTENSIONS.map((extension) => extension.toLowerCase()).filter(
      (extension) => !COMPRESSED_EXTENSIONS.has(extension)
    )
  );
  const romCandidates = files.filter((file) => knownRomExtensions.has(path.extname(file.relativePath).toLowerCase()));
  const pool = romCandidates.length > 0 ? romCandidates : files;

  return pool.reduce((largest, file) => (file.size > largest.size ? file : largest)).relativePath;
}

/** Lista recursivamente os arquivos extraídos, ignorando o marcador interno. */
async function listExtractedFiles(extractionDir: string, relativeBase = ""): Promise<ExtractedFile[]> {
  const entries = await fs.promises.readdir(path.join(extractionDir, relativeBase), { withFileTypes: true });
  const files: ExtractedFile[] = [];

  for (const entry of entries) {
    const relativePath = relativeBase ? path.join(relativeBase, entry.name) : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listExtractedFiles(extractionDir, relativePath)));
      continue;
    }
    if (!entry.isFile() || entry.name === LAUNCH_MARKER_FILE) continue;

    const stats = await fs.promises.stat(path.join(extractionDir, relativePath));
    files.push({ relativePath, size: stats.size });
  }

  return files;
}

/**
 * Extrai o zip em worker thread para não bloquear o processo principal.
 * Resolve quando o worker confirmar a extração completa.
 */
async function extractZipInWorker(zipPath: string, targetDir: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const worker = new Worker(path.join(__dirname, "romExtractWorker.js"), {
      workerData: { zipPath, targetDir }
    });

    worker.once("message", (message: { ok: boolean; error?: string }) => {
      if (settled) return;
      settled = true;
      if (message.ok) {
        resolve();
        return;
      }

      reject(new Error(message.error ?? "Falha ao extrair ROM compactada."));
    });

    worker.once("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    worker.once("exit", (code) => {
      if (settled) return;
      settled = true;
      if (code !== 0) {
        reject(new Error(`Worker de extração de ROM encerrou com código ${code}.`));
        return;
      }

      resolve();
    });
  });
}

/**
 * Resolve o caminho do binário `7za` do pacote `7zip-bin`.
 *
 * No app empacotado o binário fica em `app.asar.unpacked` (ver `asarUnpack`
 * no electron-builder.yml), porque executável dentro de .asar não pode ser
 * spawnado. Em dev o replace é no-op.
 */
function resolve7zaBinaryPath(): string {
  return path7za.replace("app.asar", "app.asar.unpacked");
}

/**
 * Extrai um pacote .7z com o binário `7za` em processo filho.
 *
 * Processo filho é assíncrono por natureza, então não bloqueia o event loop
 * do main process (diferente do `adm-zip`, que exige worker thread).
 * O `7za` sanitiza caminhos absolutos e `..` na extração, cobrindo zip-slip.
 */
async function extract7zArchive(archivePath: string, targetDir: string): Promise<void> {
  // Remove resíduo de extração anterior incompleta antes de extrair de novo
  await fs.promises.rm(targetDir, { recursive: true, force: true });
  await fs.promises.mkdir(targetDir, { recursive: true });

  const binaryPath = resolve7zaBinaryPath();
  // Em Linux/macOS o bit de execução pode se perder no empacotamento; melhor esforço
  if (process.platform !== "win32") {
    await fs.promises.chmod(binaryPath, 0o755).catch(() => {});
  }

  await new Promise<void>((resolve, reject) => {
    // `x` preserva a estrutura interna de pastas; `-bso0 -bsp0` silencia stdout/progresso
    const args = ["x", archivePath, `-o${targetDir}`, "-y", "-bso0", "-bsp0"];
    execFile(binaryPath, args, { windowsHide: true }, (error, _stdout, stderr) => {
      if (!error) {
        resolve();
        return;
      }

      // Exit code 1 do 7za é "warning não fatal" (ex.: atributo não aplicado); extração segue válida
      const exitCode = typeof (error as NodeJS.ErrnoException & { code?: unknown }).code === "number"
        ? ((error as unknown as { code: number }).code)
        : null;
      if (exitCode === 1) {
        resolve();
        return;
      }

      const detail = stderr?.toString().trim();
      reject(new Error(detail ? `Falha ao extrair .7z: ${detail}` : `Falha ao extrair .7z: ${error.message}`));
    });
  });
}

/**
 * Remove extrações sem uso recente da pasta temporária.
 *
 * O critério de "uso" é o mtime do marcador (atualizado a cada reaproveitamento);
 * pastas sem marcador (extração interrompida) usam o mtime da própria pasta.
 * Best effort: qualquer falha individual é ignorada.
 */
async function pruneStaleExtractions(): Promise<void> {
  const rootDir = getExtractionRootDir();

  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(rootDir, { withFileTypes: true });
  } catch {
    return;
  }

  const now = Date.now();
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const extractionDir = path.join(rootDir, entry.name);

    try {
      let referenceMtimeMs: number;
      try {
        referenceMtimeMs = (await fs.promises.stat(path.join(extractionDir, LAUNCH_MARKER_FILE))).mtimeMs;
      } catch {
        referenceMtimeMs = (await fs.promises.stat(extractionDir)).mtimeMs;
      }

      if (now - referenceMtimeMs > STALE_EXTRACTION_TTL_MS) {
        await fs.promises.rm(extractionDir, { recursive: true, force: true });
      }
    } catch {
      // Pasta em uso ou inacessível; tenta de novo no próximo launch.
    }
  }
}
