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

export function exportDataPackage(request: ExportPackageRequest, onProgress?: ProgressCallback): DataPortabilityExportResult {
  const categories = normalizeCategories(request.categories);
  const dao = new DataPortabilityDao(getDatabase());
  const zip = new AdmZip();
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
    addJson(zip, "data/games.json", games, fileChecksums);
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
    addJson(zip, "data/platforms.json", platforms, fileChecksums);
    addJson(zip, "data/platformMappings.json", { aliases, romExtensions }, fileChecksums);
    addJson(zip, "data/emulators.json", { emulators, platformEmulators }, fileChecksums);
    report("platforms", `${platforms.length} plataforma(s) adicionadas ao pacote`);
  }

  if (categories.includes("images")) {
    const mediaMap = exportMedia(zip, imageFiles, mediaRefs, warnings, fileChecksums, (message) => report("images", message));
    counts.images = imageFiles.length;
    addJson(zip, "data/mediaMap.json", mediaMap, fileChecksums);
  }

  if (categories.includes("romLocations")) {
    const romLocations = dao.listRomLocations();
    const romFolderEntries = normalizeRomFolderEntries(request.romFolderEntries ?? []);
    counts.romLocations = romLocations.length;
    counts.romFolderEntries = dao.countRomFolderEntries(romFolderEntries);
    addJson(zip, "data/romLocations.json", { games: romLocations, romFolderEntries }, fileChecksums);
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
  addJson(zip, "manifest.json", manifest);
  report("writing", "Gravando manifesto");

  const filePath = ensureBackupExtension(request.targetPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  zip.writeZip(filePath);
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
  zip: AdmZip,
  files: ExportedMediaFile[],
  refs: ReturnType<DataPortabilityDao["listMediaReferences"]>,
  warnings: DataPortabilityWarning[],
  fileChecksums: Record<string, string>,
  onItem?: (message: string) => void
): PortableMediaEntry[] {
  const exportedBySource = new Map<string, ExportedMediaFile>();

  files.forEach((file) => {
    const buffer = fs.readFileSync(file.sourcePath);
    zip.addFile(file.packagePath, buffer);
    fileChecksums[file.packagePath] = sha256(buffer);
    exportedBySource.set(normalizePathForLookup(file.sourcePath), { ...file, size: buffer.length });
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

function addJson(zip: AdmZip, entryPath: string, data: unknown, fileChecksums?: Record<string, string>): void {
  const buffer = Buffer.from(`${JSON.stringify(data, null, 2)}\n`, "utf8");
  zip.addFile(entryPath, buffer);
  if (fileChecksums) fileChecksums[entryPath] = sha256(buffer);
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
