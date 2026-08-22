/**
 * Fachada pública da integração com o LaunchBox.
 *
 * Expõe as operações de alto nível consumidas pelos handlers IPC do processo principal:
 * - Garantia e consulta de metadados (download/cache do Metadata.zip)
 * - Busca de jogos no índice
 * - Download de imagens individuais
 * - Importação de um jogo LaunchBox para o banco local
 * - Sincronização de capas ausentes para jogos já vinculados
 */

import { getImagesDir } from "../../db/database";
import { findGameByLaunchBoxId, getCoverStats, getGame, listLaunchBoxLinkedGames, updateGame, upsertLaunchBoxGame } from "../../db/repositories/games";
import { findOrCreatePlatform, getLaunchBoxAliasesForPlatformId, getLaunchBoxAliasesForPlatformName, listPlatforms, resolvePlatformByLaunchBoxName } from "../../db/repositories/platforms";
import { CoverSyncFailureItem, CoverSyncResult, LaunchBoxDownloadParams, LaunchBoxGame, LaunchBoxImage, LaunchBoxImageType, LaunchBoxImportParams, LaunchBoxImportResult, LaunchBoxProgress, LaunchBoxSearchParams } from "../../../shared/types";
import { buildIndex, ensureMetadata, getMetadataDownloadedAt, metadataExists } from "./db";
import { downloadImages, searchGames as searchIndex } from "./scraper";

type ProgressCallback = (progress: LaunchBoxProgress) => void;

// Re-exporta constantes e funções utilitárias usadas por outros módulos do main
export { IMAGE_TYPE_LIST } from "./config";
export { ensureMetadata, buildIndex, metadataExists };

/** Retorna a data/hora da última atualização do Metadata.xml, ou `null` se não baixado. */
export function getLaunchBoxMetadataDownloadedAt(): string | null {
  return getMetadataDownloadedAt();
}

/**
 * Busca jogos no índice LaunchBox.
 *
 * Constrói o índice se ainda não estiver em memória.
 * Filtra por plataforma usando aliases registrados no banco quando `platformId`
 * ou `platformName` forem informados.
 */
export async function searchGames(params: LaunchBoxSearchParams) {
  const index = await buildIndex();
  // Prioriza o ID da plataforma atual para evitar buscas em consoles errados
  // quando o nome visível do jogo não representa bem os aliases salvos.
  const allowedPlatformNames = params.platformId
    ? getLaunchBoxAliasesForPlatformId(params.platformId)
    : params.platformName
      ? getLaunchBoxAliasesForPlatformName(params.platformName)
      : null;
  return searchIndex(index, params.query, allowedPlatformNames);
}

/**
 * Baixa imagens de um jogo LaunchBox para o diretório de mídia local.
 * Delega ao scraper com os parâmetros fornecidos pelo renderer.
 */
export async function downloadLaunchBoxImages(params: LaunchBoxDownloadParams, onProgress?: ProgressCallback) {
  return downloadImages(params.game, getImagesDir(), params.types, onProgress);
}

/**
 * Importa um jogo do LaunchBox para o banco local do GameStock.
 *
 * Fluxo:
 * 1. Busca o jogo no índice pelo `launchboxGameId`.
 * 2. Determina a plataforma de destino (do jogo alvo, dos params ou do LaunchBox).
 * 3. Baixa as imagens selecionadas.
 * 4. Atualiza o jogo existente ou cria um novo registro no banco.
 *
 * @param params - Parâmetros de importação (ID LaunchBox, jogo alvo, plataforma, tipos de imagem).
 * @param onProgress - Callback de progresso para atualizar a UI.
 */
