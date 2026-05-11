import fs from "node:fs";
import path from "node:path";
import { getImagesDir } from "./db/database";
import { ALL_SUPPORTED_ROM_EXTENSIONS } from "./db/platformCatalog";
import { createGame, upsertLaunchBoxGame } from "./db/repositories/games";
import { getLaunchBoxAliasesForPlatformId, getPrimaryRomExtensionsForPlatform, listPlatforms } from "./db/repositories/platforms";
import { buildIndex, ensureMetadata } from "./lib/launchbox/db";
import { downloadImages } from "./lib/launchbox/scraper";
import {
  GameCreateInput,
  LaunchBoxGame,
  LaunchBoxImageType,
  RomFolderImportCandidate,
  RomFolderImportProgress,
  RomFolderImportRequest,
  RomFolderImportResult,
  RomFolderIgnoredItem,
  RomFolderMatchedCandidate,
  RomFolderScanRequest,
  RomFolderScanResult
} from "../shared/types";

type ProgressCallback = (progress: RomFolderImportProgress) => void;

interface MatchEntry {
  game: LaunchBoxGame;
  normalizedName: string;
  matchKeys: string[];
}

interface MatchContext {
  platformMatches: MatchEntry[];
  exactByName: Map<string, MatchEntry[]>;
}

export const SUPPORTED_ROM_EXTENSIONS = ALL_SUPPORTED_ROM_EXTENSIONS;

const DEFAULT_MEDIA_TYPES: LaunchBoxImageType[] = [
  "Box - Back",
  "Box - Front",
  "Cart - Front",
  "Fanart - Background",
  "Screenshot - Gameplay"
];

export function scanRomFolder(request: RomFolderScanRequest): RomFolderScanResult {
  const platform = requirePlatform(request.platformId);
  const allowedExtensions = getAllowedRomExtensions(platform.id);
  const folderPaths = request.folderPaths.map((folderPath) => path.resolve(folderPath));
  const romFilePaths = (request.romFilePaths ?? []).map((filePath) => path.resolve(filePath));
  const includeSubfolders = Boolean(request.includeSubfolders);
  const ignoredItems: RomFolderIgnoredItem[] = [];

  const folderCandidates = folderPaths.flatMap((folderPath) => {
    const entries = listFolderEntries(folderPath, includeSubfolders);
    return entries.flatMap((entry): RomFolderImportCandidate[] => {
      const ext = path.extname(entry.filename).toLowerCase();
      if (!allowedExtensions.has(ext)) {
        ignoredItems.push({
          folderPath: entry.folderPath,
          romPath: entry.romPath,
          filename: entry.filename,
          reason: buildUnsupportedExtensionReason(ext, platform.name)
        });
        return [];
      }

      return [{
        folderPath: entry.folderPath,
        romPath: entry.romPath,
        filename: entry.filename,
        titleCandidate: normalizeRomTitle(entry.filename),
        platformId: platform.id,
        platformName: platform.name
      }];
    });
  });

  const fileCandidates = romFilePaths.flatMap((romPath): RomFolderImportCandidate[] => {
    const ext = path.extname(romPath).toLowerCase();
    if (!allowedExtensions.has(ext)) {
      ignoredItems.push({
        folderPath: path.dirname(romPath),
        romPath,
        filename: path.basename(romPath),
        reason: buildUnsupportedExtensionReason(ext, platform.name)
      });
      return [];
    }

    return [{
      folderPath: path.dirname(romPath),
      romPath,
      filename: path.basename(romPath),
      titleCandidate: normalizeRomTitle(path.basename(romPath)),
      platformId: platform.id,
      platformName: platform.name
    }];
  });

  return {
    folderPaths,
    romFilePaths,
    platformId: platform.id,
    platformName: platform.name,
    includeSubfolders,
    candidates: [...folderCandidates, ...fileCandidates],
    ignored: ignoredItems.length,
    ignoredItems
  };
}

