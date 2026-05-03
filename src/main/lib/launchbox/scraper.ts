import fs from "node:fs";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";
import { getImagesDir } from "../../db/database";
import { LaunchBoxDownloadResult, LaunchBoxGame, LaunchBoxImageType, LaunchBoxProgress, LaunchBoxSearchParams } from "../../../shared/types";
import { IMAGES_BASE, PLATFORMS } from "./config";

type ProgressCallback = (progress: LaunchBoxProgress) => void;

export function searchGames(index: Record<string, LaunchBoxGame>, params: LaunchBoxSearchParams): LaunchBoxGame[] {
  const query = params.query.trim().toLowerCase();
  if (!query) return [];

  const allowedPlatforms = params.platformName
    ? resolveAllowedPlatforms(params.platformName)
    : null;

  return Object.values(index)
    .filter((game) => {
      if (!game.name.toLowerCase().includes(query)) return false;
      if (!allowedPlatforms) return true;
      return allowedPlatforms.some((platform) => game.platform.toLowerCase().includes(platform));
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 100);
}

function resolveAllowedPlatforms(platformName: string): string[] {
  const normalized = platformName.toLowerCase();
  const entry = Object.entries(PLATFORMS).find(([, aliases]) =>
    aliases.some((alias) => alias.toLowerCase() === normalized)
  );
  const aliases = entry ? PLATFORMS[entry[0]].map((a) => a.toLowerCase()) : [];
  if (!aliases.includes(normalized)) aliases.push(normalized);
  return aliases;
}

export async function downloadImages(
  game: LaunchBoxGame,
  outputDir = getImagesDir(),
  types: LaunchBoxImageType[] = [],
  onProgress?: ProgressCallback
): Promise<LaunchBoxDownloadResult> {
  const images = types.length ? game.images.filter((image) => types.includes(image.type)) : game.images;
  const gameDir = getGameImageDir(outputDir, game);
  fs.mkdirSync(gameDir, { recursive: true });

  const result: LaunchBoxDownloadResult = { success: 0, skipped: 0, failed: 0, files: [] };

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const filename = getImageFilename(image, index);
    const dest = path.join(gameDir, filename);
    const current = index + 1;

    if (fs.existsSync(dest)) {
      result.skipped += 1;
      result.files.push(dest);
      onProgress?.({ current, total: images.length, filename, status: "skipped" });
      continue;
    }

    try {
      onProgress?.({ current, total: images.length, filename, status: "downloading" });
      const response = await fetch(IMAGES_BASE + image.filename);
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      await pipeline(Readable.fromWeb(response.body as never), createWriteStream(dest));

      result.success += 1;
      result.files.push(dest);
      onProgress?.({ current, total: images.length, filename, status: "done" });
    } catch {
      result.failed += 1;
      onProgress?.({ current, total: images.length, filename, status: "error" });
    }
  }

  const coverPath = await ensureCoverPreview(gameDir, result.files);
  if (coverPath && !result.files.includes(coverPath)) result.files.unshift(coverPath);

  fs.writeFileSync(path.join(gameDir, "metadata.json"), JSON.stringify(game, null, 2), "utf8");
  return result;
}

export function getGameImageDir(outputDir: string, game: Pick<LaunchBoxGame, "name" | "platform">): string {
  return path.join(outputDir, sanitize(game.platform || "unknown-platform"), sanitize(game.name));
}

function sanitize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

function getImageFilename(image: Pick<LaunchBoxGame["images"][number], "filename" | "region" | "type">, index: number): string {
  const ext = path.extname(image.filename) || ".jpg";
  if (image.type.startsWith("Box -")) {
    return `${slug(image.type)}-${slug(image.region || "no_region")}-${String(index + 1).padStart(2, "0")}${ext}`;
  }

  return `${slug(image.type)}-${slug(image.region || "no_region")}${ext}`;
}

const BOX_FRONT_REGION_PRIORITY = ["brazil", "north-america", "europe", "world", "united-states", "no_region"];

async function ensureCoverPreview(gameDir: string, files: string[]): Promise<string | null> {
  const boxArtFiles = files.filter((file) => {
    const filename = path.basename(file).toLowerCase();
    return filename.startsWith("box-front-") || filename.startsWith("box-front-reconstructed-");
  });
  if (!boxArtFiles.length) return null;

  const selected = selectPreferredBoxArt(boxArtFiles);
  if (!selected) return null;

  const coverPath = path.join(gameDir, "cover.jpg");
  const metadata = await sharp(selected).metadata();
  const isLandscape = (metadata.width ?? 0) > (metadata.height ?? 0);
  const size = isLandscape ? { width: 280, height: 195 } : { width: 195, height: 280 };
  await sharp(selected).resize({ ...size, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(coverPath);

  return coverPath;
}

function selectPreferredBoxArt(files: string[]): string | null {
  for (const region of BOX_FRONT_REGION_PRIORITY) {
    const match = files.find((file) => path.basename(file).toLowerCase().includes(`box-front-${region}-`));
    if (match) return match;
  }

  return files[0] ?? null;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 120);
}
