/**
 * Configurações e constantes da integração com o LaunchBox.
 *
 * Centraliza URLs de download, caminhos de cache e mapeamento de tipos de imagem
 * utilizados em toda a lib LaunchBox.
 */

import path from "node:path";
import { LaunchBoxImageType } from "../../../shared/types";
import { getAppUserDataDir } from "../../appPaths";

/** URL oficial usada para download do banco de metadados do LaunchBox. */
export const METADATA_URL = "https://gamesdb.launchbox-app.com/Metadata.zip";

/** URL base das imagens hospedadas pelo LaunchBox. */
export const IMAGES_BASE = "https://images.launchbox-app.com/";

/** Tempo de cache do Metadata.xml em horas antes de forçar novo download. */
export const CACHE_AGE_H = 24;

/** Retorna o caminho do diretório de cache do LaunchBox dentro dos dados do usuário. */
export function getLaunchBoxCacheDir(): string {
  return path.join(getAppUserDataDir(), "launchbox_cache");
}

/** Retorna o caminho do arquivo XML de metadados extraído do Metadata.zip. */
export function getMetadataFile(): string {
  return path.join(getLaunchBoxCacheDir(), "Metadata.xml");
}

/** Retorna o caminho do arquivo de índice JSON gerado a partir do Metadata.xml. */
export function getIndexFile(): string {
  return path.join(getLaunchBoxCacheDir(), "index.json");
}

/**
 * Mapeamento de identificadores numéricos (do LaunchBox) para tipos de imagem
 * legíveis, usados na seleção e download de mídias.
 */
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

/** Lista plana de todos os tipos de imagem suportados. */
export const IMAGE_TYPE_LIST = Object.values(IMAGE_TYPES);