export async function importGame(params: LaunchBoxImportParams, onProgress?: ProgressCallback): Promise<LaunchBoxImportResult> {
  const index = await buildIndex(onProgress);
  const game = index[params.launchboxGameId];
  if (!game) throw new Error("Jogo LaunchBox não encontrado");

  // Se há jogo alvo, usa a plataforma dele; caso contrário resolve a partir dos params ou do LaunchBox
  const targetGame = params.targetGameId ? getTargetGame(params.targetGameId) : null;
  const platformId = targetGame?.platform_id ?? params.platformId ?? resolvePlatformId(game.platform);

  // Quando há jogo alvo, filtra para baixar apenas as imagens preferidas por tipo
  const downloadGame = targetGame ? withPreferredImagesOnly(game, params.imageTypes) : game;
  const download = await downloadImages(downloadGame, getImagesDir(), params.imageTypes, onProgress);

  // Resolve caminhos de cada tipo de mídia a partir dos arquivos baixados
  const boxArtPath = download.files.find((file) => file.endsWith("cover.jpg")) ?? download.files.find((file) => file.includes("box-front")) ?? download.files[0] ?? null;
  const backgroundPath = download.files.find((file) => file.includes("fanart-background")) ?? null;
  const screenshotPath = download.files.find((file) => file.includes("screenshot-gameplay")) ?? null;
  const year = game.release ? Number(game.release.slice(0, 4)) || null : null;

  const importedData = {
    title: game.name,
    platform_id: platformId,
    publisher: game.publisher || null,
    year,
    genre: game.genres || null,
    rating: game.rating || null,
    notes: game.overview || null,
    box_art_path: boxArtPath,
    background_path: backgroundPath,
    screenshot_path: screenshotPath,
    launchbox_id: game.id
  };

  if (targetGame) {
    // Quando outro jogo da mesma plataforma já usa este launchbox_id,
    // aplica os metadados no alvo atual como outra versão local, sem duplicar o vínculo.
    const linkedGame = findGameByLaunchBoxId(game.id, platformId);
    const duplicateBelongsToAnotherGame = Boolean(linkedGame && linkedGame.id !== targetGame.id);
    const saved = updateGame(targetGame.id, {
      ...importedData,
      launchbox_id: duplicateBelongsToAnotherGame ? null : importedData.launchbox_id
    });
    return {
      gameId: saved.id,
      created: false,
      boxArtPath,
      linkedAsVariant: duplicateBelongsToAnotherGame
    };
  }

  // Cria ou atualiza registro via upsert por launchbox_id
  const saved = upsertLaunchBoxGame({
    ...importedData,
    favorite: false,
    play_status: "unplayed",
    rom_path: null
  });

  return { gameId: saved.game.id, created: saved.created, boxArtPath };
}

/**
 * Sincroniza capas e metadados para todos os jogos vinculados ao LaunchBox
 * que ainda não possuem capa (`box_art_path` nulo).
 *
 * Para cada jogo vinculado:
 * - Atualiza metadados textuais (título, publisher, ano, gênero, rating, notas).
 * - Se não houver capa, tenta baixar a imagem "Box - Front".
 *
 * @param onProgress - Callback de progresso chamado por jogo processado.
 * @param refreshAll - Força atualização de capa, fanart e screenshot vinculados ao LaunchBox.
 */
export async function syncMissingCovers(onProgress?: ProgressCallback, refreshAll = false): Promise<CoverSyncResult> {
  const linkedGames = listLaunchBoxLinkedGames();
  const index = await buildIndex(onProgress);
  let downloadedNow = 0;
  let failed = 0;
  let skipped = 0;
  let metadataUpdated = 0;
  let metadataSkipped = 0;
  const failures: CoverSyncFailureItem[] = [];

  for (let i = 0; i < linkedGames.length; i += 1) {
    const gameRecord = linkedGames[i];
    const launchBoxId = gameRecord.launchbox_id;
    const launchBoxGame = launchBoxId ? index[launchBoxId] : null;
    const current = i + 1;

    if (!launchBoxGame) {
      // Jogo não encontrado no índice (ID removido do LaunchBox ou metadados desatualizados)
      metadataSkipped += 1;
      if (!gameRecord.box_art_path) skipped += 1;
      onProgress?.({ current, total: linkedGames.length, filename: gameRecord.title, status: "skipped" });
      continue;
    }

    // Atualiza metadados textuais independentemente de já ter capa
    updateGame(gameRecord.id, {
      title: launchBoxGame.name || gameRecord.title,
      publisher: launchBoxGame.publisher || null,
      year: launchBoxGame.release ? Number(launchBoxGame.release.slice(0, 4)) || null : null,
      genre: launchBoxGame.genres || null,
      rating: launchBoxGame.rating || null,
      notes: launchBoxGame.overview || null
    });
    metadataUpdated += 1;

    if (gameRecord.box_art_path && !refreshAll) {
      // Já possui capa; não precisa baixar novamente
      onProgress?.({ current, total: linkedGames.length, filename: gameRecord.title, status: "done" });
    } else {
      const boxFrontImages = launchBoxGame.images.filter((image) => image.type === "Box - Front");
      if (!boxFrontImages.length) {
        // LaunchBox não tem nenhuma imagem Box - Front para este jogo
        failed += 1;
        failures.push({
          gameId: gameRecord.id,
          title: gameRecord.title,
          platformName: gameRecord.platform_name ?? "Plataforma desconhecida",
          reason: "LaunchBox sem imagem Box - Front para este jogo",
          launchboxId: gameRecord.launchbox_id
        });
        onProgress?.({ current, total: linkedGames.length, filename: gameRecord.title, status: "error" });
        continue;
      }

      const imageTypes: LaunchBoxImageType[] = refreshAll
        ? ["Box - Front", "Fanart - Background", "Screenshot - Gameplay"]
        : ["Box - Front"];
      const download = await downloadImages(launchBoxGame, getImagesDir(), imageTypes, (progress) => {
        onProgress?.({
          current,
          total: linkedGames.length,
          filename: progress.filename ?? gameRecord.title,
          status: progress.status
        });
      }, refreshAll);

      // Prioriza cover.jpg gerado pelo scraper; fallback para qualquer box-front baixado
      const boxArtPath = download.files.find((file) => file.endsWith("cover.jpg")) ?? download.files.find((file) => file.includes("box-front")) ?? null;

      if (boxArtPath) {
        const backgroundPath = download.files.find((file) => file.includes("fanart-background")) ?? null;
        const screenshotPath = download.files.find((file) => file.includes("screenshot-gameplay")) ?? null;
        updateGame(gameRecord.id, {
          box_art_path: boxArtPath,
          ...(refreshAll && backgroundPath ? { background_path: backgroundPath } : {}),
          ...(refreshAll && screenshotPath ? { screenshot_path: screenshotPath } : {})
        });
        downloadedNow += 1;
      } else {
        failed += 1;
        failures.push({
          gameId: gameRecord.id,
          title: gameRecord.title,
          platformName: gameRecord.platform_name ?? "Plataforma desconhecida",
          reason: download.failed > 0
            ? "Falha ao baixar imagem Box - Front"
            : "Imagem baixada, mas capa principal nao foi identificada",
          launchboxId: gameRecord.launchbox_id
        });
      }
    }
  }

  return {
    ...getCoverStats(),
    attempted: linkedGames.length,
    downloadedNow,
    failed,
    skipped,
    metadataUpdated,
    metadataSkipped,
    failures
  };
}

