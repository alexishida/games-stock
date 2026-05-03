import fs from "node:fs";
import { workerData, parentPort } from "node:worker_threads";
import { parseStringPromise } from "xml2js";
import type { LaunchBoxGame } from "../../../shared/types";

type XmlNode = Record<string, unknown>;

function txt(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node.trim();
  if (Array.isArray(node)) return String(node[0] ?? "").trim();
  return "";
}

async function run() {
  const { metadataFile, indexFile } = workerData as { metadataFile: string; indexFile: string };

  const xml = fs.readFileSync(metadataFile, "utf8");
  const root = await parseStringPromise(xml, { explicitArray: true, trim: true });
  const top = (root.LaunchBox ?? root.Root ?? Object.values(root)[0]) as {
    Game?: XmlNode[];
    GameImage?: XmlNode[];
  };
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
  parentPort!.postMessage(index);
}

run().catch((err) => {
  parentPort!.postMessage({ error: String(err) });
});
