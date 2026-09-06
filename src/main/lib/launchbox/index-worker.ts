/**
 * Worker thread responsável por construir o índice JSON a partir do Metadata.xml do LaunchBox.
 *
 * Lê e parseia o XML (que pode ter centenas de megabytes) em thread separada para
 * não travar o processo principal. O índice resultante é um dicionário com chave
 * DatabaseID → LaunchBoxGame, incluindo as imagens associadas a cada jogo.
 * Ao concluir, grava o índice em disco (index.json) e o envia via `parentPort`.
 */

import fs from "node:fs";
import { workerData, parentPort } from "node:worker_threads";
import { parseStringPromise } from "xml2js";
import type { LaunchBoxGame } from "../../../shared/types";

/** Tipo genérico para nós do XML parseado pelo xml2js. */
type XmlNode = Record<string, unknown>;

/**
 * Extrai o valor textual de um nó XML parseado pelo xml2js.
 * O xml2js envolve valores em arrays; esta função normaliza para string simples.
 */
function txt(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node.trim();
  if (Array.isArray(node)) return String(node[0] ?? "").trim();
  return "";
}

/** Função principal do worker: parseia o XML e constrói o índice. */
async function run() {
  const { metadataFile, indexFile } = workerData as {
    /** Caminho do Metadata.xml já extraído. */
    metadataFile: string;
    /** Caminho onde o index.json será gravado. */
    indexFile: string;
  };

  // Leitura e JSON.parse ficam no worker: cache grande também pode congelar o main.
  // Cache parcial/corrompido é descartável; o XML permanece como fonte para reparo.
  if (fs.existsSync(indexFile)) {
    try {
      if (fs.statSync(indexFile).mtimeMs >= fs.statSync(metadataFile).mtimeMs) {
        const cached: unknown = JSON.parse(fs.readFileSync(indexFile, "utf8"));
        if (cached && typeof cached === "object" && !Array.isArray(cached)) {
          parentPort!.postMessage(cached);
          return;
        }
      }
    } catch (error) {
      console.warn("Cache do LaunchBox inválido; reconstruindo a partir do XML", error);
    }
  }

  // Notifica o processo principal que a indexação começou
  parentPort!.postMessage({ status: "indexing", current: 0, total: 0, filename: "Construindo índice" });

  const xml = fs.readFileSync(metadataFile, "utf8");
  const root = await parseStringPromise(xml, { explicitArray: true, trim: true });

  // Suporta diferentes raízes XML que o LaunchBox pode usar
  const top = (root.LaunchBox ?? root.Root ?? Object.values(root)[0]) as {
    Game?: XmlNode[];
    GameImage?: XmlNode[];
  };

  // Índice final: DatabaseID → LaunchBoxGame
  const index: Record<string, LaunchBoxGame> = {};

  // Primeira passagem: indexa todos os jogos pelo DatabaseID
  for (const game of top.Game ?? []) {
    const id = txt(game.DatabaseID);
    if (!id) continue;
    index[id] = {
      id,
      name: txt(game.Name),
      platform: txt(game.Platform),
      // Apenas a parte da data (YYYY-MM-DD); descarta hora
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

  // Segunda passagem: associa imagens ao jogo correspondente pelo DatabaseID
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

  // Persiste o índice em disco para reuso entre sessões
  fs.writeFileSync(indexFile, JSON.stringify(index), "utf8");

  // Envia o índice completo de volta ao processo principal
  parentPort!.postMessage(index);
}

run().catch((err) => {
  // Repassa erro de parsing/IO ao processo principal
  parentPort!.postMessage({ error: String(err) });
});
