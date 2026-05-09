import AdmZip from "adm-zip";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDatabase, getImagesDir } from "./db/database";
import {
  DataPortabilityCategory,
  DATA_PORTABILITY_CATEGORIES,
  DataPortabilityExportRequest,
  DataPortabilityExportResult,
  DataPortabilityImportPreview,
  DataPortabilityImportRequest,
  DataPortabilityImportResult,
  DataPortabilityImportSummary,
  DataPortabilityManifest,
  DataPortabilityProgress,
  DataPortabilityRomFolderEntry,
  DataPortabilityWarning
} from "../shared/types";
import {
  DataPortabilityDao,
  PortableEmulator,
  PortableGameMetadata,
  PortableMediaEntry,
  PortablePlatform,
  PortablePlatformAlias,
  PortablePlatformEmulator,
  PortableRomExtension,
  PortableRomLocation
} from "./db/dao/dataPortabilityDao";

const SCHEMA_VERSION = 1;
const BACKUP_EXTENSION = ".gamestock-backup";

type ProgressCallback = (progress: Omit<DataPortabilityProgress, "jobId" | "kind">) => void;

interface ExportPackageRequest extends DataPortabilityExportRequest {
  appVersion: string;
  targetPath: string;
}

interface BackupData {
  games: PortableGameMetadata[];
  mediaMap: PortableMediaEntry[];
  platforms: PortablePlatform[];
  aliases: PortablePlatformAlias[];
  romExtensions: PortableRomExtension[];
  emulators: PortableEmulator[];
  platformEmulators: PortablePlatformEmulator[];
  romLocations: PortableRomLocation[];
  romFolderEntries: DataPortabilityRomFolderEntry[];
}

interface LoadedBackup {
  zip: AdmZip;
  manifest: DataPortabilityManifest;
  data: BackupData;
}

interface ExportedMediaFile {
  packagePath: string;
  relativePath: string;
  sourcePath: string;
  size: number;
}

interface ZipBufferEntry {
  kind: "buffer";
  entryName: string;
  buffer: Buffer;
  mtime?: Date;
}

interface ZipFileEntry {
  kind: "file";
  entryName: string;
  sourcePath: string;
  size: number;
  mtime?: Date;
}

type ZipArchiveEntry = ZipBufferEntry | ZipFileEntry;

