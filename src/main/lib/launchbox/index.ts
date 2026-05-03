import { getImagesDir } from "../../db/database";
import { upsertLaunchBoxGame } from "../../db/repositories/games";
import { findOrCreatePlatform, listPlatforms } from "../../db/repositories/platforms";
import { LaunchBoxDownloadParams, LaunchBoxImportParams, LaunchBoxImportResult, LaunchBoxProgress, LaunchBoxSearchParams } from "../../../shared/types";
import { PLATFORMS } from "./config";
import { buildIndex, ensureMetadata } from "./db";
import { downloadImages, searchGames as searchIndex } from "./scraper";

type ProgressCallback = (progress: LaunchBoxProgress) => void;

export { IMAGE_TYPE_LIST, PLATFORMS } from "./config";
export { ensureMetadata, buildIndex };

export async function searchGames(params: LaunchBoxSearchParams) {
  const index = await buildIndex();
  return searchIndex(index, params);
}

export async function downloadLaunchBoxImages(params: LaunchBoxDownloadParams, onProgress?: ProgressCallback) {
  return downloadImages(params.game, getImagesDir(), params.types, onProgress);
}

export async function importGame(params: LaunchBoxImportParams, onProgress?: ProgressCallback): Promise<LaunchBoxImportResult> {
  const index = await buildIndex(onProgress);
  const game = index[params.launchboxGameId];
  if (!game) throw new Error("Jogo LaunchBox nao encontrado");

  const platformId = params.platformId ?? resolvePlatformId(game.platform);
  const download = await downloadImages(game, getImagesDir(), params.imageTypes, onProgress);
  const boxArtPath = download.files.find((file) => file.endsWith("cover.jpg")) ?? download.files.find((file) => file.includes("box-front")) ?? download.files[0] ?? null;
  const backgroundPath = download.files.find((file) => file.includes("fanart-background")) ?? null;
  const screenshotPath = download.files.find((file) => file.includes("screenshot-gameplay")) ?? null;
  const year = game.release ? Number(game.release.slice(0, 4)) || null : null;
  const saved = upsertLaunchBoxGame({
    title: game.name,
    platform_id: platformId,
    publisher: game.publisher || null,
    year,
    genre: game.genres || null,
    rating: game.rating || null,
    notes: game.overview || null,
    box_art_path: boxArtPath,
    background_path: backgroundPath,
    screenshot_path: screenshotPath,
    launchbox_id: game.id,
    favorite: false,
    play_status: "unplayed",
    rom_path: null
  });

  return { gameId: saved.game.id, created: saved.created, boxArtPath };
}

function resolvePlatformId(launchBoxPlatform: string): number {
  const platforms = listPlatforms();
  const lower = launchBoxPlatform.toLowerCase();
  const alias = Object.values(PLATFORMS).flat().find((name) => lower.includes(name.toLowerCase()));
  const name = alias ?? launchBoxPlatform;
  const existing = platforms.find((platform) => platform.name.toLowerCase() === name.toLowerCase());
  return existing?.id ?? findOrCreatePlatform(name).id;
}

export async function ensureLaunchBoxMetadata(force = false, onProgress?: ProgressCallback) {
  return ensureMetadata(force, onProgress);
}
