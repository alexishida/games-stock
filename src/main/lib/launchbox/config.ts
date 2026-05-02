import { app } from "electron";
import path from "node:path";
import { LaunchBoxImageType } from "../../../shared/types";

export const METADATA_URL = "https://gamesdb.launchbox-app.com/Metadata.zip";
export const IMAGES_BASE = "https://images.launchbox-app.com/";
export const CACHE_AGE_H = 24;

export function getLaunchBoxCacheDir(): string {
  return path.join(app.getPath("appData"), "GameStock", "launchbox_cache");
}

export function getMetadataFile(): string {
  return path.join(getLaunchBoxCacheDir(), "Metadata.xml");
}

export function getIndexFile(): string {
  return path.join(getLaunchBoxCacheDir(), "index.json");
}

export const PLATFORMS: Record<string, string[]> = {
  megadrive: ["Sega Mega Drive", "Sega Genesis", "Mega Drive"],
  snes: ["Super Nintendo Entertainment System", "Super Nintendo", "SNES"],
  n64: ["Nintendo 64"],
  nes: ["Nintendo Entertainment System", "NES"],
  gba: ["Nintendo Game Boy Advance", "Game Boy Advance"],
  gb: ["Nintendo Game Boy", "Game Boy"],
  gbc: ["Nintendo Game Boy Color", "Game Boy Color"],
  ps1: ["Sony Playstation", "PlayStation"],
  ps2: ["Sony Playstation 2", "PlayStation 2"],
  mastersystem: ["Sega Master System"],
  gamegear: ["Sega Game Gear"],
  atari2600: ["Atari 2600"],
  saturn: ["Sega Saturn"],
  dreamcast: ["Sega Dreamcast"],
  gameboy: ["Nintendo Game Boy"],
  nds: ["Nintendo DS"]
};

export const IMAGE_TYPES: Record<string, LaunchBoxImageType> = {
  "1": "Box - Front",
  "2": "Box - Back",
  "3": "Box - Spine",
  "4": "Screenshot - Gameplay",
  "5": "Fanart - Background",
  "6": "Banner",
  "7": "Clear Logo",
  "8": "Disc",
  "9": "Cart - Front",
  "10": "Screenshot - Game Title"
};

export const IMAGE_TYPE_LIST = Object.values(IMAGE_TYPES);
