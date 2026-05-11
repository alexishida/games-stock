import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
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
  zip: PortableZipArchive;
  manifest: DataPortabilityManifest;
  data: BackupData;
}

interface PortableZipEntry {
  entryName: string;
  isDirectory: boolean;
  getData(): Buffer;
}

interface PortableZipArchive {
  getEntry(entryName: string): PortableZipEntry | null;
  getEntries(): PortableZipEntry[];
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
  const counts: DataPortabilityManifest["counts"] = {};
  const mediaRefs = categories.includes("images") ? dao.listMediaReferences() : [];
  const imageFiles = categories.includes("images") ? listImageFilesForBackup(getImagesDir()) : [];
  const reportedCategoryCount = categories.filter((category) => category !== "images").length;
  const total = Math.max(1, reportedCategoryCount + imageFiles.length + 2);
  let current = 0;
  const report = (stage: DataPortabilityProgress["stage"], message: string): void => {
    current = Math.min(total, current + 1);
    onProgress?.({ current, total, stage, message });
  };

  onProgress?.({ current: 0, total, stage: "preparing", message: "Preparando exportacao" });

  if (categories.includes("metadata")) {
    const games = dao.listGameMetadata();
    counts.games = games.length;
    archiveEntries.push(createJsonEntry("data/games.json", games));
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
    archiveEntries.push(createJsonEntry("data/platforms.json", platforms));
    archiveEntries.push(createJsonEntry("data/platformMappings.json", { aliases, romExtensions }));
    archiveEntries.push(createJsonEntry("data/emulators.json", { emulators, platformEmulators }));
    report("platforms", `${platforms.length} plataforma(s) adicionadas ao pacote`);
  }

  if (categories.includes("images")) {
    const mediaMap = exportMedia(archiveEntries, imageFiles, mediaRefs, warnings, (message) => report("images", message));
    counts.images = imageFiles.length;
    archiveEntries.push(createJsonEntry("data/mediaMap.json", mediaMap));
  }

  if (categories.includes("romLocations")) {
    const romLocations = dao.listRomLocations();
    const romFolderEntries = normalizeRomFolderEntries(request.romFolderEntries ?? []);
    counts.romLocations = romLocations.length;
    counts.romFolderEntries = dao.countRomFolderEntries(romFolderEntries);
    archiveEntries.push(createJsonEntry("data/romLocations.json", { games: romLocations, romFolderEntries }));
    report("rom_locations", `${romLocations.length} localizacao(oes) de ROM adicionadas ao pacote`);
  }

  const manifest: DataPortabilityManifest = {
    schemaVersion: SCHEMA_VERSION,
    appVersion: request.appVersion,
    createdAt: new Date().toISOString(),
    categories,
    counts
  };
  archiveEntries.push(createJsonEntry("manifest.json", manifest));
  report("writing", "Gravando pacote");

