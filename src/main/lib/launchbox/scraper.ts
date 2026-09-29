/**
 * Busca e download de imagens do catálogo LaunchBox.
 *
 * Fornece duas operações principais:
 * - `searchGames`: pesquisa textual no índice em memória, com filtro opcional por plataforma.
 * - `downloadImages`: baixa imagens de um jogo LaunchBox para o diretório local de mídia,
 *   gerando também uma prévia de capa padronizada (cover.jpg) via sharp.
 */

import fs from "node:fs";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";
import { getImagesDir } from "../../db/database";
import { LaunchBoxDownloadResult, LaunchBoxGame, LaunchBoxImageType, LaunchBoxProgress } from "../../../shared/types";
import { IMAGES_BASE } from "./config";

type ProgressCallback = (progress: LaunchBoxProgress) => void;

/** Guarda nomes normalizados sem copiar imagens ou outros metadados do catálogo. */
interface SearchEntry {
  game: LaunchBoxGame;
  names: string[];
  platform: string;
}

/** Índice derivado em ordem alfabética, com acesso direto por plataforma. */
interface SearchIndex {
  entries: SearchEntry[];
  platforms: Map<string, SearchEntry[]>;
}

/** O catálogo é substituído após atualização; WeakMap libera a versão antiga junto com ele. */
const searchIndexes = new WeakMap<Record<string, LaunchBoxGame>, SearchIndex>();

/** Normaliza e ordena uma vez por catálogo, evitando repetir o trabalho a cada busca. */
function getSearchIndex(index: Record<string, LaunchBoxGame>): SearchIndex {
  const cached = searchIndexes.get(index);
  if (cached) return cached;
  const entries = Object.values(index)
    .map((game) => ({
      game,
      names: [game.name, ...(game.alternateNames ?? [])].map(normalizeSearchText),
      platform: normalizeSearchText(game.platform)
    }))
    .sort((a, b) => a.game.name.localeCompare(b.game.name));
  const platforms = new Map<string, SearchEntry[]>();
  for (const entry of entries) {
    const games = platforms.get(entry.platform);
    if (games) games.push(entry);
    else platforms.set(entry.platform, [entry]);
  }
  const prepared = { entries, platforms };
  searchIndexes.set(index, prepared);
  return prepared;
}

/**
 * Busca jogos no índice LaunchBox por texto, com filtro opcional de plataforma.
 *
 * @param index - Índice completo de jogos (DatabaseID → LaunchBoxGame).
 * @param queryText - Texto de busca; comparado contra o nome do jogo (case-insensitive).
 * @param allowedPlatformNames - Nomes/aliases aceitos; `null` aceita todas as plataformas e lista vazia não aceita nenhuma.
 * @returns Lista de até 100 jogos ordenados por nome.
 */
export function searchGames(
  index: Record<string, LaunchBoxGame>,
  queryText: string,
  allowedPlatformNames: string[] | null = null
): LaunchBoxGame[] {
  const query = normalizeSearchText(queryText);
  if (!query) return [];

  const allowedPlatforms = allowedPlatformNames === null ? null : new Set(allowedPlatformNames.map(normalizeSearchText));
  if (allowedPlatforms?.size === 0) return [];
  const prepared = getSearchIndex(index);
  // A busca por um único console não precisa percorrer os jogos das outras plataformas.
  const candidates = allowedPlatforms?.size === 1
    ? prepared.platforms.get([...allowedPlatforms][0]) ?? []
    : prepared.entries;
  const exact: LaunchBoxGame[] = [];
  const partial: LaunchBoxGame[] = [];
  for (const entry of candidates) {
    if (allowedPlatforms && !allowedPlatforms.has(entry.platform)) continue;
    if (entry.names.includes(query)) {
      exact.push(entry.game);
      if (exact.length === 100) break;
    } else if (partial.length < 100 && entry.names.some((name) => name.includes(query))) {
      partial.push(entry.game);
    }
  }
  // As duas listas já estão ordenadas; nomes regionais exatos continuam tendo prioridade.
  return exact.concat(partial).slice(0, 100);
}

/** Ignora acentos e pontuação sem trocar a ordem das palavras na busca. */
function normalizeSearchText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Baixa as imagens de um jogo LaunchBox para o diretório local de mídia.
 *
 * - Pula imagens já existentes no disco (cache local por nome de arquivo).
 * - Após o download, gera automaticamente um `cover.jpg` redimensionado via sharp.
 * - Salva `metadata.json` com os dados do jogo no diretório de imagens.
 *
 * @param game - Dados do jogo LaunchBox incluindo lista de imagens.
 * @param outputDir - Diretório raiz onde as imagens serão armazenadas.
 * @param types - Tipos de imagem a baixar; vazio baixa todos os tipos disponíveis.
 * @param onProgress - Callback de progresso chamado por imagem processada.
 * @param force - Baixa novamente mesmo quando o arquivo já existe localmente.
 */
