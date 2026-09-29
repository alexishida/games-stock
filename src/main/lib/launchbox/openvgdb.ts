/**
 * Consulta metadados textuais do OpenVGDB como alternativa ao LaunchBox.
 * O SQLite público é baixado uma vez e consultado somente em modo leitura.
 */

import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import Database from "better-sqlite3";
import { getAppUserDataDir } from "../../appPaths";
import type { LaunchBoxGame } from "../../../shared/types";

/** Plataforma local/LaunchBox para o nome usado nas releases OpenVGDB. */
const SYSTEM_NAMES: Record<string, string> = {
  "arcade": "Arcade",
  "atari 2600": "Atari 2600",
  "atari 7800": "Atari 7800",
  "commodore 64": "Commodore 64",
  "game boy": "Nintendo Game Boy",
  "nintendo game boy": "Nintendo Game Boy",
  "game boy advance": "Nintendo Game Boy Advance",
  "nintendo game boy advance": "Nintendo Game Boy Advance",
  "game boy color": "Nintendo Game Boy Color",
  "nintendo game boy color": "Nintendo Game Boy Color",
  "nintendo 64": "Nintendo 64",
  "nintendo ds": "Nintendo DS",
  "nintendo nes": "Nintendo Entertainment System",
  "nintendo entertainment system": "Nintendo Entertainment System",
  "nintendo gamecube": "Nintendo GameCube",
  "nintendo wii": "Nintendo Wii",
  "sony playstation": "Sony PlayStation",
  "playstation": "Sony PlayStation",
  "sega cd": "Sega CD/Mega-CD",
  "sega game gear": "Sega Game Gear",
  "sega master system": "Sega Master System",
  "sega mega drive": "Sega Genesis/Mega Drive",
  "sega genesis": "Sega Genesis/Mega Drive",
  "sega mega drive genesis": "Sega Genesis/Mega Drive",
  "sega saturn": "Sega Saturn",
  "super nintendo": "Nintendo Super Nintendo Entertainment System",
  "super nintendo entertainment system": "Nintendo Super Nintendo Entertainment System"
};

/** Nome exibido e reutilizado para resolver plataformas locais no importador. */
const LOCAL_NAMES: Record<string, string> = {
  "Sega Genesis/Mega Drive": "Sega Mega Drive",
  "Nintendo Super Nintendo Entertainment System": "Super Nintendo",
  "Nintendo Entertainment System": "Nintendo NES",
  "Nintendo Game Boy": "Game Boy",
  "Nintendo Game Boy Color": "Game Boy Color",
  "Nintendo Game Boy Advance": "Game Boy Advance",
  "Sega CD/Mega-CD": "Sega CD"
};

/** Campos necessários para apresentar e aplicar uma release. */
interface ReleaseRow {
  releaseID: number;
  releaseTitleName: string;
  TEMPsystemName: string;
  releaseDescription: string | null;
  releaseDeveloper: string | null;
  releasePublisher: string | null;
  releaseGenre: string | null;
  releaseDate: string | null;
}

/** Evita dois downloads simultâneos do mesmo catálogo. */
let pendingDatabase: Promise<string> | null = null;

/** Busca títulos do OpenVGDB na plataforma selecionada, sem criar vínculos LaunchBox falsos. */
export async function searchOpenVgdbGames(query: string, platformName: string | null): Promise<LaunchBoxGame[]> {
  const system = platformName ? SYSTEM_NAMES[normalize(platformName)] : null;
  if (platformName && !system) return [];
  const normalizedQuery = normalize(query);
  const token = normalizedQuery.split(" ").sort((a, b) => b.length - a.length)[0];
  if (!token || token.length < 2) return [];

  const database = new Database(await ensureDatabase(), { readonly: true, fileMustExist: true });
  try {
    const rows = database.prepare(`
      SELECT releaseID, releaseTitleName, TEMPsystemName, releaseDescription,
             releaseDeveloper, releasePublisher, releaseGenre, releaseDate
      FROM RELEASES
      WHERE instr(lower(releaseTitleName), lower(?)) > 0
        AND (? IS NULL OR TEMPsystemName = ?)
      LIMIT 1000
    `).all(token, system, system) as ReleaseRow[];

    // Releases regionais do mesmo título aparecem uma vez, escolhendo a ficha mais completa.
    const unique = new Map<string, ReleaseRow>();
    for (const row of rows) {
      const name = normalize(row.releaseTitleName);
      if (!name.includes(normalizedQuery)) continue;
      const key = `${row.TEMPsystemName}:${name}`;
      const previous = unique.get(key);
      if (!previous || richness(row) > richness(previous)) unique.set(key, row);
    }
    return [...unique.values()]
      .sort((a, b) => Number(normalize(b.releaseTitleName) === normalizedQuery) - Number(normalize(a.releaseTitleName) === normalizedQuery)
        || a.releaseTitleName.localeCompare(b.releaseTitleName))
      .slice(0, 30)
      .map(toGame);
  } finally {
    database.close();
  }
}

