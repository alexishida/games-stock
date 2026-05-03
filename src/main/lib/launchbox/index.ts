import { getImagesDir } from "../../db/database";
import { getCoverStats, listLaunchBoxLinkedGames, updateGame, upsertLaunchBoxGame } from "../../db/repositories/games";
import { findOrCreatePlatform, listPlatforms } from "../../db/repositories/platforms";
import { CoverSyncResult, LaunchBoxDownloadParams, LaunchBoxImportParams, LaunchBoxImportResult, LaunchBoxProgress, LaunchBoxSearchParams } from "../../../shared/types";
import { PLATFORMS } from "./config";
import { buildIndex, ensureMetadata, getMetadataDownloadedAt, metadataExists } from "./db";
import { downloadImages, searchGames as searchIndex } from "./scraper";

type ProgressCallback = (progress: LaunchBoxProgress) => void;

export { IMAGE_TYPE_LIST, PLATFORMS } from "./config";
export { ensureMetadata, buildIndex, metadataExists };

export function getLaunchBoxMetadataDownloadedAt(): string | null {
  return getMetadataDownloadedAt();
}

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

export async function syncMissingCovers(onProgress?: ProgressCallback): Promise<CoverSyncResult> {
  const linkedGames = listLaunchBoxLinkedGames();
  const index = await buildIndex(onProgress);
  let downloadedNow = 0;
  let failed = 0;
  let skipped = 0;
  let metadataUpdated = 0;
  let metadataSkipped = 0;

  for (let i = 0; i < linkedGames.length; i += 1) {
    const gameRecord = linkedGames[i];
    const launchBoxId = gameRecord.launchbox_id;
    const launchBoxGame = launchBoxId ? index[launchBoxId] : null;
    const current = i + 1;

    if (!launchBoxGame) {
      metadataSkipped += 1;
      if (!gameRecord.box_art_path) skipped += 1;
      onProgress?.({ current, total: linkedGames.length, filename: gameRecord.title, status: "skipped" });
      continue;
    }

    updateGame(gameRecord.id, {
      title: launchBoxGame.name || gameRecord.title,
      publisher: launchBoxGame.publisher || null,
      year: launchBoxGame.release ? Number(launchBoxGame.release.slice(0, 4)) || null : null,
      genre: launchBoxGame.genres || null,
      rating: launchBoxGame.rating || null,
      notes: launchBoxGame.overview || null
    });
    metadataUpdated += 1;

    if (gameRecord.box_art_path) {
      onProgress?.({ current, total: linkedGames.length, filename: gameRecord.title, status: "done" });
    } else {
      const download = await downloadImages(launchBoxGame, getImagesDir(), ["Box - Front"], (progress) => {
        onProgress?.({
          current,
          total: linkedGames.length,
          filename: progress.filename ?? gameRecord.title,
          status: progress.status
        });
      });
      const boxArtPath = download.files.find((file) => file.endsWith("cover.jpg")) ?? download.files.find((file) => file.includes("box-front")) ?? null;

      if (boxArtPath) {
        updateGame(gameRecord.id, { box_art_path: boxArtPath });
        downloadedNow += 1;
      } else {
        failed += 1;
      }
    }
  }

  return {
    ...getCoverStats(),
    attempted: linkedGames.length,
    downloadedNow,
    failed,
    skipped,
    metadataUpdated,
    metadataSkipped
  };
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
  const result = await ensureMetadata(force, onProgress);
  if (result.status === "downloaded") {
    await buildIndex(onProgress);
    onProgress?.({ current: 1, total: 1, status: "done", filename: "Metadata.zip" });
  }
  return result;
}