export async function downloadImages(
  game: LaunchBoxGame,
  outputDir = getImagesDir(),
  types: LaunchBoxImageType[] = [],
  onProgress?: ProgressCallback,
  force = false
): Promise<LaunchBoxDownloadResult> {
  // Filtra imagens pelos tipos solicitados, ou usa todas se nenhum tipo for especificado
  const images = types.length ? game.images.filter((image) => types.includes(image.type)) : game.images;
  const gameDir = getGameImageDir(outputDir, game);
  fs.mkdirSync(gameDir, { recursive: true });

  const result: LaunchBoxDownloadResult = { success: 0, skipped: 0, failed: 0, files: [] };

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const filename = getImageFilename(image, index);
    const dest = path.join(gameDir, filename);
    const current = index + 1;

    // Imagem já existe localmente; apenas adiciona ao resultado sem baixar novamente
    if (!force && fs.existsSync(dest)) {
      result.skipped += 1;
      result.files.push(dest);
      onProgress?.({ current, total: images.length, filename, status: "skipped" });
      continue;
    }

    // Só publica o arquivo completo; uma atualização com falha preserva a imagem anterior.
    const temporary = `${dest}.${randomUUID()}.tmp`;
    try {
      onProgress?.({ current, total: images.length, filename, status: "downloading" });
      const response = await fetch(IMAGES_BASE + image.filename, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      // O timeout também interrompe o corpo da resposta quando a transferência fica parada.
      await pipeline(Readable.fromWeb(response.body as never), createWriteStream(temporary));
      await fs.promises.rename(temporary, dest);

      result.success += 1;
      result.files.push(dest);
      onProgress?.({ current, total: images.length, filename, status: "done" });
    } catch {
      result.failed += 1;
      onProgress?.({ current, total: images.length, filename, status: "error" });
    } finally {
      // Limpa apenas o temporário desta transferência, inclusive em downloads concorrentes.
      await fs.promises.rm(temporary, { force: true }).catch(() => undefined);
    }
  }

  // Gera cover.jpg padronizado a partir do melhor box-front disponível
  const coverPath = await ensureCoverPreview(gameDir, result.files);
  if (coverPath && !result.files.includes(coverPath)) result.files.unshift(coverPath);

  // Persiste metadados do jogo junto às imagens para referência futura
  fs.writeFileSync(path.join(gameDir, "metadata.json"), JSON.stringify(game, null, 2), "utf8");
  return result;
}

/**
 * Retorna o diretório de imagens de um jogo específico dentro do diretório raiz.
 * Estrutura: `outputDir/<plataforma-sanitizada>/<nome-sanitizado>-<id>/`
 *
 * O sufixo com o ID do LaunchBox evita que jogos distintos com o mesmo nome
 * sanitizado (ex.: "Ghouls 'n Ghosts (USA)" e "(Europe)") compartilhem pasta
 * e roubem a arte um do outro.
 */
export function getGameImageDir(outputDir: string, game: Pick<LaunchBoxGame, "name" | "platform" | "id">): string {
  const idSuffix = game.id ? `-${game.id}` : "";
  return path.join(outputDir, sanitize(game.platform || "unknown-platform"), `${sanitize(game.name)}${idSuffix}`);
}

/**
 * Sanitiza uma string para uso seguro como nome de diretório/arquivo:
 * lowercase, apenas alfanuméricos e espaços → hífens, máximo 120 caracteres.
 */
function sanitize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

/**
 * Gera o nome de arquivo para uma imagem LaunchBox baseado em tipo e região.
 * Todos os tipos incluem índice numérico para evitar colisão quando o catálogo
 * traz múltiplas imagens do mesmo tipo+região (screenshots/fanarts repetidos).
 */
function getImageFilename(image: Pick<LaunchBoxGame["images"][number], "filename" | "region" | "type">, index: number): string {
  const ext = path.extname(image.filename) || ".jpg";
  return `${slug(image.type)}-${slug(image.region || "no_region")}-${String(index + 1).padStart(2, "0")}${ext}`;
}

/**
 * Ordem de preferência de região para seleção do box-front principal.
 * Brasil tem prioridade para localização, seguido por mercados maiores.
 */
const BOX_FRONT_REGION_PRIORITY = ["brazil", "north-america", "europe", "world", "united-states", "no_region"];

/**
 * Garante que exista um `cover.jpg` no diretório do jogo, gerado via sharp
 * a partir do box-front de maior prioridade de região disponível.
 *
 * - Imagem portrait: redimensionada para 195×280 (mantém proporção).
 * - Imagem landscape: redimensionada para 280×195 (mantém proporção).
 * - Retorna o caminho do cover.jpg ou `null` se não houver box-front.
 */
async function ensureCoverPreview(gameDir: string, files: string[]): Promise<string | null> {
  const boxArtFiles = files.filter((file) => {
    const filename = path.basename(file).toLowerCase();
    return filename.startsWith("box-front-") || filename.startsWith("box-front-reconstructed-");
  });
  if (!boxArtFiles.length) return null;

  const selected = selectPreferredBoxArt(boxArtFiles);
  if (!selected) return null;

  const coverPath = path.join(gameDir, "cover.jpg");
  const metadata = await sharp(selected).metadata();
  // Determina orientação para escolher dimensão-alvo adequada
  const isLandscape = (metadata.width ?? 0) > (metadata.height ?? 0);
  const size = isLandscape ? { width: 280, height: 195 } : { width: 195, height: 280 };
  await sharp(selected).resize({ ...size, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toFile(coverPath);

  return coverPath;
}

/**
 * Seleciona o arquivo de box-front de maior prioridade de região
 * a partir da lista de arquivos baixados.
 */
function selectPreferredBoxArt(files: string[]): string | null {
  for (const region of BOX_FRONT_REGION_PRIORITY) {
    const match = files.find((file) => path.basename(file).toLowerCase().includes(`box-front-${region}-`));
    if (match) return match;
  }

  // Fallback: primeiro arquivo disponível
  return files[0] ?? null;
}

/**
 * Converte uma string em slug para uso em nomes de arquivo:
 * lowercase, separa palavras com hífens, máximo 120 caracteres.
 */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 120);
}
