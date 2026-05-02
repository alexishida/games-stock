import fs from "node:fs";
import path from "node:path";
import { getImagesDir } from "./db/database";
import { upsertLaunchBoxGame } from "./db/repositories/games";
import { listPlatforms } from "./db/repositories/platforms";
import { buildIndex, ensureMetadata } from "./launchbox/db";
import { downloadImages } from "./launchbox/scraper";
import { PLATFORMS } from "./launchbox/config";
import {
  GameCreateInput,
  LaunchBoxGame,
  LaunchBoxImageType,
  RomFolderImportCandidate,
  RomFolderImportProgress,
  RomFolderImportRequest,
  RomFolderImportResult,
  RomFolderMatchedCandidate,
  RomFolderScanRequest,
  RomFolderScanResult
} from "../shared/types";

type ProgressCallback = (progress: RomFolderImportProgress) => void;
interface MatchEntry {
  game: LaunchBoxGame;
  normalizedName: string;
}

interface MatchContext {
  platformMatches: MatchEntry[];
  exactByName: Map<string, MatchEntry[]>;
}

export const SUPPORTED_ROM_EXTENSIONS = [
  ".zip",
  ".rom",
  ".bin",
  ".iso",
  ".img",
  ".cue",
  ".nes",
  ".snes",
  ".sfc",
  ".smc",
  ".swc",
  ".fig",
  ".smd",
  ".md",
  ".n64",
  ".z64",
  ".v64",
  ".gb",
  ".gbc",
  ".gba"
];

const DEFAULT_MEDIA_TYPES: LaunchBoxImageType[] = ["Box - Front", "Cart - Front", "Fanart - Background", "Screenshot - Gameplay"];

export function scanRomFolder(request: RomFolderScanRequest): RomFolderScanResult {
  const platform = requirePlatform(request.platformId);
  const folderPaths = request.folderPaths.map((folderPath) => path.resolve(folderPath));
  const romFilePaths = (request.romFilePaths ?? []).map((filePath) => path.resolve(filePath));
  let ignored = 0;

  const folderCandidates = folderPaths.flatMap((folderPath) => {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    return entries.flatMap((entry): RomFolderImportCandidate[] => {
      if (!entry.isFile()) return [];
      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_ROM_EXTENSIONS.includes(ext)) {
        ignored += 1;
        return [];
      }

      return [{
        folderPath,
        romPath: path.join(folderPath, entry.name),
        filename: entry.name,
        titleCandidate: normalizeRomTitle(entry.name),
        platformId: platform.id,
        platformName: platform.name
      }];
    });
  });

  const fileCandidates = romFilePaths.flatMap((romPath): RomFolderImportCandidate[] => {
    const ext = path.extname(romPath).toLowerCase();
    if (!SUPPORTED_ROM_EXTENSIONS.includes(ext)) {
      ignored += 1;
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

  return { folderPaths, romFilePaths, platformId: platform.id, platformName: platform.name, candidates: [...folderCandidates, ...fileCandidates], ignored };
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
  const matchContext = createMatchContext(scan.platformName, launchBoxIndex);

  for (let index = 0; index < scan.candidates.length; index += 1) {
    const candidate = scan.candidates[index];
    const current = index + 1;

    try {
      onProgress?.({ current, total, folderPath: candidate.folderPath, filename: candidate.filename, stage: "matching", message: `Buscando ${candidate.titleCandidate}` });
      const matched = matchCandidate(candidate, launchBoxIndex, matchContext);
      if (matched.status !== "matched" || !matched.match) {
        summary.unmatched += 1;
        summary.processed += 1;
        items.push({ candidate, status: "unmatched" });
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

  return { folderPaths: scan.folderPaths, romFilePaths: scan.romFilePaths, platformId: scan.platformId, platformName: scan.platformName, items, summary };
}

export function matchCandidate(candidate: RomFolderImportCandidate, index: Record<string, LaunchBoxGame>, context = createMatchContext(candidate.platformName, index)): RomFolderMatchedCandidate {
  const query = candidate.titleCandidate;
  const normalizedQuery = normalizeForMatch(query);
  const exact = context.exactByName.get(normalizedQuery) ?? [];
  if (exact.length === 1) return { ...candidate, status: "matched", match: exact[0].game, alternatives: [exact[0].game] };
  if (exact.length > 1) return { ...candidate, status: "ambiguous", match: null, alternatives: exact.map((entry) => entry.game) };

  const ranked = context.platformMatches
    .map((entry) => ({ game: entry.game, score: scoreMatch(normalizedQuery, entry.normalizedName) }))
    .filter((item) => item.score >= 0.72)
    .sort((a, b) => b.score - a.score || a.game.name.localeCompare(b.game.name));

  if (!ranked.length) return { ...candidate, status: "unmatched", match: null, alternatives: context.platformMatches.slice(0, 5).map((entry) => entry.game) };
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
    return { ...candidate, status: "ambiguous", match: null, alternatives: ranked.slice(0, 5).map((item) => item.game) };
  }
  return { ...candidate, status: "matched", match: ranked[0].game, alternatives: ranked.slice(0, 5).map((item) => item.game) };
}

function createMatchContext(platformName: string, index: Record<string, LaunchBoxGame>): MatchContext {
  const platformKey = platformKeyForName(platformName);
  const platformMatches = Object.values(index)
    .filter((game) => isPlatformMatch(game.platform, platformName, platformKey))
    .map((game) => ({ game, normalizedName: normalizeForMatch(game.name) }));
  const exactByName = new Map<string, MatchEntry[]>();

  for (const entry of platformMatches) {
    const existing = exactByName.get(entry.normalizedName) ?? [];
    existing.push(entry);
    exactByName.set(entry.normalizedName, existing);
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

function findDownloadedMedia(files: string[], marker: string): string | null {
  return files.find((file) => file.includes(marker)) ?? null;
}

function platformKeyForName(name: string): string | null {
  const normalized = normalizePlatformName(name);
  const entry = Object.entries(PLATFORMS).find(([, aliases]) =>
    aliases.some((alias) => normalizePlatformName(alias) === normalized)
  );
  return entry?.[0] ?? null;
}

function isPlatformMatch(gamePlatform: string, selectedPlatform: string, platformKey: string | null): boolean {
  const gameName = normalizePlatformName(gamePlatform);
  const selectedName = normalizePlatformName(selectedPlatform);
  if (gameName === selectedName) return true;
  if (!platformKey) return false;

  return PLATFORMS[platformKey].some((alias) => {
    const aliasName = normalizePlatformName(alias);
    if (gameName === aliasName) return true;
    // Avoid short aliases like "NES" matching inside unrelated names such as "Genesis".
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
  if (!platform) throw new Error("Plataforma nao encontrada");
  return platform;
}