export function exportDataPackage(request: ExportPackageRequest, onProgress?: ProgressCallback): DataPortabilityExportResult {
  const categories = normalizeCategories(request.categories);
  const dao = new DataPortabilityDao(getDatabase());
  const archiveEntries: ZipArchiveEntry[] = [];
  const warnings: DataPortabilityWarning[] = [];
  const fileChecksums: Record<string, string> = {};
  const counts: DataPortabilityManifest["counts"] = {};
  const mediaRefs = categories.includes("images") ? dao.listMediaReferences() : [];
  const imageFiles = categories.includes("images") ? listImageFilesForBackup(getImagesDir()) : [];
  const total = Math.max(1, categories.length + imageFiles.length + 2);
  let current = 0;
  const report = (stage: DataPortabilityProgress["stage"], message: string): void => {
    current = Math.min(total, current + 1);
    onProgress?.({ current, total, stage, message });
  };

  onProgress?.({ current: 0, total, stage: "preparing", message: "Preparando exportacao" });

  if (categories.includes("metadata")) {
    const games = dao.listGameMetadata();
    counts.games = games.length;
    archiveEntries.push(createJsonEntry("data/games.json", games, fileChecksums));
    report("metadata", `${games.length} jogo(s) adicionados ao pacote`);
  }

  if (categories.includes("platforms")) {
    const platforms = dao.listPlatforms();
    const aliases = dao.listPlatformAliases();
    const romExtensions = dao.listRomExtensions();
    const emulators = dao.listEmulators();
    const platformEmulators = dao.listPlatformEmulators();

    counts.platforms = platforms.length;
    counts.emulators = emulators.length;
    archiveEntries.push(createJsonEntry("data/platforms.json", platforms, fileChecksums));
    archiveEntries.push(createJsonEntry("data/platformMappings.json", { aliases, romExtensions }, fileChecksums));
    archiveEntries.push(createJsonEntry("data/emulators.json", { emulators, platformEmulators }, fileChecksums));
    report("platforms", `${platforms.length} plataforma(s) adicionadas ao pacote`);
  }

  if (categories.includes("images")) {
    const mediaMap = exportMedia(archiveEntries, imageFiles, mediaRefs, warnings, fileChecksums, (message) => report("images", message));
    counts.images = imageFiles.length;
    archiveEntries.push(createJsonEntry("data/mediaMap.json", mediaMap, fileChecksums));
  }

  if (categories.includes("romLocations")) {
    const romLocations = dao.listRomLocations();
    const romFolderEntries = normalizeRomFolderEntries(request.romFolderEntries ?? []);
    counts.romLocations = romLocations.length;
    counts.romFolderEntries = dao.countRomFolderEntries(romFolderEntries);
    archiveEntries.push(createJsonEntry("data/romLocations.json", { games: romLocations, romFolderEntries }, fileChecksums));
    report("rom_locations", `${romLocations.length} localizacao(oes) de ROM adicionadas ao pacote`);
  }

  const manifest: DataPortabilityManifest = {
    schemaVersion: SCHEMA_VERSION,
    appVersion: request.appVersion,
    createdAt: new Date().toISOString(),
    categories,
    counts,
    fileChecksums
  };
  archiveEntries.push(createJsonEntry("manifest.json", manifest));
  report("writing", "Gravando manifesto");

  const filePath = ensureBackupExtension(request.targetPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  writeZipArchive(filePath, archiveEntries);
  onProgress?.({ current: total, total, stage: "done", message: "Exportacao concluida" });

  return {
    canceled: false,
    filePath,
    manifest,
    warnings
  };
}

export function previewImportPackage(packagePath: string): DataPortabilityImportPreview {
  const loaded = loadBackup(packagePath);
  const dao = new DataPortabilityDao(getDatabase());
  const validation = validateBackupData(loaded);

  return {
    packagePath,
    manifest: loaded.manifest,
    availableCategories: loaded.manifest.categories,
    counts: loaded.manifest.counts,
    warnings: validation.warnings,
    errors: validation.errors,
    conflicts: {
      games: dao.countGameConflicts(loaded.data.games),
      platforms: dao.countPlatformConflicts(loaded.data.platforms),
      emulators: dao.countEmulatorConflicts(loaded.data.emulators)
    }
  };
}

export function importDataPackage(request: DataPortabilityImportRequest, onProgress?: ProgressCallback): DataPortabilityImportResult {
  const categories = normalizeCategories(request.categories);
  onProgress?.({ current: 0, total: Math.max(1, categories.length + 2), stage: "validating", message: "Validando pacote" });
  const loaded = loadBackup(request.packagePath);
  const missingCategories = categories.filter((category) => !loaded.manifest.categories.includes(category));
  if (missingCategories.length) {
    throw new Error(`Pacote nao contem categoria(s): ${missingCategories.join(", ")}`);
  }

  const validation = validateBackupData(loaded);
  if (validation.errors.length) {
    throw new Error(validation.errors.map((error) => error.message).join("; "));
  }

  const dao = new DataPortabilityDao(getDatabase());
  const copiedFiles: string[] = [];
  const summary = createEmptySummary(validation.warnings);
  const imageFileCount = categories.includes("images") ? countMediaFilesInBackup(loaded.zip) : 0;
  const total = Math.max(1, categories.length + imageFileCount + (categories.includes("images") ? loaded.data.mediaMap.length : 0) + 2);
  let current = 1;
  const report = (stage: DataPortabilityProgress["stage"], message: string): void => {
    current = Math.min(total, current + 1);
    onProgress?.({ current, total, stage, message });
  };

  try {
    getDatabase().transaction(() => {
      if (categories.includes("platforms")) {
        summary.platforms = dao.importPlatforms({
          platforms: loaded.data.platforms,
          aliases: loaded.data.aliases,
          romExtensions: loaded.data.romExtensions,
          emulators: loaded.data.emulators,
          platformEmulators: loaded.data.platformEmulators
        });
        report("platforms", `${summary.platforms.created} plataforma(s) criadas, ${summary.platforms.updated} atualizadas`);
      }

      if (categories.includes("metadata")) {
        summary.metadata = dao.importGameMetadata(loaded.data.games);
        report("metadata", `${summary.metadata.created} jogo(s) criados, ${summary.metadata.updated} atualizados`);
      }

      if (categories.includes("romLocations")) {
        summary.romLocations = dao.importRomLocations(loaded.data.romLocations);
        summary.romFolderEntries = normalizeRomFolderEntries(loaded.data.romFolderEntries);
        summary.romLocations.romFolderEntries = summary.romFolderEntries.length;
        report("rom_locations", `${summary.romLocations.updated} localizacao(oes) de ROM atualizadas`);
      }

      if (categories.includes("images")) {
        importImages(loaded, dao, copiedFiles, summary, (message) => report("images", message));
      }
    })();
  } catch (error) {
    cleanupCopiedFiles(copiedFiles);
    throw error;
  }

  onProgress?.({ current: total, total, stage: "done", message: "Importacao concluida" });
  return { success: true, summary };
}

function exportMedia(
  archiveEntries: ZipArchiveEntry[],
  files: ExportedMediaFile[],
  refs: ReturnType<DataPortabilityDao["listMediaReferences"]>,
  warnings: DataPortabilityWarning[],
  fileChecksums: Record<string, string>,
  onItem?: (message: string) => void
): PortableMediaEntry[] {
  const exportedBySource = new Map<string, ExportedMediaFile>();

  files.forEach((file) => {
    archiveEntries.push({
      kind: "file",
      entryName: file.packagePath,
      sourcePath: file.sourcePath,
      size: file.size
    });
    fileChecksums[file.packagePath] = sha256File(file.sourcePath);
    exportedBySource.set(normalizePathForLookup(file.sourcePath), file);
    onItem?.(`Imagem adicionada: ${file.relativePath}`);
  });

  const mediaMap: PortableMediaEntry[] = [];
  refs.forEach((ref) => {
    const exported = exportedBySource.get(normalizePathForLookup(ref.sourcePath));
    if (!exported) {
      warnings.push(createWarning("missing-image", `Imagem nao encontrada: ${path.basename(ref.sourcePath)}`, ref.sourcePath));
      return;
    }

    mediaMap.push({
      ...ref,
      packagePath: exported.packagePath,
      relativePath: exported.relativePath,
      originalPath: ref.sourcePath,
      size: exported.size
    });
  });

  return mediaMap;
}

function importImages(
  loaded: LoadedBackup,
  dao: DataPortabilityDao,
  copiedFiles: string[],
  summary: DataPortabilityImportSummary,
  onItem?: (message: string) => void
): void {
  const imagesDir = getImagesDir();
  restoreImagesTree(loaded, imagesDir, copiedFiles, onItem);

  for (const entry of loaded.data.mediaMap) {
    const gameId = dao.findGameId(entry);
    if (!gameId) {
      summary.images.skipped += 1;
      onItem?.(`Imagem ignorada: ${entry.title}`);
      continue;
    }

    const zipEntry = loaded.zip.getEntry(entry.packagePath);
    if (!zipEntry) {
      summary.images.missing += 1;
      summary.warnings.push(createWarning("missing-media-entry", `Midia ausente no pacote: ${entry.packagePath}`));
      onItem?.(`Midia ausente: ${entry.packagePath}`);
      continue;
    }

    const targetPath = resolveImportedMediaPath(imagesDir, entry);
    dao.updateGameMedia(gameId, entry.field, targetPath);
    summary.images.imported += 1;
    onItem?.(`Imagem importada: ${entry.title}`);
  }
}

function loadBackup(packagePath: string): LoadedBackup {
  if (!packagePath?.trim()) throw new Error("Informe o caminho do pacote");
  if (!fs.existsSync(packagePath)) throw new Error("Pacote nao encontrado");

  let zip: AdmZip;
  try {
    zip = new AdmZip(packagePath);
  } catch {
    throw new Error("Pacote invalido ou corrompido");
  }

  const manifest = readRequiredJson<DataPortabilityManifest>(zip, "manifest.json");
  if (manifest.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Versao de backup nao suportada: ${manifest.schemaVersion}`);
  }
  manifest.categories = normalizeCategories(manifest.categories);

  const platformMappings = readOptionalJson<{ aliases?: PortablePlatformAlias[]; romExtensions?: PortableRomExtension[] }>(zip, "data/platformMappings.json", {});
  const emulators = readOptionalJson<{ emulators?: PortableEmulator[]; platformEmulators?: PortablePlatformEmulator[] }>(zip, "data/emulators.json", {});
  const romLocations = readOptionalJson<{ games?: PortableRomLocation[]; romFolderEntries?: DataPortabilityRomFolderEntry[] }>(zip, "data/romLocations.json", {});

  return {
    zip,
    manifest,
    data: {
      games: readOptionalJson<PortableGameMetadata[]>(zip, "data/games.json", []),
      mediaMap: readOptionalJson<PortableMediaEntry[]>(zip, "data/mediaMap.json", []),
      platforms: readOptionalJson<PortablePlatform[]>(zip, "data/platforms.json", []),
      aliases: platformMappings.aliases ?? [],
      romExtensions: platformMappings.romExtensions ?? [],
      emulators: emulators.emulators ?? [],
      platformEmulators: emulators.platformEmulators ?? [],
      romLocations: romLocations.games ?? [],
      romFolderEntries: normalizeRomFolderEntries(romLocations.romFolderEntries ?? [])
    }
  };
}

function validateBackupData(loaded: LoadedBackup): { warnings: DataPortabilityWarning[]; errors: DataPortabilityWarning[] } {
  const warnings: DataPortabilityWarning[] = [];
  const errors: DataPortabilityWarning[] = [];

  if (loaded.manifest.categories.includes("metadata") && !loaded.zip.getEntry("data/games.json")) {
    errors.push(createError("missing-games-data", "Pacote sem data/games.json"));
  }
  if (loaded.manifest.categories.includes("platforms")) {
    if (!loaded.zip.getEntry("data/platforms.json")) errors.push(createError("missing-platforms-data", "Pacote sem data/platforms.json"));
    if (!loaded.zip.getEntry("data/platformMappings.json")) warnings.push(createWarning("missing-platform-mappings", "Pacote sem mapeamentos de plataformas"));
    if (!loaded.zip.getEntry("data/emulators.json")) warnings.push(createWarning("missing-emulators", "Pacote sem dados de emuladores"));
  }
  if (loaded.manifest.categories.includes("images")) {
    if (!loaded.zip.getEntry("data/mediaMap.json")) errors.push(createError("missing-media-map", "Pacote sem data/mediaMap.json"));
    for (const media of loaded.data.mediaMap) {
      if (!loaded.zip.getEntry(media.packagePath)) {
        errors.push(createError("missing-media-entry", `Midia ausente no pacote: ${media.packagePath}`));
      }
    }
  }
  if (loaded.manifest.categories.includes("romLocations")) {
    if (!loaded.zip.getEntry("data/romLocations.json")) errors.push(createError("missing-rom-locations-data", "Pacote sem data/romLocations.json"));
    for (const rom of loaded.data.romLocations) {
      if (rom.rom_path && !fs.existsSync(rom.rom_path)) {
        warnings.push(createWarning("missing-rom-path", `ROM nao encontrada no disco atual: ${path.basename(rom.rom_path)}`, rom.rom_path));
      }
    }
    for (const entry of loaded.data.romFolderEntries) {
      if (entry.folderPath && !fs.existsSync(entry.folderPath)) {
        warnings.push(createWarning("missing-rom-folder", `Pasta de ROMs nao encontrada: ${entry.folderPath}`));
      }
    }
  }

  return { warnings, errors };
}

function createJsonEntry(entryPath: string, data: unknown, fileChecksums?: Record<string, string>): ZipBufferEntry {
  const buffer = Buffer.from(`${JSON.stringify(data, null, 2)}\n`, "utf8");
  if (fileChecksums) fileChecksums[entryPath] = sha256(buffer);
  return {
    kind: "buffer",
    entryName: entryPath,
    buffer
  };
}

function addJson(zip: AdmZip, entryPath: string, data: unknown, fileChecksums?: Record<string, string>): void {
  const entry = createJsonEntry(entryPath, data, fileChecksums);
  zip.addFile(entry.entryName, entry.buffer);
}

function readRequiredJson<T>(zip: AdmZip, entryPath: string): T {
  const entry = zip.getEntry(entryPath);
  if (!entry) throw new Error(`Pacote invalido: ${entryPath} ausente`);
  return JSON.parse(entry.getData().toString("utf8")) as T;
}

function readOptionalJson<T>(zip: AdmZip, entryPath: string, fallback: T): T {
  const entry = zip.getEntry(entryPath);
  if (!entry) return fallback;
  return JSON.parse(entry.getData().toString("utf8")) as T;
}

function normalizeCategories(categories: DataPortabilityCategory[]): DataPortabilityCategory[] {
  const allowed = new Set(DATA_PORTABILITY_CATEGORIES);
  const normalized = Array.from(new Set((categories ?? []).filter((category) => allowed.has(category))));
  if (!normalized.length) throw new Error("Selecione ao menos uma categoria");
  return normalized;
}

function normalizeRomFolderEntries(entries: DataPortabilityRomFolderEntry[]): DataPortabilityRomFolderEntry[] {
  return (entries ?? [])
    .filter((entry) => entry?.folderPath?.trim() && entry.platformId)
    .map((entry) => ({
      folderPath: entry.folderPath,
      platformId: Number(entry.platformId),
      platformName: entry.platformName || "Plataforma",
      indexedCount: Number(entry.indexedCount) || 0
    }));
}

function createEmptySummary(warnings: DataPortabilityWarning[]): DataPortabilityImportSummary {
  return {
    metadata: { created: 0, updated: 0, skipped: 0 },
    platforms: { created: 0, updated: 0, mappings: 0, emulators: 0, links: 0 },
    images: { imported: 0, skipped: 0, missing: 0 },
    romLocations: { updated: 0, skipped: 0, romFolderEntries: 0 },
    warnings: [...warnings],
    romFolderEntries: []
  };
}

function ensureBackupExtension(filePath: string): string {
  const trimmed = filePath.trim();
  return trimmed.toLowerCase().endsWith(BACKUP_EXTENSION) ? trimmed : `${trimmed}${BACKUP_EXTENSION}`;
}

function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sha256File(filePath: string): string {
  const hash = crypto.createHash("sha256");
  const fd = fs.openSync(filePath, "r");
  const chunk = Buffer.allocUnsafe(1024 * 1024);

  try {
    while (true) {
      const bytesRead = fs.readSync(fd, chunk, 0, chunk.length, null);
      if (bytesRead === 0) break;
      hash.update(bytesRead === chunk.length ? chunk : chunk.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(fd);
  }

  return hash.digest("hex");
}

function createWarning(code: string, message: string, detail?: string): DataPortabilityWarning {
  return { severity: "warning", code, message, detail };
}

function createError(code: string, message: string, detail?: string): DataPortabilityWarning {
  return { severity: "error", code, message, detail };
}

function cleanupCopiedFiles(paths: string[]): void {
  for (const filePath of paths) {
    try {
      if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
    } catch {
      // Best effort cleanup after transaction failure.
    }
  }
}

function listImageFilesForBackup(imagesDir: string): ExportedMediaFile[] {
  if (!fs.existsSync(imagesDir)) return [];

  const results: ExportedMediaFile[] = [];
  const walk = (currentDir: string): void => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;

      const relativePath = toPortableRelativePath(path.relative(imagesDir, fullPath));
      if (!relativePath) continue;

      results.push({
        packagePath: `media/${relativePath}`,
        relativePath,
        sourcePath: fullPath,
        size: fs.statSync(fullPath).size
      });
    }
  };

  walk(imagesDir);
  results.sort((a, b) => a.relativePath.localeCompare(b.relativePath, undefined, { sensitivity: "base" }));
  return results;
}

function restoreImagesTree(
  loaded: LoadedBackup,
  imagesDir: string,
  copiedFiles: string[],
  onItem?: (message: string) => void
): void {
  const mediaEntries = loaded.zip.getEntries().filter((entry) => !entry.isDirectory && entry.entryName.startsWith("media/"));

  for (const zipEntry of mediaEntries) {
    const relativePath = normalizeZipRelativePath(zipEntry.entryName.slice("media/".length));
    if (!relativePath) continue;

    const targetPath = ensurePathInsideImagesDir(imagesDir, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, zipEntry.getData());
    copiedFiles.push(targetPath);
    onItem?.(`Imagem restaurada: ${relativePath}`);
  }
}

function resolveImportedMediaPath(imagesDir: string, entry: PortableMediaEntry): string {
  const relativePath = entry.relativePath
    ? normalizeZipRelativePath(entry.relativePath)
    : normalizeZipRelativePath(entry.packagePath.replace(/^media\//, ""));

  if (!relativePath) {
    throw new Error(`Caminho de midia invalido no pacote: ${entry.packagePath}`);
  }

  return ensurePathInsideImagesDir(imagesDir, relativePath);
}

function ensurePathInsideImagesDir(imagesDir: string, relativePath: string): string {
  const targetPath = path.resolve(imagesDir, relativePath);
  const normalizedImagesDir = path.resolve(imagesDir);
  const relativeToRoot = path.relative(normalizedImagesDir, targetPath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error(`Caminho de midia invalido no pacote: ${relativePath}`);
  }
  return targetPath;
}

function toPortableRelativePath(relativePath: string): string | null {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return normalizeZipRelativePath(normalized);
}

function normalizeZipRelativePath(relativePath: string): string | null {
  const normalized = path.posix.normalize((relativePath || "").replace(/\\/g, "/")).replace(/^\/+/, "");
  if (!normalized || normalized === "." || normalized.startsWith("../")) return null;
  return normalized;
}

function normalizePathForLookup(value: string): string {
  return path.resolve(value).toLowerCase();
}

function countMediaFilesInBackup(zip: AdmZip): number {
  return zip.getEntries().filter((entry) => !entry.isDirectory && entry.entryName.startsWith("media/")).length;
}

const CRC32_TABLE = createCrc32Table();
const DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;
const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const STORED_METHOD = 0;
const UTF8_FLAG = 0x0800;
const DATA_DESCRIPTOR_FLAG = 0x0008;
const ZIP_VERSION = 20;

function writeZipArchive(targetPath: string, entries: ZipArchiveEntry[]): void {
  const fd = fs.openSync(targetPath, "w");
  let offset = 0;
  const centralDirectory: Buffer[] = [];

  try {
    for (const entry of entries) {
      const entryName = normalizeZipEntryName(entry.entryName);
      const entryNameBuffer = Buffer.from(entryName, "utf8");
      const mtime = entry.mtime ?? new Date();
      const { dosDate, dosTime } = toDosDateTime(mtime);
      const localHeaderOffset = offset;
      const usesDataDescriptor = entry.kind === "file";

      const localHeader = Buffer.alloc(30 + entryNameBuffer.length);
      let cursor = 0;
      cursor = writeUInt32LE(localHeader, LOCAL_FILE_HEADER_SIGNATURE, cursor);
      cursor = writeUInt16LE(localHeader, ZIP_VERSION, cursor);
      cursor = writeUInt16LE(localHeader, UTF8_FLAG | (usesDataDescriptor ? DATA_DESCRIPTOR_FLAG : 0), cursor);
      cursor = writeUInt16LE(localHeader, STORED_METHOD, cursor);
      cursor = writeUInt16LE(localHeader, dosTime, cursor);
      cursor = writeUInt16LE(localHeader, dosDate, cursor);
      cursor = writeUInt32LE(localHeader, usesDataDescriptor ? 0 : crc32(entry.buffer), cursor);
      cursor = writeUInt32LE(localHeader, usesDataDescriptor ? 0 : entry.buffer.length, cursor);
      cursor = writeUInt32LE(localHeader, usesDataDescriptor ? 0 : entry.buffer.length, cursor);
      cursor = writeUInt16LE(localHeader, entryNameBuffer.length, cursor);
      cursor = writeUInt16LE(localHeader, 0, cursor);
      entryNameBuffer.copy(localHeader, cursor);
      offset += fs.writeSync(fd, localHeader);

      let crc = 0;
      let size = 0;

      if (entry.kind === "buffer") {
        crc = crc32(entry.buffer);
        size = entry.buffer.length;
        offset += fs.writeSync(fd, entry.buffer);
      } else {
        const streamed = streamFileToZip(fd, entry.sourcePath);
        crc = streamed.crc;
        size = streamed.size;
        offset += streamed.written;

        const descriptor = Buffer.alloc(16);
        let descriptorCursor = 0;
        descriptorCursor = writeUInt32LE(descriptor, DATA_DESCRIPTOR_SIGNATURE, descriptorCursor);
        descriptorCursor = writeUInt32LE(descriptor, crc, descriptorCursor);
        descriptorCursor = writeUInt32LE(descriptor, size, descriptorCursor);
        writeUInt32LE(descriptor, size, descriptorCursor);
        offset += fs.writeSync(fd, descriptor);
      }

      const centralHeader = Buffer.alloc(46 + entryNameBuffer.length);
      cursor = 0;
      cursor = writeUInt32LE(centralHeader, CENTRAL_DIRECTORY_HEADER_SIGNATURE, cursor);
      cursor = writeUInt16LE(centralHeader, ZIP_VERSION, cursor);
      cursor = writeUInt16LE(centralHeader, ZIP_VERSION, cursor);
      cursor = writeUInt16LE(centralHeader, UTF8_FLAG | (usesDataDescriptor ? DATA_DESCRIPTOR_FLAG : 0), cursor);
      cursor = writeUInt16LE(centralHeader, STORED_METHOD, cursor);
      cursor = writeUInt16LE(centralHeader, dosTime, cursor);
      cursor = writeUInt16LE(centralHeader, dosDate, cursor);
      cursor = writeUInt32LE(centralHeader, crc, cursor);
      cursor = writeUInt32LE(centralHeader, size, cursor);
      cursor = writeUInt32LE(centralHeader, size, cursor);
      cursor = writeUInt16LE(centralHeader, entryNameBuffer.length, cursor);
      cursor = writeUInt16LE(centralHeader, 0, cursor);
      cursor = writeUInt16LE(centralHeader, 0, cursor);
      cursor = writeUInt16LE(centralHeader, 0, cursor);
      cursor = writeUInt16LE(centralHeader, 0, cursor);
      cursor = writeUInt32LE(centralHeader, 0, cursor);
      cursor = writeUInt32LE(centralHeader, localHeaderOffset, cursor);
      entryNameBuffer.copy(centralHeader, cursor);
      centralDirectory.push(centralHeader);
    }

    const centralDirectoryOffset = offset;
    for (const header of centralDirectory) {
      offset += fs.writeSync(fd, header);
    }

    const endRecord = Buffer.alloc(22);
    let cursor = 0;
    cursor = writeUInt32LE(endRecord, END_OF_CENTRAL_DIRECTORY_SIGNATURE, cursor);
    cursor = writeUInt16LE(endRecord, 0, cursor);
    cursor = writeUInt16LE(endRecord, 0, cursor);
    cursor = writeUInt16LE(endRecord, centralDirectory.length, cursor);
    cursor = writeUInt16LE(endRecord, centralDirectory.length, cursor);
    cursor = writeUInt32LE(endRecord, offset - centralDirectoryOffset, cursor);
    cursor = writeUInt32LE(endRecord, centralDirectoryOffset, cursor);
    writeUInt16LE(endRecord, 0, cursor);
    fs.writeSync(fd, endRecord);
  } finally {
    fs.closeSync(fd);
  }
}

function streamFileToZip(fd: number, sourcePath: string): { crc: number; size: number; written: number } {
  const sourceFd = fs.openSync(sourcePath, "r");
  const chunk = Buffer.allocUnsafe(1024 * 1024);
  let crc = 0;
  let size = 0;
  let written = 0;

  try {
    while (true) {
      const bytesRead = fs.readSync(sourceFd, chunk, 0, chunk.length, null);
      if (bytesRead === 0) break;

      const view = bytesRead === chunk.length ? chunk : chunk.subarray(0, bytesRead);
      crc = crc32(view, crc);
      size += bytesRead;
      written += fs.writeSync(fd, view);
    }
  } finally {
    fs.closeSync(sourceFd);
  }

  return { crc, size, written };
}

function normalizeZipEntryName(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized) throw new Error("Nome de entrada ZIP invalido");
  return normalized;
}

function toDosDateTime(date: Date): { dosDate: number; dosTime: number } {
  const year = Math.min(Math.max(date.getFullYear(), 1980), 2107);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  return {
    dosDate: ((year - 1980) << 9) | (month << 5) | day,
    dosTime: (hours << 11) | (minutes << 5) | seconds
  };
}

function writeUInt16LE(buffer: Buffer, value: number, offset: number): number {
  buffer.writeUInt16LE(value & 0xffff, offset);
  return offset + 2;
}

function writeUInt32LE(buffer: Buffer, value: number, offset: number): number {
  buffer.writeUInt32LE(value >>> 0, offset);
  return offset + 4;
}

function crc32(buffer: Buffer, seed = 0): number {
  let crc = seed ^ 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC32_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }

  return table;
}
