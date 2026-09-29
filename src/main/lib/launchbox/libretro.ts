/**
 * Fonte alternativa de capas e screenshots do catálogo público Libretro.
 * Consulta os índices por plataforma para evitar associações por título aproximado.
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** Caminhos locais obtidos da Libretro para um jogo. */
export interface LibretroMedia {
  /** Prévia de capa pronta para a biblioteca. */
  coverPath: string | null;
  /** Screenshot de gameplay, quando disponível. */
  screenshotPath: string | null;
}

/** Nomes do catálogo Libretro para as plataformas conhecidas do GameStock/LaunchBox. */
const PLATFORM_NAMES: Record<string, string> = {
  "arcade": "MAME",
  "atari 2600": "Atari - 2600",
  "atari 7800": "Atari - 7800",
  "commodore 64": "Commodore - 64",
  "commodore amiga": "Commodore - Amiga",
  "game boy": "Nintendo - Game Boy",
  "nintendo game boy": "Nintendo - Game Boy",
  "game boy advance": "Nintendo - Game Boy Advance",
  "nintendo game boy advance": "Nintendo - Game Boy Advance",
  "game boy color": "Nintendo - Game Boy Color",
  "nintendo game boy color": "Nintendo - Game Boy Color",
  "nintendo 64": "Nintendo - Nintendo 64",
  "nintendo ds": "Nintendo - Nintendo DS",
  "nintendo nes": "Nintendo - Nintendo Entertainment System",
  "nintendo entertainment system": "Nintendo - Nintendo Entertainment System",
  "nintendo gamecube": "Nintendo - GameCube",
  "nintendo wii": "Nintendo - Wii",
  "sony playstation": "Sony - PlayStation",
  "playstation": "Sony - PlayStation",
  "sony playstation 2": "Sony - PlayStation 2",
  "playstation 2": "Sony - PlayStation 2",
  "sega cd": "Sega - Mega-CD - Sega CD",
  "sega dreamcast": "Sega - Dreamcast",
  "sega game gear": "Sega - Game Gear",
  "sega master system": "Sega - Master System - Mark III",
  "sega mega drive": "Sega - Mega Drive - Genesis",
  "sega genesis": "Sega - Mega Drive - Genesis",
  "sega mega drive genesis": "Sega - Mega Drive - Genesis",
  "sega saturn": "Sega - Saturn",
  "super nintendo": "Nintendo - Super Nintendo Entertainment System",
  "super nintendo entertainment system": "Nintendo - Super Nintendo Entertainment System",
  "sammy atomiswave": "Atomiswave",
  "sega naomi": "Sega - Naomi",
  "sega naomi 2": "Sega - Naomi 2",
  "snk neo geo mvs": "SNK - Neo Geo"
};

/** Reutiliza o índice de cada pasta durante uma sincronização em lote. */
const directoryCache = new Map<string, Promise<string[]>>();

/**
 * Baixa apenas as mídias solicitadas e mantém arquivos anteriores intactos.
 * Uma falha de rede ou ausência no catálogo deixa a respectiva mídia como null.
 */
