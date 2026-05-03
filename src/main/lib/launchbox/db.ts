import AdmZip from "adm-zip";
import fs from "node:fs";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { parseStringPromise } from "xml2js";
import { LaunchBoxGame, LaunchBoxProgress } from "../../../shared/types";
import { CACHE_AGE_H, getIndexFile, getLaunchBoxCacheDir, getMetadataFile, METADATA_URL } from "./config";

type ProgressCallback = (progress: LaunchBoxProgress) => void;
type XmlNode = Record<string, unknown>;

let memoryIndex: Record<string, LaunchBoxGame> | null = null;

export async function ensureMetadata(force = false, onProgress?: ProgressCallback): Promise<{ status: "cached" | "downloaded" }> {
  const cacheDir = getLaunchBoxCacheDir();
  const metadataFile = getMetadataFile();
  fs.mkdirSync(cacheDir, { recursive: true });

  if (!force && !needsUpdate(metadataFile)) return { status: "cached" };

  const response = await fetch(METADATA_URL);
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status} ao baixar Metadata.zip`);

  const total = Number(response.headers.get("content-length") ?? 0);
  const zipPath = path.join(cacheDir, "Metadata.zip");
  const dest = createWriteStream(zipPath);
  let downloaded = 0;
  const body = Readable.fromWeb(response.body as never);

  body.on("data", (chunk: Buffer) => {
    downloaded += chunk.length;
    onProgress?.({ current: downloaded, total, filename: "Metadata.zip", status: "downloading" });
  });

  await pipeline(body, dest);

  const zip = new AdmZip(zipPath);
  const entry = zip.getEntries().find((candidate) => candidate.entryName.endsWith(".xml"));
  if (!entry) throw new Error("Metadata.xml nao encontrado no ZIP");
  zip.extractEntryTo(entry, cacheDir, false, true);

  const extracted = path.join(cacheDir, path.basename(entry.entryName));
  if (extracted !== metadataFile) fs.renameSync(extracted, metadataFile);
  fs.rmSync(zipPath, { force: true });
  fs.rmSync(getIndexFile(), { force: true });
  memoryIndex = null;
  onProgress?.({ current: total, total, filename: "Metadata.zip", status: "done" });
  return { status: "downloaded" };
}

export async function buildIndex(onProgress?: ProgressCallback): Promise<Record<string, LaunchBoxGame>> {
  if (memoryIndex) return memoryIndex;

  const indexFile = getIndexFile();
  const metadataFile = getMetadataFile();
  if (!fs.existsSync(metadataFile)) await ensureMetadata(false, onProgress);

  if (fs.existsSync(indexFile)) {
    const xmlMtime = fs.statSync(metadataFile).mtimeMs;
    const idxMtime = fs.statSync(indexFile).mtimeMs;
    if (idxMtime >= xmlMtime) {
      memoryIndex = JSON.parse(fs.readFileSync(indexFile, "utf8")) as Record<string, LaunchBoxGame>;
      return memoryIndex;
    }
  }

  const xml = fs.readFileSync(metadataFile, "utf8");
  const root = await parseStringPromise(xml, { explicitArray: true, trim: true });
  const top = (root.LaunchBox ?? root.Root ?? Object.values(root)[0]) as { Game?: XmlNode[]; GameImage?: XmlNode[] };
  const index: Record<string, LaunchBoxGame> = {};

  for (const game of top.Game ?? []) {
    const id = txt(game.DatabaseID);
    if (!id) continue;
    index[id] = {
      id,
      name: txt(game.Name),
      platform: txt(game.Platform),
      release: txt(game.ReleaseDate).slice(0, 10),
      developer: txt(game.Developer),
      publisher: txt(game.Publisher),
      genres: txt(game.Genres),
      overview: txt(game.Overview),
      players: txt(game.MaxPlayers),
      rating: txt(game.ESRB),
      cooperative: txt(game.Cooperative),
      images: []
    };
  }

  for (const image of top.GameImage ?? []) {
    const id = txt(image.DatabaseID);
    const target = index[id];
    if (!target) continue;
    target.images.push({
      filename: txt(image.FileName),
      type: txt(image.Type) as LaunchBoxGame["images"][number]["type"],
      region: txt(image.Region) || null
    });
  }

  fs.writeFileSync(indexFile, JSON.stringify(index), "utf8");
  memoryIndex = index;
  return index;
}

export function getMetadataDownloadedAt(): string | null {
  const metadataFile = getMetadataFile();
  if (!fs.existsSync(metadataFile)) return null;
  return new Date(fs.statSync(metadataFile).mtimeMs).toISOString();
}

function needsUpdate(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return true;
  const ageMs = Date.now() - fs.statSync(filePath).mtimeMs;
  return ageMs > CACHE_AGE_H * 3_600_000;
}

function txt(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node.trim();
  if (Array.isArray(node)) return String(node[0] ?? "").trim();
  return "";
}