export async function importRomFolder(request: RomFolderImportRequest, onProgress?: ProgressCallback): Promise<RomFolderImportResult> {
  const scan = scanRomFolder(request);
  const total = scan.candidates.length;
  const items: RomFolderImportResult["items"] = [];
  const summary: RomFolderImportResult["summary"] = { created: 0, updated: 0, skipped: scan.ignored, unmatched: 0, failedDownloads: 0, processed: 0 };

  onProgress?.({ current: 0, total, stage: "preparing_metadata", message: "Preparando metadados LaunchBox" });
  await ensureMetadata(false, (progress) => {
    onProgress?.({ current: progress.current, total: progress.total, filename: progress.filename, stage: progress.status === "error" ? "error" : "preparing_metadata" });
  });
  const launchBoxIndex = await buildIndex();
  const matchContext = createMatchContext(scan.platformId, launchBoxIndex);

  for (let index = 0; index < scan.candidates.length; index += 1) {
    const candidate = scan.candidates[index];
    const current = index + 1;

    try {
      onProgress?.({ current, total, folderPath: candidate.folderPath, filename: candidate.filename, stage: "matching", message: `Buscando ${candidate.titleCandidate}` });
      const matched = matchCandidate(candidate, launchBoxIndex, matchContext);
      if (matched.status !== "matched" || !matched.match) {
        const placeholder = upsertUnmatchedGame(candidate);
        summary.unmatched += 1;
        if (placeholder.created) summary.created += 1;
        else summary.updated += 1;
        summary.processed += 1;
        items.push({ candidate, status: "unmatched", gameId: placeholder.game.id });
        onProgress?.({ current, total, folderPath: candidate.folderPath, filename: candidate.filename, stage: "skipped", message: "Sem match confiavel no LaunchBox" });
        continue;
      }

      const download = await downloadImages(matched.match, getImagesDir(), DEFAULT_MEDIA_TYPES, (progress) => {
        onProgress?.({
          current,
          total,
          folderPath: candidate.folderPath,
          filename: candidate.filename,
          imageFilename: progress.filename,
          stage: progress.status === "error" ? "error" : progress.status === "skipped" ? "skipped" : "downloading",
          message: progress.filename
        });
      });

      onProgress?.({ current, total, folderPath: candidate.folderPath, filename: candidate.filename, stage: "saving", message: matched.match.name });
      const saved = upsertMatchedGame(matched.match, candidate, download.files);
      if (saved.created) summary.created += 1;
      else summary.updated += 1;
      summary.failedDownloads += download.failed;
      summary.processed += 1;

      items.push({
        candidate,
        status: saved.created ? "created" : "updated",
        gameId: saved.game.id,
        launchboxGameId: matched.match.id,
        failedDownloads: download.failed
      });
      onProgress?.({ current, total, folderPath: candidate.folderPath, filename: candidate.filename, stage: "done", message: matched.match.name });
    } catch (error) {
      summary.processed += 1;
      items.push({ candidate, status: "failed", error: error instanceof Error ? error.message : String(error) });
      onProgress?.({ current, total, folderPath: candidate.folderPath, filename: candidate.filename, stage: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    folderPaths: scan.folderPaths,
    romFilePaths: scan.romFilePaths,
    platformId: scan.platformId,
    platformName: scan.platformName,
    includeSubfolders: scan.includeSubfolders,
    items,
    summary
  };
}

function listFolderEntries(folderPath: string, includeSubfolders: boolean): Array<{ folderPath: string; romPath: string; filename: string }> {
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  const files: Array<{ folderPath: string; romPath: string; filename: string }> = [];

  for (const entry of entries) {
    const entryPath = path.join(folderPath, entry.name);
    if (entry.isDirectory()) {
      if (includeSubfolders) files.push(...listFolderEntries(entryPath, true));
      continue;
    }
    if (!entry.isFile()) continue;
    files.push({
      folderPath,
      romPath: entryPath,
      filename: entry.name
    });
  }

  return files;
}

export function matchCandidate(candidate: RomFolderImportCandidate, index: Record<string, LaunchBoxGame>, context = createMatchContext(candidate.platformId, index)): RomFolderMatchedCandidate {
  const query = candidate.titleCandidate;
  const normalizedQuery = normalizeForMatch(query);
  const exact = context.exactByName.get(normalizedQuery) ?? [];
  if (exact.length === 1) return { ...candidate, status: "matched", match: exact[0].game, alternatives: [exact[0].game] };
  if (exact.length > 1) return { ...candidate, status: "ambiguous", match: null, alternatives: exact.map((entry) => entry.game) };

  const ranked = context.platformMatches
    .map((entry) => ({ game: entry.game, score: scoreEntry(normalizedQuery, entry) }))
    .filter((item) => item.score >= 0.72)
    .sort((a, b) => b.score - a.score || a.game.name.localeCompare(b.game.name));

  if (!ranked.length) return { ...candidate, status: "unmatched", match: null, alternatives: context.platformMatches.slice(0, 5).map((entry) => entry.game) };
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
    return { ...candidate, status: "ambiguous", match: null, alternatives: ranked.slice(0, 5).map((item) => item.game) };
  }
  return { ...candidate, status: "matched", match: ranked[0].game, alternatives: ranked.slice(0, 5).map((item) => item.game) };
}

function createMatchContext(platformId: number, index: Record<string, LaunchBoxGame>): MatchContext {
  const platformAliases = getLaunchBoxAliasesForPlatformId(platformId);
  const platformMatches = Object.values(index)
    .filter((game) => isPlatformMatch(game.platform, platformAliases))
    .map((game) => {
      const normalizedName = normalizeForMatch(game.name);
      return { game, normalizedName, matchKeys: buildMatchKeys(normalizedName) };
    });
  const exactByName = new Map<string, MatchEntry[]>();

  for (const entry of platformMatches) {
    for (const key of entry.matchKeys) {
      const existing = exactByName.get(key) ?? [];
      existing.push(entry);
      exactByName.set(key, existing);
    }
  }

  return { platformMatches, exactByName };
}

export function normalizeRomTitle(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  return withoutExt
    .replace(/[_+.]+/g, " ")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*(?:USA|Europe|Japan|World|En|Fr|De|Es|It|Rev|Beta|Proto|Demo|Hack|Unl|v\d|[0-9]{4})[^)]*\)/gi, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:rev|version|v)\s*\d+\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function upsertMatchedGame(game: LaunchBoxGame, candidate: RomFolderImportCandidate, files: string[]) {
  const data: Partial<GameCreateInput> & { title: string; platform_id: number } = {
    title: game.name,
    platform_id: candidate.platformId,
    publisher: game.publisher || null,
    year: game.release ? Number(game.release.slice(0, 4)) || null : null,
    genre: game.genres || null,
    rating: game.rating || null,
    notes: game.overview || null,
    box_art_path: findDownloadedMedia(files, "box-front"),
    background_path: findDownloadedMedia(files, "fanart-background"),
    screenshot_path: findDownloadedMedia(files, "screenshot-gameplay"),
    launchbox_id: game.id,
    rom_path: candidate.romPath,
    favorite: false,
    play_status: "unplayed"
  };
  return upsertLaunchBoxGame(data);
}

