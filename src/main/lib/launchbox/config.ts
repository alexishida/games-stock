import path from "node:path";
import { LaunchBoxImageType } from "../../../shared/types";
import { getAppUserDataDir } from "../../appPaths";

export const METADATA_URL_ORG = "https://gamesdb.launchbox-app.com/Metadata.zip";
export const METADATA_URL = "http://s3.kanteoke.com/game-stock/Metadata.zip";
export const IMAGES_BASE = "https://images.launchbox-app.com/";
export const CACHE_AGE_H = 24;

export function getLaunchBoxCacheDir(): string {
  return path.join(getAppUserDataDir(), "launchbox_cache");
}

export function getMetadataFile(): string {
  return path.join(getLaunchBoxCacheDir(), "Metadata.xml");
}

export function getIndexFile(): string {
  return path.join(getLaunchBoxCacheDir(), "index.json");
}

export const IMAGE_TYPES: Record<string, LaunchBoxImageType> = {
  "1": "Box - 3D",
  "2": "Box - Back",
  "3": "Box - Back - Reconstructed",
  "4": "Box - Front",
  "5": "Box - Front - Reconstructed",
  "6": "Box - Spine",
  "7": "Screenshot - Gameplay",
  "8": "Fanart - Background",
  "9": "Banner",
  "10": "Clear Logo",
  "11": "Disc",
  "12": "Cart - Front",
  "13": "Screenshot - Game Title"
};

export const IMAGE_TYPE_LIST = Object.values(IMAGE_TYPES);
