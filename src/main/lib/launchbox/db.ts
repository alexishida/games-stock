import fs from "node:fs";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Worker } from "node:worker_threads";
import type { LaunchBoxGame, LaunchBoxProgress } from "../../../shared/types";
import { CACHE_AGE_H, getIndexFile, getLaunchBoxCacheDir, getMetadataFile, METADATA_URL } from "./config";

type ProgressCallback = (progress: LaunchBoxProgress) => void;

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

  await runExtractWorker(zipPath, cacheDir, metadataFile, onProgress);

  fs.rmSync(zipPath, { force: true });
  fs.rmSync(getIndexFile(), { force: true });
  memoryIndex = null;
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

  memoryIndex = await runIndexWorker(metadataFile, indexFile, onProgress);
  return memoryIndex;
}

export function metadataExists(): boolean {
  return fs.existsSync(getMetadataFile());
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

function runExtractWorker(zipPath: string, cacheDir: string, metadataFile: string, onProgress?: ProgressCallback): Promise<void> {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, "extract-worker.js");
    const worker = new Worker(workerPath, { workerData: { zipPath, cacheDir, metadataFile } });
    worker.on("message", (result: { ok?: boolean; error?: string; status?: string }) => {
      if (result.status) {
        onProgress?.(result as Parameters<ProgressCallback>[0]);
      } else if (result.error) {
        reject(new Error(result.error));
      } else {
        resolve();
      }
    });
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Extract worker saiu com codigo ${code}`));
    });
  });
}

function runIndexWorker(metadataFile: string, indexFile: string, onProgress?: ProgressCallback): Promise<Record<string, LaunchBoxGame>> {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, "index-worker.js");
    const worker = new Worker(workerPath, { workerData: { metadataFile, indexFile } });
    worker.on("message", (result: Record<string, LaunchBoxGame> | { error: string; status?: never } | { status: string }) => {
      if ("status" in result && result.status) {
        onProgress?.(result as Parameters<ProgressCallback>[0]);
      } else if ("error" in result) {
        reject(new Error((result as { error: string }).error));
      } else {
        resolve(result as Record<string, LaunchBoxGame>);
      }
    });
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Index worker saiu com codigo ${code}`));
    });
  });
}