function upsertUnmatchedGame(candidate: RomFolderImportCandidate) {
  const data: Partial<GameCreateInput> & { title: string; platform_id: number } = {
    title: candidate.titleCandidate,
    platform_id: candidate.platformId,
    publisher: null,
    year: null,
    genre: null,
    rating: null,
    notes: null,
    box_art_path: null,
    background_path: null,
    screenshot_path: null,
    launchbox_id: null,
    rom_path: candidate.romPath,
    favorite: false,
    play_status: "unplayed"
  };

  try {
    return upsertLaunchBoxGame(data);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("Título é obrigatório")) throw error;
    return {
      game: createGame({
        ...data,
        title: candidate.filename,
        notes: "Importado sem match no LaunchBox"
      }),
      created: true
    };
  }
}

const BOX_FRONT_REGION_PRIORITY = ["brazil", "north-america", "europe"];

function findDownloadedMedia(files: string[], marker: string): string | null {
  if (marker === "box-front") {
    const cover = files.find((file) => path.basename(file).toLowerCase() === "cover.jpg");
    if (cover) return cover;

    for (const region of BOX_FRONT_REGION_PRIORITY) {
      const match = files.find((file) => file.includes(`box-front-${region}`));
      if (match) return match;
    }
    return files.find((file) => file.includes("box-front")) ?? null;
  }
  return files.find((file) => file.includes(marker)) ?? null;
}

function getAllowedRomExtensions(platformId: number): Set<string> {
  const configured = getPrimaryRomExtensionsForPlatform(platformId);
  return new Set((configured.length ? configured : SUPPORTED_ROM_EXTENSIONS).map((extension) => extension.toLowerCase()));
}

function buildUnsupportedExtensionReason(ext: string, platformName: string): string {
  if (!ext) return `Arquivo sem extensão suportada para ${platformName}`;
  return `Extensão ${ext} não configurada para ${platformName}`;
}

function isPlatformMatch(gamePlatform: string, aliases: string[]): boolean {
  const gameName = normalizePlatformName(gamePlatform);
  return aliases.some((alias) => {
    const aliasName = normalizePlatformName(alias);
    if (gameName === aliasName) return true;
    return aliasName.length > 4 && gameName.includes(aliasName);
  });
}

function normalizePlatformName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:the|a)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const OPTIONAL_TITLE_PREFIXES = [
  "disney pixar s",
  "disney pixar",
  "disney s",
  "disneys",
  "disney"
];

function buildMatchKeys(normalizedName: string): string[] {
  const keys = new Set([normalizedName]);
  for (const prefix of OPTIONAL_TITLE_PREFIXES) {
    if (!normalizedName.startsWith(`${prefix} `)) continue;
    const withoutPrefix = normalizedName.slice(prefix.length).trim();
    if (withoutPrefix.startsWith("s ")) continue;
    keys.add(withoutPrefix);
  }
  return [...keys].filter(Boolean);
}

function scoreEntry(query: string, entry: MatchEntry): number {
  return Math.max(...entry.matchKeys.map((key) => scoreMatch(query, key)));
}

function scoreMatch(query: string, title: string): number {
  if (!query || !title) return 0;
  if (title === query) return 1;
  if (title.includes(query) || query.includes(title)) return 0.86;

  const queryTokens = new Set(query.split(" "));
  const titleTokens = new Set(title.split(" "));
  const overlap = [...queryTokens].filter((token) => titleTokens.has(token)).length;
  return overlap / Math.max(queryTokens.size, titleTokens.size);
}

function requirePlatform(platformId: number) {
  const platform = listPlatforms().find((item) => item.id === platformId);
  if (!platform) throw new Error("Plataforma não encontrada");
  return platform;
}
