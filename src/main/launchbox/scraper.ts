import fs from "node:fs";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getImagesDir } from "../database";
import { LaunchBoxDownloadResult, LaunchBoxGame, LaunchBoxImageType, LaunchBoxProgress, LaunchBoxSearchParams } from "../../shared/types";
import { IMAGES_BASE, PLATFORMS } from "./config";

type ProgressCallback = (progress: LaunchBoxProgress) => void;

export function searchGames(index: Record<string, LaunchBoxGame>, params: LaunchBoxSearchParams): LaunchBoxGame[] {
  const query = params.query.trim().toLowerCase();
  if (!query) return [];

  const allowedPlatforms = params.platformKey && PLATFORMS[params.platformKey]
    ? PLATFORMS[params.platformKey].map((platform) => platform.toLowerCase())
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

export async function downloadImages(
  game: LaunchBoxGame,
  outputDir = getImagesDir(),
  types: LaunchBoxImageType[] = [],
  onProgress?: ProgressCallback
): Promise<LaunchBoxDownloadResult> {
  const images = types.length ? game.images.filter((image) => types.includes(image.type)) : game.images;
  const safeName = sanitize(game.name);
  const gameDir = path.join(outputDir, safeName);
  fs.mkdirSync(gameDir, { recursive: true });

  const result: LaunchBoxDownloadResult = { success: 0, skipped: 0, failed: 0, files: [] };

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const ext = path.extname(image.filename) || ".jpg";
    const filename = `${sanitize(image.type)}-${sanitize(image.region || "no_region")}${ext}`;
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

  fs.writeFileSync(path.join(gameDir, "metadata.json"), JSON.stringify(game, null, 2), "utf8");
  return result;
}

function sanitize(value: string): string {
  return value.replace(/[^\w\s.-]/g, "_").replace(/\s+/g, "_").slice(0, 120);
}
