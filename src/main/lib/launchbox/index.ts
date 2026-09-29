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

import { createHash } from "node:crypto";
import path from "node:path";
import { getImagesDir } from "../../db/database";
import { findGameByLaunchBoxId, getCoverStats, getGame, listLaunchBoxLinkedGames, updateGame, upsertLaunchBoxGame } from "../../db/repositories/games";
import { findOrCreatePlatform, getLaunchBoxAliasesForPlatformId, getLaunchBoxAliasesForPlatformName, listPlatforms, resolvePlatformByLaunchBoxName } from "../../db/repositories/platforms";
import { CoverSyncFailureItem, CoverSyncResult, LaunchBoxDownloadParams, LaunchBoxGame, LaunchBoxImage, LaunchBoxImageType, LaunchBoxImportParams, LaunchBoxImportResult, LaunchBoxProgress, LaunchBoxSearchParams } from "../../../shared/types";
import { buildIndex, ensureMetadata, getMetadataDownloadedAt, metadataExists } from "./db";
import { downloadImages, getGameImageDir, searchGames as searchIndex } from "./scraper";
import { downloadLibretroMedia, searchLibretroTitles } from "./libretro";
import { getOpenVgdbGame, searchOpenVgdbGames } from "./openvgdb";

type ProgressCallback = (progress: LaunchBoxProgress) => void;

// Re-exporta constantes e funções utilitárias usadas por outros módulos do main
export { IMAGE_TYPE_LIST } from "./config";
export { ensureMetadata, buildIndex, metadataExists };

/** Retorna a data/hora da última atualização do Metadata.xml, ou `null` se não baixado. */
export function getLaunchBoxMetadataDownloadedAt(): string | null {
  return getMetadataDownloadedAt();
}

/**
 * Busca jogos no LaunchBox e completa lacunas com OpenVGDB e Libretro.
 *
 * Constrói o índice se ainda não estiver em memória.
 * Filtra por plataforma usando aliases registrados no banco quando `platformId`
 * ou `platformName` forem informados.
 */
export async function searchGames(params: LaunchBoxSearchParams) {
  // O ID do cadastro é a fonte da verdade; ID inválido não pode abrir uma busca em todos os consoles.
  const platform = params.platformId != null
    ? listPlatforms().find((entry) => entry.id === params.platformId)
    : null;
  if (params.platformId != null && !platform) return [];
  const platformName = platform?.name ?? params.platformName?.trim() ?? null;
  // A busca do modal exige console definido; a busca geral do importador ainda pode consultar todos.
  if (params.includeAlternatives && !platformName) return [];
  const allowedPlatformNames = platform
    ? getLaunchBoxAliasesForPlatformId(platform.id)
    : platformName
      ? getLaunchBoxAliasesForPlatformName(platformName)
      : null;
  let launchboxResults: LaunchBoxGame[] = [];
  try {
    launchboxResults = searchIndex(await buildIndex(), params.query, allowedPlatformNames);
  } catch (error) {
    if (!params.includeAlternatives) throw error;
    // Uma base LaunchBox indisponível não impede consultar as fontes alternativas.
    console.warn("Busca LaunchBox indisponível; tentando outras fontes", error);
  }
  if (!params.includeAlternatives) return launchboxResults;
  if (launchboxResults.some((game) => [game.name, ...(game.alternateNames ?? [])]
    .some((name) => normalizeTitle(name) === normalizeTitle(params.query)))) return launchboxResults;

  let openVgdbResults: LaunchBoxGame[] = [];
  try {
    openVgdbResults = await searchOpenVgdbGames(params.query, platformName);
  } catch (error) {
    console.warn("Busca OpenVGDB indisponível", error);
  }
  if (launchboxResults.length || openVgdbResults.length) return [...launchboxResults, ...openVgdbResults].slice(0, 100);

  // A Libretro só informa o título e a mídia; o modal indica essa limitação.
  const titles = platformName ? await searchLibretroTitles(params.query, platformName) : [];
  return titles.map((name) => makeLibretroGame(name, platformName!));
}

