/**
 * Worker thread responsável por extrair o Metadata.xml do arquivo Metadata.zip do LaunchBox.
 *
 * Executado em thread separada para não bloquear o processo principal durante
 * a descompactação, que pode envolver arquivos de vários megabytes.
 * Recebe os caminhos via `workerData` e comunica progresso/resultado pelo `parentPort`.
 */

import AdmZip from "adm-zip";
import fs from "node:fs";
import path from "node:path";
import { workerData, parentPort } from "node:worker_threads";

// Parâmetros recebidos do processo principal via workerData
const { zipPath, cacheDir, metadataFile } = workerData as {
  /** Caminho do arquivo Metadata.zip baixado. */
  zipPath: string;
  /** Diretório de destino da extração. */
  cacheDir: string;
  /** Caminho final esperado para o Metadata.xml extraído. */
  metadataFile: string;
};

try {
  // Notifica o processo principal que a extração está em andamento
  parentPort!.postMessage({ status: "extracting", current: 0, total: 0, filename: "Extraindo Metadata.zip" });

  const zip = new AdmZip(zipPath);

  // Localiza a primeira entrada XML dentro do ZIP (o Metadata.xml)
  const entry = zip.getEntries().find((e) => e.entryName.endsWith(".xml"));
  if (!entry) throw new Error("Metadata.xml não encontrado no ZIP");

  // Extrai sem preservar estrutura de diretório interno do ZIP
  zip.extractEntryTo(entry, cacheDir, false, true);

  const extracted = path.join(cacheDir, path.basename(entry.entryName));

  // Renomeia para o nome canônico esperado caso o ZIP contenha nome diferente
  if (extracted !== metadataFile) fs.renameSync(extracted, metadataFile);

  // Sinaliza conclusão bem-sucedida ao processo principal
  parentPort!.postMessage({ ok: true });
} catch (err) {
  // Repassa o erro como string para o processo principal tratar
  parentPort!.postMessage({ error: String(err) });
}