/**
 * Resolve o ID de plataforma local a partir de um nome de plataforma do LaunchBox.
 *
 * Tentativas em ordem:
 * 1. Alias registrado no banco para o nome LaunchBox.
 * 2. Correspondência exata de nome (case-insensitive).
 * 3. Criação de nova plataforma com o nome do LaunchBox.
 */
function resolvePlatformId(launchBoxPlatform: string): number {
  const existing = resolvePlatformByLaunchBoxName(launchBoxPlatform);
  if (existing) return existing.id;

  const platforms = listPlatforms();
  const byName = platforms.find((platform) => platform.name.toLowerCase() === launchBoxPlatform.toLowerCase());
  return byName?.id ?? findOrCreatePlatform(launchBoxPlatform).id;
}

/**
 * Retorna o registro do jogo alvo a partir do ID fornecido.
 * Busca primeiro entre os jogos vinculados ao LaunchBox; fallback para busca geral.
 */
function getTargetGame(targetGameId: number) {
  const game = listLaunchBoxLinkedGames().find((entry) => entry.id === targetGameId);
  if (game) return game;
  const selected = getGame(targetGameId);
  if (!selected) throw new Error("Jogo de destino não encontrado");
  return selected;
}

/**
 * Retorna uma cópia do jogo com apenas as imagens preferidas por tipo.
 * Para "Box - Front", aplica prioridade de região antes de selecionar uma imagem.
 */
function withPreferredImagesOnly(game: LaunchBoxGame, types: LaunchBoxImageType[]): LaunchBoxGame {
  const selected = types
    .map((type) => selectPreferredImage(game.images.filter((image) => image.type === type), type))
    .filter(Boolean) as LaunchBoxImage[];
  return { ...game, images: selected };
}

/**
 * Seleciona a imagem preferida de uma lista do mesmo tipo.
 * Para "Box - Front", aplica ordem de prioridade de região (Brasil primeiro).
 * Para outros tipos, retorna a primeira imagem disponível.
 */
function selectPreferredImage(images: LaunchBoxImage[], type: LaunchBoxImageType): LaunchBoxImage | null {
  if (!images.length) return null;
  if (type === "Box - Front") {
    const regionPriority = ["brazil", "north america", "north-america", "united states", "world", "europe"];
    for (const region of regionPriority) {
      const match = images.find((image) => (image.region ?? "").toLowerCase() === region);
      if (match) return match;
    }
  }
  return images[0];
}

/**
 * Garante que os metadados LaunchBox estejam baixados e, se houve novo download,
 * reconstrói o índice em memória imediatamente.
 *
 * @param force - Força re-download mesmo que o cache seja recente.
 * @param onProgress - Callback de progresso para atualizar a UI.
 */
export async function ensureLaunchBoxMetadata(force = false, onProgress?: ProgressCallback) {
  const result = await ensureMetadata(force, onProgress);
  if (result.status === "downloaded") {
    // Reconstrói índice imediatamente após novo download para manter memoryIndex atualizado
    await buildIndex(onProgress);
    onProgress?.({ current: 1, total: 1, status: "done", filename: "Metadata.zip" });
  }
  return result;
}
