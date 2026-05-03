import AdmZip from "adm-zip";
import fs from "node:fs";
import path from "node:path";
import { workerData, parentPort } from "node:worker_threads";

const { zipPath, cacheDir, metadataFile } = workerData as {
  zipPath: string;
  cacheDir: string;
  metadataFile: string;
};

try {
  const zip = new AdmZip(zipPath);
  const entry = zip.getEntries().find((e) => e.entryName.endsWith(".xml"));
  if (!entry) throw new Error("Metadata.xml nao encontrado no ZIP");
  zip.extractEntryTo(entry, cacheDir, false, true);
  const extracted = path.join(cacheDir, path.basename(entry.entryName));
  if (extracted !== metadataFile) fs.renameSync(extracted, metadataFile);
  parentPort!.postMessage({ ok: true });
} catch (err) {
  parentPort!.postMessage({ error: String(err) });
}