/** Uniformiza título e nome regional para identificar correspondência exata. */
function normalizeTitle(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Baixa imagens de um jogo LaunchBox para o diretório de mídia local.
 * Completa capas e screenshots indisponíveis no LaunchBox com a Libretro.
 */
export async function downloadLaunchBoxImages(params: LaunchBoxDownloadParams, onProgress?: ProgressCallback) {
  const result = params.game.source && params.game.source !== "launchbox"
    ? { success: 0, skipped: 0, failed: 0, files: [] as string[] }
    : await downloadImages(params.game, getImagesDir(), params.types, onProgress);
  const wantsCover = params.types.length === 0 || params.types.includes("Box - Front");
  const wantsScreenshot = params.types.length === 0 || params.types.includes("Screenshot - Gameplay");
  const missingCover = wantsCover && !result.files.some((file) => file.endsWith("cover.jpg") || file.includes("box-front"));
  const missingScreenshot = wantsScreenshot && !result.files.some((file) => file.includes("screenshot-gameplay"));
  if (missingCover || missingScreenshot) {
    // Mantém o contrato IPC existente: caminhos adicionais entram na lista de arquivos.
    const fallback = await downloadLibretroMedia([params.game.name, ...(params.game.alternateNames ?? [])], params.game.platform,
      getMediaDir(params.game), missingCover, missingScreenshot);
    for (const file of [fallback.coverPath, fallback.screenshotPath]) {
      if (file) {
        result.files.push(file);
        result.success += 1;
      }
    }
    if (fallback.coverPath || fallback.screenshotPath) {
      onProgress?.({ current: 1, total: 1, filename: params.game.name, status: "done" });
    }
  }
  return result;
}

/**
 * Importa um jogo da fonte selecionada para o banco local do GameStock.
 *
 * Fluxo:
 * 1. Resolve o jogo pelo identificador da fonte escolhida.
 * 2. Determina a plataforma de destino (do jogo alvo, dos params ou da fonte).
 * 3. Baixa as imagens selecionadas.
 * 4. Atualiza o jogo existente ou cria um novo registro no banco.
 *
 * @param params - Parâmetros de importação (ID da fonte, jogo alvo, plataforma, tipos de imagem).
 * @param onProgress - Callback de progresso para atualizar a UI.
 */
export async function importGame(params: LaunchBoxImportParams, onProgress?: ProgressCallback): Promise<LaunchBoxImportResult> {
  const game = await resolveImportGame(params.launchboxGameId, onProgress);
  if (!game) throw new Error("Jogo não encontrado na fonte de metadados");

  // Se há jogo alvo, usa a plataforma dele; caso contrário resolve a partir dos params ou do LaunchBox
  const targetGame = params.targetGameId ? getTargetGame(params.targetGameId) : null;
  const platformId = targetGame?.platform_id ?? params.platformId ?? resolvePlatformId(game.platform);

  // Quando há jogo alvo, filtra para baixar apenas as imagens preferidas por tipo
  const downloadGame = targetGame && (!game.source || game.source === "launchbox")
    ? withPreferredImagesOnly(game, params.imageTypes) : game;
  const download = game.source && game.source !== "launchbox"
    ? { files: [] as string[] }
    : await downloadImages(downloadGame, getImagesDir(), params.imageTypes, onProgress);

  // Resolve caminhos de cada tipo de mídia a partir dos arquivos baixados
  let boxArtPath = download.files.find((file) => file.endsWith("cover.jpg")) ?? download.files.find((file) => file.includes("box-front")) ?? null;
  const backgroundPath = download.files.find((file) => file.includes("fanart-background")) ?? null;
  let screenshotPath = download.files.find((file) => file.includes("screenshot-gameplay")) ?? null;
  // Completa tipos ausentes com a Libretro sem trocar a arte já obtida do LaunchBox.
  const wantsCover = params.imageTypes.length === 0 || params.imageTypes.includes("Box - Front");
  const wantsScreenshot = params.imageTypes.length === 0 || params.imageTypes.includes("Screenshot - Gameplay");
  if ((wantsCover && !boxArtPath) || (wantsScreenshot && !screenshotPath)) {
    const fallback = await downloadLibretroMedia([targetGame?.title ?? "", game.name, ...(game.alternateNames ?? [])], game.platform, getMediaDir(game),
      wantsCover && !boxArtPath, wantsScreenshot && !screenshotPath);
    boxArtPath ??= fallback.coverPath;
    screenshotPath ??= fallback.screenshotPath;
    if (fallback.coverPath || fallback.screenshotPath) {
      onProgress?.({ current: 1, total: 1, filename: game.name, status: "done" });
    }
  }
  // Reimportar um jogo sem mídia nova não apaga os caminhos já salvos no SQLite.
  const previousGame = targetGame ?? (!game.source || game.source === "launchbox" ? findGameByLaunchBoxId(game.id, platformId) : null);
  boxArtPath ??= previousGame?.box_art_path ?? null;
  screenshotPath ??= previousGame?.screenshot_path ?? null;
  const year = game.release ? Number(game.release.slice(0, 4)) || null : null;

  const importedData = {
    title: game.name,
    platform_id: platformId,
    publisher: game.publisher || previousGame?.publisher || null,
    year: year ?? previousGame?.year ?? null,
    genre: game.genres || previousGame?.genre || null,
    rating: game.rating || previousGame?.rating || null,
    notes: game.overview || previousGame?.notes || null,
    box_art_path: boxArtPath,
    background_path: backgroundPath ?? previousGame?.background_path ?? null,
    screenshot_path: screenshotPath,
    launchbox_id: !game.source || game.source === "launchbox"
      ? game.id : game.source === "libretro" ? previousGame?.launchbox_id ?? null : null
  };

  if (targetGame) {
    // Quando outro jogo da mesma plataforma já usa este launchbox_id,
    // aplica os metadados no alvo atual como outra versão local, sem duplicar o vínculo.
    const linkedGame = importedData.launchbox_id ? findGameByLaunchBoxId(importedData.launchbox_id, platformId) : null;
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

/** Carrega o registro selecionado da fonte correspondente ao prefixo do ID. */
async function resolveImportGame(id: string, onProgress?: ProgressCallback): Promise<LaunchBoxGame | null> {
  if (id.startsWith("openvgdb:")) return getOpenVgdbGame(id);
  if (id.startsWith("libretro:")) {
    const match = id.match(/^libretro:([^:]+):(.+)$/);
    if (!match) return null;
    return makeLibretroGame(decodeURIComponent(match[2]), decodeURIComponent(match[1]));
  }
  return (await buildIndex(onProgress))[id] ?? null;
}

/** Representa um resultado da Libretro sem prometer metadados textuais inexistentes. */
function makeLibretroGame(name: string, platform: string): LaunchBoxGame {
  return {
    id: `libretro:${encodeURIComponent(platform)}:${encodeURIComponent(name)}`,
    source: "libretro", name, platform,
    release: "", developer: "", publisher: "", genres: "", overview: "",
    players: "", rating: "", cooperative: "", images: []
  };
}

/** Isola mídia externa em pastas com hash estável, sem caracteres inválidos no Windows. */
function getMediaDir(game: LaunchBoxGame): string {
  if (!game.source || game.source === "launchbox") return getGameImageDir(getImagesDir(), game);
  const id = createHash("sha256").update(game.id).digest("hex").slice(0, 20);
  return path.join(getImagesDir(), "external", game.source, id);
}

/**
 * Sincroniza capas e metadados para todos os jogos vinculados ao LaunchBox
 * que ainda não possuem capa (`box_art_path` nulo).
 *
 * Para cada jogo vinculado:
 * - Atualiza metadados textuais (título, publisher, ano, gênero, rating, notas).
 * - Completa capas e screenshots ausentes pelo LaunchBox e, se necessário, pela Libretro.
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
      const needsCover = !gameRecord.box_art_path || refreshAll;
      const needsScreenshot = !gameRecord.screenshot_path;
      if (!needsCover && !needsScreenshot) {
        skipped += 1;
        onProgress?.({ current, total: linkedGames.length, filename: gameRecord.title, status: "skipped" });
        continue;
      }
      // O vínculo pode permanecer no banco mesmo após o catálogo remover o ID.
      const fallback = await downloadLibretroMedia(gameRecord.title, gameRecord.platform_name ?? "",
        path.join(getImagesDir(), "libretro-unindexed", String(gameRecord.id)),
        needsCover, needsScreenshot);
      if (fallback.coverPath || fallback.screenshotPath) {
        updateGame(gameRecord.id, {
          ...(fallback.coverPath ? { box_art_path: fallback.coverPath } : {}),
          ...(fallback.screenshotPath ? { screenshot_path: fallback.screenshotPath } : {})
        });
        if (fallback.coverPath) downloadedNow += 1;
      }
      if (!fallback.coverPath && !gameRecord.box_art_path) {
        failed += 1;
        failures.push({ gameId: gameRecord.id, title: gameRecord.title, platformName: gameRecord.platform_name ?? "Plataforma desconhecida",
          reason: "Jogo ausente no LaunchBox e capa não encontrada na Libretro", launchboxId: gameRecord.launchbox_id });
        onProgress?.({ current, total: linkedGames.length, filename: gameRecord.title, status: "error" });
      } else if (!fallback.coverPath && !fallback.screenshotPath) {
        skipped += 1;
        onProgress?.({ current, total: linkedGames.length, filename: gameRecord.title, status: "skipped" });
      } else {
        onProgress?.({ current, total: linkedGames.length, filename: gameRecord.title, status: "done" });
      }
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

    if (gameRecord.box_art_path && gameRecord.screenshot_path && !refreshAll) {
      // Ambos os tipos já existem; a atualização dos metadados ainda foi aplicada.
      skipped += 1;
      onProgress?.({ current, total: linkedGames.length, filename: gameRecord.title, status: "done" });
    } else {
      const imageTypes: LaunchBoxImageType[] = refreshAll
        ? ["Box - Front", "Fanart - Background", "Screenshot - Gameplay"]
        : [
          ...(!gameRecord.box_art_path ? ["Box - Front" as const] : []),
          ...(!gameRecord.screenshot_path ? ["Screenshot - Gameplay" as const] : [])
        ];
      const download = await downloadImages(launchBoxGame, getImagesDir(), imageTypes, (progress) => {
        onProgress?.({
          current,
          total: linkedGames.length,
          filename: progress.filename ?? gameRecord.title,
          status: progress.status
        });
      }, refreshAll);

      // Prioriza cover.jpg gerado pelo scraper; fallback para qualquer box-front baixado
      let newCoverPath = download.files.find((file) => file.endsWith("cover.jpg")) ?? download.files.find((file) => file.includes("box-front")) ?? null;
      const backgroundPath = download.files.find((file) => file.includes("fanart-background")) ?? null;
      let newScreenshotPath = download.files.find((file) => file.includes("screenshot-gameplay")) ?? null;
      // A Libretro só preenche o tipo que o LaunchBox não conseguiu fornecer.
      if (((!gameRecord.box_art_path || refreshAll) && !newCoverPath) ||
          ((!gameRecord.screenshot_path || refreshAll) && !newScreenshotPath)) {
        const fallback = await downloadLibretroMedia([gameRecord.title, launchBoxGame.name, ...(launchBoxGame.alternateNames ?? [])], launchBoxGame.platform,
          getGameImageDir(getImagesDir(), launchBoxGame),
          (!gameRecord.box_art_path || refreshAll) && !newCoverPath,
          (!gameRecord.screenshot_path || refreshAll) && !newScreenshotPath);
        newCoverPath ??= fallback.coverPath;
        newScreenshotPath ??= fallback.screenshotPath;
      }

      if (newCoverPath || newScreenshotPath || backgroundPath) {
        updateGame(gameRecord.id, {
          ...(newCoverPath ? { box_art_path: newCoverPath } : {}),
          ...(refreshAll && backgroundPath ? { background_path: backgroundPath } : {}),
          ...(newScreenshotPath ? { screenshot_path: newScreenshotPath } : {})
        });
        if (newCoverPath) downloadedNow += 1;
      }
      if (!newCoverPath && !gameRecord.box_art_path) {
        failed += 1;
        failures.push({
          gameId: gameRecord.id,
          title: gameRecord.title,
          platformName: gameRecord.platform_name ?? "Plataforma desconhecida",
          reason: download.failed > 0
            ? "Falha ao baixar capa no LaunchBox e na Libretro"
            : "Capa não encontrada no LaunchBox nem na Libretro",
          launchboxId: gameRecord.launchbox_id
        });
        onProgress?.({ current, total: linkedGames.length, filename: gameRecord.title, status: "error" });
      } else if (!newCoverPath && !newScreenshotPath && !backgroundPath) {
        skipped += 1;
        onProgress?.({ current, total: linkedGames.length, filename: gameRecord.title, status: "skipped" });
      } else {
        onProgress?.({ current, total: linkedGames.length, filename: gameRecord.title, status: "done" });
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