export async function downloadLibretroMedia(
  title: string | string[],
  platformName: string,
  gameDir: string,
  cover: boolean,
  screenshot: boolean
): Promise<LibretroMedia> {
  const result: LibretroMedia = { coverPath: null, screenshotPath: null };
  const platform = PLATFORM_NAMES[normalize(platformName)];
  if (!platform) return result;
  const titles = Array.isArray(title) ? title : [title];

  if (cover) {
    const source = await findFirstImage(platform, "Named_Boxarts", titles);
    if (source) {
      const imagePath = path.join(gameDir, "libretro-box-front.png");
      const coverPath = path.join(gameDir, "libretro-cover.jpg");
      try {
        await saveImage(source, imagePath);
        // Usa outro nome para não sobrescrever o cover.jpg do LaunchBox.
        if (!(await exists(coverPath))) {
          const temporary = `${coverPath}.${randomUUID()}.tmp`;
          try {
            await sharp(imagePath).resize({ width: 280, height: 280, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(temporary);
            await fs.rename(temporary, coverPath);
          } finally {
            await fs.rm(temporary, { force: true }).catch(() => undefined);
          }
        }
        result.coverPath = coverPath;
      } catch {
        // Erro pontual de download não apaga uma mídia de execução anterior.
      }
    }
  }

  if (screenshot) {
    const source = await findFirstImage(platform, "Named_Snaps", titles);
    if (source) {
      const imagePath = path.join(gameDir, "libretro-screenshot-gameplay.png");
      try {
        await saveImage(source, imagePath);
        result.screenshotPath = imagePath;
      } catch {
        // Mantém eventual arquivo já salvo para uma próxima tentativa.
      }
    }
  }

  return result;
}

/** Busca nomes de jogos que tenham capa no catálogo da plataforma informada. */
export async function searchLibretroTitles(query: string, platformName: string): Promise<string[]> {
  const platform = PLATFORM_NAMES[normalize(platformName)];
  const expected = normalize(query);
  if (!platform || !expected) return [];
  const directory = `https://thumbnails.libretro.com/${encodeURIComponent(platform)}/Named_Boxarts/`;
  const files = await listImages(directory);
  const names = new Map<string, string>();
  for (const file of files) {
    const title = path.basename(file, ".png").replace(/(?:\s*\([^)]*\))+$/, "").trim();
    const key = normalize(title);
    if (key.includes(expected) && !names.has(key)) names.set(key, title);
    if (names.size >= 30) break;
  }
  return [...names.values()].sort((a, b) =>
    Number(normalize(b) === expected) - Number(normalize(a) === expected) || a.localeCompare(b));
}

/** Tenta título local, nomes regionais e título principal sem associar jogos diferentes. */
async function findFirstImage(platform: string, category: string, titles: string[]): Promise<string | null> {
  for (const title of titles) {
    const source = await findImage(platform, category, title);
    if (source) return source;
  }
  return null;
}

/** Seleciona apenas títulos idênticos após remover os sufixos de região/revisão. */
async function findImage(platform: string, category: string, title: string): Promise<string | null> {
  const directory = `https://thumbnails.libretro.com/${encodeURIComponent(platform)}/${category}/`;
  const files = await listImages(directory);
  const expected = normalize(title);
  const matches = files.filter((file) => normalize(path.basename(file, ".png").replace(/(?:\s*\([^)]*\))+$/, "")) === expected);
  if (!matches.length) return null;

  // Prefere arte brasileira; as demais regiões têm ordem estável e previsível.
  const regions = ["brazil", "usa", "world", "europe", "japan"];
  matches.sort((a, b) => {
    const priority = (file: string) => {
      const region = regions.findIndex((name) => file.toLowerCase().includes(`(${name})`));
      return region < 0 ? regions.length : region;
    };
    return priority(a) - priority(b) || a.localeCompare(b);
  });
  return directory + encodeURIComponent(matches[0]);
}

/** Lê o índice Apache da Libretro e memoriza somente nomes PNG válidos. */
async function listImages(directory: string): Promise<string[]> {
  let pending = directoryCache.get(directory);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(directory, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`Libretro HTTP ${response.status}`);
      const html = await response.text();
      return [...html.matchAll(/<a href="([^"?#]+\.png)">/gi)]
        .map((match) => decodeURIComponent(match[1].replace(/&amp;/g, "&")))
        .filter((name) => !name.includes("/") && !name.includes("\\"));
    })();
    directoryCache.set(directory, pending);
  }
  try {
    return await pending;
  } catch {
    // Falha temporária não fica presa no cache durante o restante do job.
    directoryCache.delete(directory);
    return [];
  }
}

/** Grava de forma atômica para que uma transferência interrompida não pareça cache válido. */
async function saveImage(url: string, destination: string): Promise<void> {
  if (await exists(destination)) return;
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Libretro HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 12_000_000 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("Imagem Libretro inválida");
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, bytes);
    await fs.rename(temporary, destination);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
  }
}

/** Confere o cache em disco antes de repetir downloads ou criar prévias. */
async function exists(file: string): Promise<boolean> {
  try {
    return (await fs.stat(file)).size > 0;
  } catch {
    return false;
  }
}

/** Normaliza variações de pontuação sem aproximar nomes de jogos diferentes. */
function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