  const filePath = ensureBackupExtension(request.targetPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  writeZipArchive(filePath, archiveEntries);
  report("validating", "Validando pacote");
  loadBackup(filePath);
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
  const availableCategories = detectAvailableCategories(loaded);

  return {
    packagePath,
    manifest: loaded.manifest,
    availableCategories,
    counts: buildPreviewCounts(loaded, availableCategories),
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
  const availableCategories = detectAvailableCategories(loaded);
  const missingCategories = categories.filter((category) => !availableCategories.includes(category));
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

  let zip: PortableZipArchive;
  try {
    zip = readZipArchive(packagePath);
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
  const detectedCategories = detectAvailableCategories(loaded);

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

  for (const category of detectedCategories) {
    if (!loaded.manifest.categories.includes(category)) {
      warnings.push(
        createWarning(
          "manifest-category-missing",
          `Pacote contem dados de ${categoryLabel(category)}, mas categoria nao foi registrada no manifesto.`
        )
      );
    }
  }

  for (const category of loaded.manifest.categories) {
    if (!detectedCategories.includes(category)) {
      warnings.push(
        createWarning(
          "manifest-category-without-data",
          `Manifesto lista ${categoryLabel(category)}, mas dados da categoria nao foram encontrados no pacote.`
        )
      );
    }
  }

  return { warnings, errors };
}

function createJsonEntry(entryPath: string, data: unknown): ZipBufferEntry {
  const buffer = Buffer.from(`${JSON.stringify(data, null, 2)}\n`, "utf8");
  return {
    kind: "buffer",
    entryName: entryPath,
    buffer
  };
}

function readRequiredJson<T>(zip: PortableZipArchive, entryPath: string): T {
  const entry = zip.getEntry(entryPath);
  if (!entry) throw new Error(`Pacote invalido: ${entryPath} ausente`);
  return JSON.parse(entry.getData().toString("utf8")) as T;
}

function readOptionalJson<T>(zip: PortableZipArchive, entryPath: string, fallback: T): T {
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

function detectAvailableCategories(loaded: LoadedBackup): DataPortabilityCategory[] {
  const hasMetadata = Boolean(loaded.zip.getEntry("data/games.json"));
  const hasImages = Boolean(loaded.zip.getEntry("data/mediaMap.json")) || countMediaFilesInBackup(loaded.zip) > 0;
  const hasPlatforms =
    Boolean(loaded.zip.getEntry("data/platforms.json")) ||
    Boolean(loaded.zip.getEntry("data/platformMappings.json")) ||
    Boolean(loaded.zip.getEntry("data/emulators.json"));
  const hasRomLocations = Boolean(loaded.zip.getEntry("data/romLocations.json"));

  return DATA_PORTABILITY_CATEGORIES.filter((category) => {
    switch (category) {
      case "metadata":
        return hasMetadata;
      case "images":
        return hasImages;
      case "platforms":
        return hasPlatforms;
      case "romLocations":
        return hasRomLocations;
      default:
        return false;
    }
  });
}

function buildPreviewCounts(
  loaded: LoadedBackup,
  availableCategories: DataPortabilityCategory[]
): Partial<DataPortabilityManifest["counts"]> {
  const counts: Partial<DataPortabilityManifest["counts"]> = { ...loaded.manifest.counts };

  if (availableCategories.includes("metadata")) {
    counts.games = loaded.data.games.length;
  }
  if (availableCategories.includes("platforms")) {
    counts.platforms = loaded.data.platforms.length;
    counts.emulators = loaded.data.emulators.length;
  }
  if (availableCategories.includes("images")) {
    counts.images = countMediaFilesInBackup(loaded.zip);
  }
  if (availableCategories.includes("romLocations")) {
    counts.romLocations = loaded.data.romLocations.length;
    counts.romFolderEntries = loaded.data.romFolderEntries.length;
  }

  return counts;
}

function categoryLabel(category: DataPortabilityCategory): string {
  switch (category) {
    case "metadata":
      return "metadados";
    case "images":
      return "imagens";
    case "platforms":
      return "plataformas";
    case "romLocations":
      return "localizacoes de ROMs";
    default:
      return category;
  }
}

function normalizeRomFolderEntries(entries: DataPortabilityRomFolderEntry[]): DataPortabilityRomFolderEntry[] {
  return (entries ?? [])
    .filter((entry) => entry?.folderPath?.trim() && entry.platformId)
    .map((entry) => ({
      folderPath: entry.folderPath,
      platformId: Number(entry.platformId),
      platformName: entry.platformName || "Plataforma",
      indexedCount: Number(entry.indexedCount) || 0,
      includeSubfolders: Boolean(entry.includeSubfolders)
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

function countMediaFilesInBackup(zip: PortableZipArchive): number {
  return zip.getEntries().filter((entry) => !entry.isDirectory && entry.entryName.startsWith("media/")).length;
}

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
      const initialCrc = entry.kind === "buffer" ? crc32(entry.buffer) : 0;
      let crc = initialCrc;
      const size = entry.kind === "buffer" ? entry.buffer.length : entry.size;
      const sizeRequiresZip64 = size >= ZIP32_MAX;
      const localExtra = sizeRequiresZip64 ? createZip64Extra([BigInt(size), BigInt(size)]) : Buffer.alloc(0);
      const versionNeeded = sizeRequiresZip64 ? ZIP64_VERSION : ZIP_VERSION;

      const localHeader = Buffer.alloc(30 + entryNameBuffer.length + localExtra.length);
      let cursor = 0;
      cursor = writeUInt32LE(localHeader, LOCAL_FILE_HEADER_SIGNATURE, cursor);
      cursor = writeUInt16LE(localHeader, versionNeeded, cursor);
      cursor = writeUInt16LE(localHeader, UTF8_FLAG, cursor);
      cursor = writeUInt16LE(localHeader, STORED_METHOD, cursor);
      cursor = writeUInt16LE(localHeader, dosTime, cursor);
      cursor = writeUInt16LE(localHeader, dosDate, cursor);
      cursor = writeUInt32LE(localHeader, initialCrc, cursor);
      cursor = writeUInt32LE(localHeader, sizeRequiresZip64 ? ZIP32_MAX : size, cursor);
      cursor = writeUInt32LE(localHeader, sizeRequiresZip64 ? ZIP32_MAX : size, cursor);
      cursor = writeUInt16LE(localHeader, entryNameBuffer.length, cursor);
      cursor = writeUInt16LE(localHeader, localExtra.length, cursor);
      entryNameBuffer.copy(localHeader, cursor);
      localExtra.copy(localHeader, cursor + entryNameBuffer.length);
      offset += writeBufferFully(fd, localHeader);

      if (entry.kind === "buffer") {
        offset += writeBufferFully(fd, entry.buffer);
      } else {
        const streamed = streamFileToZip(fd, entry.sourcePath);
        if (streamed.size !== size) {
          throw new Error(`Arquivo alterado durante backup: ${entry.sourcePath}`);
        }
        crc = streamed.crc;
        offset += streamed.written;
        writeUInt32At(fd, crc, localHeaderOffset + ZIP_LOCAL_HEADER_CRC_OFFSET);
      }

      const offsetRequiresZip64 = localHeaderOffset >= ZIP32_MAX;
      const centralZip64Values: bigint[] = [];
      if (sizeRequiresZip64) centralZip64Values.push(BigInt(size), BigInt(size));
      if (offsetRequiresZip64) centralZip64Values.push(BigInt(localHeaderOffset));
      const centralExtra = centralZip64Values.length ? createZip64Extra(centralZip64Values) : Buffer.alloc(0);
      const centralVersionNeeded = centralExtra.length ? ZIP64_VERSION : ZIP_VERSION;

      const centralHeader = Buffer.alloc(46 + entryNameBuffer.length + centralExtra.length);
      cursor = 0;
      cursor = writeUInt32LE(centralHeader, CENTRAL_DIRECTORY_HEADER_SIGNATURE, cursor);
      cursor = writeUInt16LE(centralHeader, centralVersionNeeded, cursor);
      cursor = writeUInt16LE(centralHeader, centralVersionNeeded, cursor);
      cursor = writeUInt16LE(centralHeader, UTF8_FLAG, cursor);
      cursor = writeUInt16LE(centralHeader, STORED_METHOD, cursor);
      cursor = writeUInt16LE(centralHeader, dosTime, cursor);
      cursor = writeUInt16LE(centralHeader, dosDate, cursor);
      cursor = writeUInt32LE(centralHeader, crc, cursor);
      cursor = writeUInt32LE(centralHeader, sizeRequiresZip64 ? ZIP32_MAX : size, cursor);
      cursor = writeUInt32LE(centralHeader, sizeRequiresZip64 ? ZIP32_MAX : size, cursor);
      cursor = writeUInt16LE(centralHeader, entryNameBuffer.length, cursor);
      cursor = writeUInt16LE(centralHeader, centralExtra.length, cursor);
      cursor = writeUInt16LE(centralHeader, 0, cursor);
      cursor = writeUInt16LE(centralHeader, 0, cursor);
      cursor = writeUInt16LE(centralHeader, 0, cursor);
      cursor = writeUInt32LE(centralHeader, 0, cursor);
      cursor = writeUInt32LE(centralHeader, offsetRequiresZip64 ? ZIP32_MAX : localHeaderOffset, cursor);
      entryNameBuffer.copy(centralHeader, cursor);
      centralExtra.copy(centralHeader, cursor + entryNameBuffer.length);
      centralDirectory.push(centralHeader);
    }

    const centralDirectoryOffset = offset;
    for (const header of centralDirectory) {
      offset += writeBufferFully(fd, header);
    }
    const centralDirectorySize = offset - centralDirectoryOffset;
    const entryCount = centralDirectory.length;
    const needsZip64End =
      entryCount >= ZIP16_MAX ||
      centralDirectorySize >= ZIP32_MAX ||
      centralDirectoryOffset >= ZIP32_MAX;

    if (needsZip64End) {
      const zip64EndOffset = offset;
      const zip64End = Buffer.alloc(ZIP64_EOCD_SIZE);
      let zipCursor = 0;
      zipCursor = writeUInt32LE(zip64End, ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE, zipCursor);
      zipCursor = writeUInt64LE(zip64End, BigInt(ZIP64_EOCD_SIZE - 12), zipCursor);
      zipCursor = writeUInt16LE(zip64End, ZIP64_VERSION, zipCursor);
      zipCursor = writeUInt16LE(zip64End, ZIP64_VERSION, zipCursor);
      zipCursor = writeUInt32LE(zip64End, 0, zipCursor);
      zipCursor = writeUInt32LE(zip64End, 0, zipCursor);
      zipCursor = writeUInt64LE(zip64End, BigInt(entryCount), zipCursor);
      zipCursor = writeUInt64LE(zip64End, BigInt(entryCount), zipCursor);
      zipCursor = writeUInt64LE(zip64End, BigInt(centralDirectorySize), zipCursor);
      writeUInt64LE(zip64End, BigInt(centralDirectoryOffset), zipCursor);
      offset += writeBufferFully(fd, zip64End);

      const zip64Locator = Buffer.alloc(ZIP64_LOCATOR_SIZE);
      zipCursor = 0;
      zipCursor = writeUInt32LE(zip64Locator, ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE, zipCursor);
      zipCursor = writeUInt32LE(zip64Locator, 0, zipCursor);
      zipCursor = writeUInt64LE(zip64Locator, BigInt(zip64EndOffset), zipCursor);
      writeUInt32LE(zip64Locator, 1, zipCursor);
      offset += writeBufferFully(fd, zip64Locator);
    }

    const endRecord = Buffer.alloc(22);
    let cursor = 0;
    cursor = writeUInt32LE(endRecord, END_OF_CENTRAL_DIRECTORY_SIGNATURE, cursor);
    cursor = writeUInt16LE(endRecord, 0, cursor);
    cursor = writeUInt16LE(endRecord, 0, cursor);
    cursor = writeUInt16LE(endRecord, needsZip64End ? ZIP16_MAX : entryCount, cursor);
    cursor = writeUInt16LE(endRecord, needsZip64End ? ZIP16_MAX : entryCount, cursor);
    cursor = writeUInt32LE(endRecord, needsZip64End ? ZIP32_MAX : centralDirectorySize, cursor);
    cursor = writeUInt32LE(endRecord, needsZip64End ? ZIP32_MAX : centralDirectoryOffset, cursor);
    writeUInt16LE(endRecord, 0, cursor);
    writeBufferFully(fd, endRecord);
    fs.fsyncSync(fd);
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
      written += writeBufferFully(fd, view);
    }
  } finally {
    fs.closeSync(sourceFd);
  }

  return { crc, size, written };
}

function writeBufferFully(fd: number, buffer: Buffer): number {
  let offset = 0;

  while (offset < buffer.length) {
    offset += fs.writeSync(fd, buffer, offset, buffer.length - offset);
  }

  return buffer.length;
}

function writeUInt32At(fd: number, value: number, position: number): void {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  fs.writeSync(fd, buffer, 0, buffer.length, position);
}

function readZipArchive(filePath: string): PortableZipArchive {
  const stats = fs.statSync(filePath);
  if (!stats.isFile()) throw new Error("Pacote invalido");

  const endRecord = readEndOfCentralDirectory(filePath, stats.size);
  const centralDirectory = readFileSlice(filePath, endRecord.centralDirectoryOffset, endRecord.centralDirectorySize);
  const entries: FileBackedZipEntry[] = [];
  let cursor = 0;

  for (let index = 0; index < endRecord.entryCount; index += 1) {
    if (centralDirectory.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_HEADER_SIGNATURE) {
      throw new Error("Diretorio central ZIP invalido");
    }

    const flags = centralDirectory.readUInt16LE(cursor + 8);
    const method = centralDirectory.readUInt16LE(cursor + 10);
    const crc = centralDirectory.readUInt32LE(cursor + 16);
    let compressedSize = centralDirectory.readUInt32LE(cursor + 20);
    let size = centralDirectory.readUInt32LE(cursor + 24);
    const nameLength = centralDirectory.readUInt16LE(cursor + 28);
    const extraLength = centralDirectory.readUInt16LE(cursor + 30);
    const commentLength = centralDirectory.readUInt16LE(cursor + 32);
    let localHeaderOffset = centralDirectory.readUInt32LE(cursor + 42);
    const nameStart = cursor + CENTRAL_DIRECTORY_FIXED_SIZE;
    const extraStart = nameStart + nameLength;
    const commentStart = extraStart + extraLength;
    const nameBuffer = centralDirectory.subarray(nameStart, extraStart);
    const extra = centralDirectory.subarray(extraStart, commentStart);

    ({ size, compressedSize, localHeaderOffset } = readZip64Extra(extra, { size, compressedSize, localHeaderOffset }));

    const entryName = nameBuffer.toString((flags & UTF8_FLAG) === UTF8_FLAG ? "utf8" : "utf8");
    entries.push(new FileBackedZipEntry(filePath, {
      entryName,
      isDirectory: entryName.endsWith("/"),
      method,
      crc,
      compressedSize,
      size,
      localHeaderOffset
    }));

    cursor = commentStart + commentLength;
  }

  return new FileBackedZipArchive(entries);
}

function readEndOfCentralDirectory(filePath: string, fileSize: number): { entryCount: number; centralDirectorySize: number; centralDirectoryOffset: number } {
  const tailSize = Math.min(fileSize, ZIP_EOCD_SIZE + ZIP_MAX_COMMENT_LENGTH + ZIP64_LOCATOR_SIZE + ZIP64_EOCD_SIZE);
  const tailStart = fileSize - tailSize;
  const tail = readFileSlice(filePath, tailStart, tailSize);
  let endOffset = -1;

  for (let index = tail.length - ZIP_EOCD_SIZE; index >= 0; index -= 1) {
    if (tail.readUInt32LE(index) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) continue;
    const commentLength = tail.readUInt16LE(index + 20);
    if (index + ZIP_EOCD_SIZE + commentLength !== tail.length) continue;
    endOffset = tailStart + index;
    break;
  }

  if (endOffset < 0) throw new Error("Fim do ZIP nao encontrado");

  const endRecord = readFileSlice(filePath, endOffset, ZIP_EOCD_SIZE);
  let entryCount = endRecord.readUInt16LE(10);
  let centralDirectorySize = endRecord.readUInt32LE(12);
  let centralDirectoryOffset = endRecord.readUInt32LE(16);
  const needsZip64 =
    entryCount === ZIP16_MAX ||
    centralDirectorySize === ZIP32_MAX ||
    centralDirectoryOffset === ZIP32_MAX;

  if (!needsZip64) {
    return { entryCount, centralDirectorySize, centralDirectoryOffset };
  }

  const locatorOffset = endOffset - ZIP64_LOCATOR_SIZE;
  if (locatorOffset < 0) throw new Error("Localizador ZIP64 ausente");
  const locator = readFileSlice(filePath, locatorOffset, ZIP64_LOCATOR_SIZE);
  if (locator.readUInt32LE(0) !== ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE) {
    throw new Error("Localizador ZIP64 invalido");
  }

  const zip64EndOffset = readUInt64LEAsNumber(locator, 8);
  const zip64End = readFileSlice(filePath, zip64EndOffset, ZIP64_EOCD_SIZE);
  if (zip64End.readUInt32LE(0) !== ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
    throw new Error("Fim ZIP64 invalido");
  }

  entryCount = readUInt64LEAsNumber(zip64End, 32);
  centralDirectorySize = readUInt64LEAsNumber(zip64End, 40);
  centralDirectoryOffset = readUInt64LEAsNumber(zip64End, 48);
  return { entryCount, centralDirectorySize, centralDirectoryOffset };
}

function readZip64Extra(
  extra: Buffer,
  values: { size: number; compressedSize: number; localHeaderOffset: number }
): { size: number; compressedSize: number; localHeaderOffset: number } {
  let cursor = 0;
  while (cursor + 4 <= extra.length) {
    const headerId = extra.readUInt16LE(cursor);
    const dataSize = extra.readUInt16LE(cursor + 2);
    const dataStart = cursor + 4;
    const dataEnd = dataStart + dataSize;
    if (dataEnd > extra.length) break;

    if (headerId === ZIP64_EXTRA_FIELD_ID) {
      let zip64Cursor = dataStart;
      if (values.size === ZIP32_MAX) {
        values.size = readUInt64LEAsNumber(extra, zip64Cursor);
        zip64Cursor += 8;
      }
      if (values.compressedSize === ZIP32_MAX) {
        values.compressedSize = readUInt64LEAsNumber(extra, zip64Cursor);
        zip64Cursor += 8;
      }
      if (values.localHeaderOffset === ZIP32_MAX) {
        values.localHeaderOffset = readUInt64LEAsNumber(extra, zip64Cursor);
      }
      return values;
    }

    cursor = dataEnd;
  }

  return values;
}

function readFileSlice(filePath: string, position: number, length: number): Buffer {
  if (length < 0 || position < 0) throw new Error("Intervalo ZIP invalido");
  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(filePath, "r");
  let offset = 0;

  try {
    while (offset < length) {
      const bytesRead = fs.readSync(fd, buffer, offset, length - offset, position + offset);
      if (bytesRead === 0) throw new Error("Pacote ZIP incompleto");
      offset += bytesRead;
    }
  } finally {
    fs.closeSync(fd);
  }

  return buffer;
}

function readLocalDataOffset(filePath: string, localHeaderOffset: number): number {
  const localHeader = readFileSlice(filePath, localHeaderOffset, LOCAL_FILE_HEADER_FIXED_SIZE);
  if (localHeader.readUInt32LE(0) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error("Cabecalho local ZIP invalido");
  }

  const nameLength = localHeader.readUInt16LE(26);
  const extraLength = localHeader.readUInt16LE(28);
  return localHeaderOffset + LOCAL_FILE_HEADER_FIXED_SIZE + nameLength + extraLength;
}

class FileBackedZipArchive implements PortableZipArchive {
  private readonly entriesByName = new Map<string, FileBackedZipEntry>();

  constructor(private readonly entries: FileBackedZipEntry[]) {
    for (const entry of entries) this.entriesByName.set(entry.entryName, entry);
  }

  getEntry(entryName: string): PortableZipEntry | null {
    return this.entriesByName.get(entryName) ?? null;
  }

  getEntries(): PortableZipEntry[] {
    return [...this.entries];
  }
}

class FileBackedZipEntry implements PortableZipEntry {
  readonly entryName: string;
  readonly isDirectory: boolean;

  constructor(
    private readonly filePath: string,
    private readonly record: {
      entryName: string;
      isDirectory: boolean;
      method: number;
      crc: number;
      compressedSize: number;
      size: number;
      localHeaderOffset: number;
    }
  ) {
    this.entryName = record.entryName;
    this.isDirectory = record.isDirectory;
  }

  getData(): Buffer {
    if (this.isDirectory) return Buffer.alloc(0);

    const dataOffset = readLocalDataOffset(this.filePath, this.record.localHeaderOffset);
    const compressedData = readFileSlice(this.filePath, dataOffset, this.record.compressedSize);
    const data = this.record.method === STORED_METHOD
      ? compressedData
      : this.record.method === DEFLATED_METHOD
        ? zlib.inflateRawSync(compressedData)
        : null;

    if (!data) throw new Error(`Metodo ZIP nao suportado: ${this.record.method}`);
    if (data.length !== this.record.size) throw new Error(`Tamanho ZIP invalido: ${this.entryName}`);
    if (crc32(data) !== this.record.crc) throw new Error(`CRC ZIP invalido: ${this.entryName}`);
    return data;
  }
}

function createZip64Extra(values: bigint[]): Buffer {
  const extra = Buffer.alloc(4 + values.length * 8);
  let cursor = 0;
  cursor = writeUInt16LE(extra, ZIP64_EXTRA_FIELD_ID, cursor);
  cursor = writeUInt16LE(extra, values.length * 8, cursor);
  for (const value of values) cursor = writeUInt64LE(extra, value, cursor);
  return extra;
}

const CRC32_TABLE = createCrc32Table();
const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06064b50;
const ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE = 0x07064b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const STORED_METHOD = 0;
const DEFLATED_METHOD = 8;
const UTF8_FLAG = 0x0800;
const ZIP_VERSION = 20;
const ZIP64_VERSION = 45;
const ZIP16_MAX = 0xffff;
const ZIP32_MAX = 0xffffffff;
const ZIP64_EXTRA_FIELD_ID = 0x0001;
const CENTRAL_DIRECTORY_FIXED_SIZE = 46;
const LOCAL_FILE_HEADER_FIXED_SIZE = 30;
const ZIP_LOCAL_HEADER_CRC_OFFSET = 14;
const ZIP_EOCD_SIZE = 22;
const ZIP64_EOCD_SIZE = 56;
const ZIP64_LOCATOR_SIZE = 20;
const ZIP_MAX_COMMENT_LENGTH = 0xffff;

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

function writeUInt64LE(buffer: Buffer, value: bigint, offset: number): number {
  buffer.writeBigUInt64LE(value, offset);
  return offset + 8;
}

function readUInt64LEAsNumber(buffer: Buffer, offset: number): number {
  const value = buffer.readBigUInt64LE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Valor ZIP64 grande demais");
  }
  return Number(value);
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