/** Obtém novamente uma release selecionada, validando seu identificador numérico. */
export async function getOpenVgdbGame(id: string): Promise<LaunchBoxGame | null> {
  const releaseId = Number(id.replace(/^openvgdb:/, ""));
  if (!Number.isSafeInteger(releaseId) || releaseId <= 0) return null;
  const database = new Database(await ensureDatabase(), { readonly: true, fileMustExist: true });
  try {
    const row = database.prepare(`
      SELECT releaseID, releaseTitleName, TEMPsystemName, releaseDescription,
             releaseDeveloper, releasePublisher, releaseGenre, releaseDate
      FROM RELEASES WHERE releaseID = ?
    `).get(releaseId) as ReleaseRow | undefined;
    return row ? toGame(row) : null;
  } finally {
    database.close();
  }
}

/** Evita descartar a descrição e demais campos mais completos de outra região. */
function richness(row: ReleaseRow): number {
  return [row.releaseDescription, row.releaseDeveloper, row.releasePublisher, row.releaseGenre, row.releaseDate]
    .filter(Boolean).length;
}

/** Adapta o catálogo externo ao contrato de sugestões já usado pelo formulário. */
function toGame(row: ReleaseRow): LaunchBoxGame {
  const year = row.releaseDate?.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? "";
  return {
    id: `openvgdb:${row.releaseID}`,
    source: "openvgdb",
    name: row.releaseTitleName,
    platform: LOCAL_NAMES[row.TEMPsystemName] ?? row.TEMPsystemName,
    release: year,
    developer: row.releaseDeveloper ?? "",
    publisher: row.releasePublisher ?? "",
    genres: row.releaseGenre ?? "",
    overview: row.releaseDescription ?? "",
    players: "",
    rating: "",
    cooperative: "",
    images: []
  };
}

/** Reaproveita o banco baixado e limpa o marcador de operação após sucesso ou falha. */
async function ensureDatabase(): Promise<string> {
  const databaseFile = path.join(getAppUserDataDir(), "openvgdb_cache", "openvgdb.sqlite");
  if ((await fs.stat(databaseFile).catch(() => null))?.size) return databaseFile;
  if (!pendingDatabase) pendingDatabase = downloadDatabase(databaseFile).finally(() => { pendingDatabase = null; });
  return pendingDatabase;
}

/** Baixa a release pública e publica o SQLite somente após validar sua integridade. */
async function downloadDatabase(databaseFile: string): Promise<string> {
  const releaseResponse = await fetch("https://api.github.com/repos/OpenVGDB/OpenVGDB/releases/latest", {
    headers: { "User-Agent": "GameStock", Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(15_000)
  });
  if (!releaseResponse.ok) throw new Error(`OpenVGDB HTTP ${releaseResponse.status}`);
  const release = await releaseResponse.json() as { assets?: Array<{ name: string; size: number; browser_download_url: string }> };
  const asset = release.assets?.find((entry) => entry.name === "openvgdb.zip" && entry.size <= 50_000_000);
  if (!asset || !asset.browser_download_url.startsWith("https://github.com/OpenVGDB/OpenVGDB/releases/download/")) {
    throw new Error("Pacote OpenVGDB não encontrado");
  }
  const zipResponse = await fetch(asset.browser_download_url, { signal: AbortSignal.timeout(30_000) });
  if (!zipResponse.ok) throw new Error(`OpenVGDB HTTP ${zipResponse.status}`);
  const archive = new AdmZip(Buffer.from(await zipResponse.arrayBuffer()));
  const entry = archive.getEntry("openvgdb.sqlite");
  if (!entry || entry.header.size > 100_000_000) throw new Error("SQLite OpenVGDB inválido");
  const bytes = entry.getData();
  if (bytes.subarray(0, 16).toString("utf8") !== "SQLite format 3\0") throw new Error("SQLite OpenVGDB inválido");

  await fs.mkdir(path.dirname(databaseFile), { recursive: true });
  const temporary = `${databaseFile}.tmp`;
  try {
    await fs.writeFile(temporary, bytes);
    // Confere o schema antes de tornar o banco visível a outras consultas.
    const database = new Database(temporary, { readonly: true, fileMustExist: true });
    try {
      database.prepare("SELECT releaseID FROM RELEASES LIMIT 1").get();
    } finally {
      database.close();
    }
    await fs.rename(temporary, databaseFile);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
  }
  return databaseFile;
}

/** Uniformiza a comparação de plataforma e título sem alterar dados persistidos. */
function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
