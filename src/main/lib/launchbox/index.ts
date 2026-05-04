import { getImagesDir } from "../../db/database";
import { getCoverStats, getGame, listLaunchBoxLinkedGames, updateGame, upsertLaunchBoxGame } from "../../db/repositories/games";
import { findOrCreatePlatform, getLaunchBoxAliasesForPlatformName, listPlatforms, resolvePlatformByLaunchBoxName } from "../../db/repositories/platforms";
import { CoverSyncResult, LaunchBoxDownloadParams, LaunchBoxGame, LaunchBoxImage, LaunchBoxImageType, LaunchBoxImportParams, LaunchBoxImportResult, LaunchBoxProgress, LaunchBoxSearchParams } from "../../../shared/types";
import { buildIndex, ensureMetadata, getMetadataDownloadedAt, metadataExists } from "./db";
import { downloadImages, searchGames as searchIndex } from "./scraper";

type ProgressCallback = (progress: LaunchBoxProgress) => void;

export { IMAGE_TYPE_LIST } from "./config";
export { ensureMetadata, buildIndex, metadataExists };

export function getLaunchBoxMetadataDownloadedAt(): string | null {
  return getMetadataDownloadedAt();
}

export async function searchGames(params: LaunchBoxSearchParams) {
  const index = await buildIndex();
  const allowedPlatformNames = params.platformName
    ? getLaunchBoxAliasesForPlatformName(params.platformName)
    : null;
  return searchIndex(index, params.query, allowedPlatformNames);
}

export async function downloadLaunchBoxImages(params: LaunchBoxDownloadParams, onProgress?: ProgressCallback) {
  return downloadImages(params.game, getImagesDir(), params.types, onProgress);
}

export async function importGame(params: LaunchBoxImportParams, onProgress?: ProgressCallback): Promise<LaunchBoxImportResult> {
  const index = await buildIndex(onProgress);
  const game = index[params.launchboxGameId];
  if (!game) throw new Error("Jogo LaunchBox nao encontrado");

  const targetGame = params.targetGameId ? getTargetGame(params.targetGameId) : null;
  const platformId = targetGame?.platform_id ?? params.platformId ?? resolvePlatformId(game.platform);
  const downloadGame = targetGame ? withPreferredImagesOnly(game, params.imageTypes) : game;
  const download = await downloadImages(downloadGame, getImagesDir(), params.imageTypes, onProgress);
  const boxArtPath = download.files.find((file) => file.endsWith("cover.jpg")) ?? download.files.find((file) => file.includes("box-front")) ?? download.files[0] ?? null;
  const backgroundPath = download.files.find((file) => file.includes("fanart-background")) ?? null;
  const screenshotPath = download.files.find((file) => file.includes("screenshot-gameplay")) ?? null;
  const year = game.release ? Number(game.release.slice(0, 4)) || null : null;
  const importedData = {
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
    launchbox_id: game.id
  };

  if (targetGame) {
    const saved = updateGame(targetGame.id, importedData);
    return { gameId: saved.id, created: false, boxArtPath };
  }

  const saved = upsertLaunchBoxGame({
    ...importedData,
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
  const existing = resolvePlatformByLaunchBoxName(launchBoxPlatform);
  if (existing) return existing.id;

  const platforms = listPlatforms();
  const byName = platforms.find((platform) => platform.name.toLowerCase() === launchBoxPlatform.toLowerCase());
  return byName?.id ?? findOrCreatePlatform(launchBoxPlatform).id;
}

function getTargetGame(targetGameId: number) {
  const game = listLaunchBoxLinkedGames().find((entry) => entry.id === targetGameId);
  if (game) return game;
  const selected = getGame(targetGameId);
  if (!selected) throw new Error("Jogo de destino nao encontrado");
  return selected;
}

function withPreferredImagesOnly(game: LaunchBoxGame, types: LaunchBoxImageType[]): LaunchBoxGame {
  const selected = types
    .map((type) => selectPreferredImage(game.images.filter((image) => image.type === type), type))
    .filter(Boolean) as LaunchBoxImage[];
  return { ...game, images: selected };
}

function selectPreferredImage(images: LaunchBoxImage[], type: LaunchBoxImageType): LaunchBoxImage | null {
  if (!images.length) return null;
  if (type === "Box - Front") {
    const regionPriority = ["brazil", "north america", "north-america", "united states", "world", "europe"];
    for (const region of regionPriority) {
      const match = images.find((image) => (image.region ?? "").toLowerCase() === region);
      if (match) return match;
    }
  }
  return images[0];
}

export async function ensureLaunchBoxMetadata(force = false, onProgress?: ProgressCallback) {
  const result = await ensureMetadata(force, onProgress);
  if (result.status === "downloaded") {
    await buildIndex(onProgress);
    onProgress?.({ current: 1, total: 1, status: "done", filename: "Metadata.zip" });
  }
  return result;
}
