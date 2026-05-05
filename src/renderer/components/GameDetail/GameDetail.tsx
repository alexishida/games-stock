import { type MouseEvent, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Download, Gamepad2, Image, Library, Monitor, Pencil, Play, Star, Trash2, Trophy, X } from "lucide-react";
import { GameMediaItem, PlatformEmulator } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { localMediaUrl } from "../../utils/media";
import { GameForm } from "./GameForm";
import "./GameDetail.css";

export function GameDetail() {
  const games = useGameStockStore((state) => state.games);
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  const selectedGame = useGameStockStore((state) => state.selectedGame);
  const setSelectedGameId = useGameStockStore((state) => state.setSelectedGameId);
  const setSelectedGame = useGameStockStore((state) => state.setSelectedGame);
  const upsertGame = useGameStockStore((state) => state.upsertGame);
  const removeGameFromStore = useGameStockStore((state) => state.removeGame);
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const reloadToken = useGameStockStore((state) => state.reloadToken);
  const platformsReloadToken = useGameStockStore((state) => state.platformsReloadToken);
  const game = selectedGame;
  const coverUrl = localMediaUrl(game?.box_art_path);
  const screenshotUrl = localMediaUrl(game?.screenshot_path);
  const backgroundUrl = localMediaUrl(game?.background_path);
  const heroBgUrl = backgroundUrl ?? coverUrl;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCoverLandscape, setIsCoverLandscape] = useState(false);
  const [mediaItems, setMediaItems] = useState<GameMediaItem[]>([]);
  const [defaultEmulator, setDefaultEmulator] = useState<PlatformEmulator | null>(null);
  const [emulatorLoading, setEmulatorLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");

  useEffect(() => {
    setIsCoverLandscape(false);
    setLightboxIndex(null);
    setLaunchError("");
    setLaunching(false);
  }, [selectedGameId]);

  useEffect(() => {
    let canceled = false;
    if (!selectedGameId) {
      setSelectedGame(null);
      return undefined;
    }

    window.gameStockAPI.games
      .get(selectedGameId)
      .then((nextGame) => {
        if (!canceled) setSelectedGame(nextGame);
      })
      .catch(() => {});

    return () => {
      canceled = true;
    };
  }, [reloadToken, selectedGameId, setSelectedGame]);

  useEffect(() => {
    let canceled = false;
    setMediaItems([]);
    if (!selectedGameId) return undefined;

    window.gameStockAPI.games
      .listMedia(selectedGameId)
      .then((items) => {
        if (!canceled) setMediaItems(items);
      })
      .catch(() => {
        if (!canceled) setMediaItems([]);
      });

    return () => {
      canceled = true;
    };
  }, [selectedGameId]);

  useEffect(() => {
    let canceled = false;
    setDefaultEmulator(null);
    if (!game?.platform_id) {
      setEmulatorLoading(false);
      return undefined;
    }

    setEmulatorLoading(true);
    window.gameStockAPI.emulators
      .listByPlatform(game.platform_id)
      .then((items) => {
        if (!canceled) setDefaultEmulator(items.find((item) => item.is_default === 1) ?? null);
      })
      .catch(() => {
        if (!canceled) setDefaultEmulator(null);
      })
      .finally(() => {
        if (!canceled) setEmulatorLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [game?.platform_id, platformsReloadToken]);

  if (!game) {
    return (
      <section className="game-detail">
        <div className="detail-empty">
          <button type="button" className="detail-back-inline" onClick={() => setSelectedGameId(null)}>
            Voltar para biblioteca
          </button>
        </div>
      </section>
    );
  }

  const currentGame = game;
  const publisher = game.publisher || "Publisher não informado";
  const genre = game.genre || "Gênero não informado";
  const year = game.year?.toString() ?? "Ano não informado";
  const overview = game.notes?.trim() || "Sem descrição cadastrada para este jogo.";
  const fileName = game.rom_path?.split(/[\\/]/).pop() ?? "ROM não associada";
  const hasRom = Boolean(game.rom_path?.trim());
  const hasDefaultEmulator = Boolean(defaultEmulator);
  const canLaunchGame = hasRom && hasDefaultEmulator && !emulatorLoading;
  const playButtonTitle = launchError || getPlayButtonTitle(hasRom, emulatorLoading, defaultEmulator);
  const completedActive = game.play_status === "completed";
  const playingActive = game.play_status === "playing";
  const fallbackMediaItems = [
    backgroundUrl ? { path: game.background_path!, label: "Background", kind: "background" as const } : null
  ].filter(Boolean) as GameMediaItem[];
  const galleryItems = (mediaItems.length ? mediaItems : fallbackMediaItems).filter((item) => item.kind !== "screenshot");
  const saveNamePrefix = `${sanitizeFileNamePart(game.platform_name ?? "Sem plataforma")} - ${sanitizeFileNamePart(game.title)}`;
  const lightboxImages = [
    screenshotUrl && game.screenshot_path ? { url: screenshotUrl, path: game.screenshot_path, label: "Screenshot", fileName: buildSaveFileName(saveNamePrefix, getFileName(game.screenshot_path, "screenshot")) } : null,
    ...galleryItems.map((item) => {
      const url = localMediaUrl(item.path);
      return url ? { url, path: item.path, label: item.label, fileName: buildSaveFileName(saveNamePrefix, getFileName(item.path, item.label)) } : null;
    })
  ].filter(Boolean) as Array<{ url: string; path: string; label: string; fileName: string }>;
  const lightboxItem = lightboxIndex === null ? null : lightboxImages[lightboxIndex] ?? null;

  async function deleteGame(): Promise<void> {
    if (!game) return;
    if (!window.confirm(`Excluir "${game.title}" da biblioteca?`)) return;
    await window.gameStockAPI.games.delete(game.id);
    removeGameFromStore(game.id);
    reloadGames();
  }

  async function toggleFavorite(): Promise<void> {
    const updated = await window.gameStockAPI.games.update(currentGame.id, { favorite: !currentGame.favorite });
    upsertGame(updated);
    reloadGames();
  }

  async function togglePlayStatus(status: typeof currentGame.play_status): Promise<void> {
    const updated = await window.gameStockAPI.games.update(currentGame.id, { play_status: currentGame.play_status === status ? "unplayed" : status });
    upsertGame(updated);
    reloadGames();
  }

  async function launchGame(): Promise<void> {
    if (!canLaunchGame || launching) return;
    setLaunchError("");
    setLaunching(true);
    try {
      await window.gameStockAPI.games.launch(currentGame.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao lançar jogo";
      setLaunchError(message);
      setTimeout(() => setLaunchError(""), 4000);
    } finally {
      setLaunching(false);
    }
  }

  function selectPreviousGame(): void {
    const currentIndex = games.findIndex((item) => item.id === currentGame.id);
    const prevGame = games[(currentIndex - 1 + games.length) % games.length];
    if (prevGame) setSelectedGameId(prevGame.id);
  }

  function selectNextGame(): void {
    const currentIndex = games.findIndex((item) => item.id === currentGame.id);
    const nextGame = games[(currentIndex + 1) % games.length];
    if (nextGame) setSelectedGameId(nextGame.id);
  }

  function openLightbox(url: string): void {
    const index = lightboxImages.findIndex((item) => item.url === url);
    setLightboxIndex(index >= 0 ? index : 0);
  }

  function showNextLightboxImage(): void {
    if (!lightboxImages.length) return;
    setLightboxIndex((current) => current === null ? 0 : (current + 1) % lightboxImages.length);
  }

  function showPreviousLightboxImage(): void {
    if (!lightboxImages.length) return;
    setLightboxIndex((current) => current === null ? 0 : (current - 1 + lightboxImages.length) % lightboxImages.length);
  }

  async function downloadLightboxImage(event: MouseEvent<HTMLButtonElement>): Promise<void> {
    event.stopPropagation();
    if (!lightboxItem) return;

    await window.gameStockAPI.dialogs.saveImageFile(lightboxItem.path, lightboxItem.fileName);
  }

  return (
    <section className="game-detail">
      <div className="detail-hero">
        {heroBgUrl ? <img className="detail-hero-bg" src={heroBgUrl} alt="" aria-hidden="true" /> : <div className="detail-hero-bg detail-hero-fallback" />}
        <div className="detail-hero-shade" />
        <div className="detail-top-actions">
          <button type="button" className="detail-top-button" onClick={() => setSelectedGameId(null)}>
            <Library aria-hidden="true" size={18} />
            Biblioteca
          </button>
          {games.findIndex((item) => item.id === currentGame.id) > 0 && (
            <button type="button" className="detail-top-button" onClick={selectPreviousGame} aria-label="Jogo anterior" title="Jogo anterior">
              <ChevronLeft aria-hidden="true" size={18} />
            </button>
          )}
          {games.findIndex((item) => item.id === currentGame.id) < games.length - 1 && (
            <button type="button" className="detail-top-button" onClick={selectNextGame} aria-label="Próximo jogo" title="Próximo jogo">
              <ChevronRight aria-hidden="true" size={18} />
            </button>
          )}
        </div>
        <div className="detail-hero-content">
          <div className={"detail-cover-card" + (isCoverLandscape ? " landscape" : "")}>
            {coverUrl
              ? <img
                  src={coverUrl}
                  alt=""
                  onLoad={(event) => {
                    const img = event.currentTarget;
                    setIsCoverLandscape(img.naturalWidth > img.naturalHeight);
                  }}
                />
              : <Gamepad2 aria-hidden="true" size={38} />}
          </div>
          <div className="detail-title-block">
            <div className="detail-chips" aria-label="Metadados principais">
              <span>{game.platform_name ?? "Sem plataforma"}</span>
              <span>{year}</span>
              {game.rating && <span>{game.rating}</span>}
            </div>
            <h1>{game.title}</h1>
            <p>{publisher} · {genre}</p>
          </div>
          <div className="detail-hero-actions" aria-label="Acoes do jogo">
            <button
              type="button"
              className="detail-hero-play-button"
              disabled={!canLaunchGame || launching}
              onClick={() => void launchGame()}
              title={playButtonTitle}
            >
              <Play aria-hidden="true" size={18} />
              {launching ? "Abrindo..." : "Jogar"}
            </button>
            {launchError && <span className="detail-hero-launch-error" role="status">{launchError}</span>}
            <button type="button" className={"detail-hero-icon-button detail-favorite-button" + (game.favorite ? " active" : "")} onClick={toggleFavorite} aria-label={game.favorite ? "Remover favorito" : "Marcar favorito"} title={game.favorite ? "Remover favorito" : "Marcar favorito"}>
              <Star aria-hidden="true" size={18} fill={game.favorite ? "#facc15" : "none"} color={game.favorite ? "#facc15" : undefined} />
            </button>
            <button type="button" className={"detail-hero-icon-button detail-completed-button" + (completedActive ? " active" : "")} onClick={() => togglePlayStatus("completed")} aria-label="Concluído" title="Concluído">
              <Trophy aria-hidden="true" size={18} />
            </button>
            <button type="button" className={"detail-hero-icon-button detail-playing-button" + (playingActive ? " active" : "")} onClick={() => togglePlayStatus("playing")} aria-label="Jogando" title="Jogando">
              <Gamepad2 aria-hidden="true" size={18} />
            </button>
            <button type="button" className="detail-hero-icon-button" onClick={() => setIsEditModalOpen(true)} aria-label="Editar" title="Editar">
              <Pencil aria-hidden="true" size={18} />
            </button>
            <button type="button" className="detail-hero-icon-button danger" onClick={deleteGame} aria-label="Excluir" title="Excluir">
              <Trash2 aria-hidden="true" size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="detail-content-grid">
        <section className="detail-panel detail-about">
          <h2>Descrição</h2>
          <p>{overview}</p>
        </section>

        <section className="detail-panel">
          {screenshotUrl && (
            <div className="detail-file-screenshot">
              <h3>Screenshot</h3>
              <button type="button" className="detail-file-screenshot-button" onClick={() => openLightbox(screenshotUrl)} aria-label="Visualizar screenshot">
                <img src={screenshotUrl} alt="Screenshot" />
              </button>
            </div>
          )}
          <h2>Arquivo</h2>
          <dl className="detail-info-list">
            <div className="detail-info-row-wrap">
              <dt>ROM</dt>
              <dd>{fileName}</dd>
            </div>
            <div>
              <dt>Box Art</dt>
              <dd>{game.box_art_path ? "Associada" : "Não associada"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd className={game.rom_path ? "detail-ok" : ""}>{game.rom_path ? "Pronto" : "Pendente"}</dd>
            </div>
          </dl>
        </section>

        <section className="detail-panel detail-gallery-panel">
          <h2>Galeria</h2>
          <div className="detail-gallery">
            {galleryItems.length ? galleryItems.map((item) => {
              const itemUrl = localMediaUrl(item.path);
              return (
                <button
                  type="button"
                  key={item.path}
                  className={"detail-gallery-thumb" + (item.kind === "background" ? " detail-gallery-wide" : "")}
                  onClick={() => itemUrl && openLightbox(itemUrl)}
                  aria-label={item.label}
                >
                  {itemUrl ? <img src={itemUrl} alt={item.label} /> : <Image aria-hidden="true" size={24} />}
                  <span className="detail-gallery-label">{item.label}</span>
                </button>
              );
            }) : (
              <div className="detail-gallery-empty-state">
                <Monitor aria-hidden="true" size={24} />
                <span>Nenhuma imagem baixada</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {lightboxItem && (
        <div className="detail-lightbox" role="dialog" aria-modal="true" aria-label="Visualizar imagem">
          <button type="button" className="detail-lightbox-download text-button" onClick={downloadLightboxImage} aria-label="Salvar imagem" title="Salvar imagem">
            <Download aria-hidden="true" size={18} />
            Salvar
          </button>
          <button type="button" className="detail-lightbox-close icon-button modal-close-button" onClick={() => setLightboxIndex(null)} aria-label="Fechar">
            <X aria-hidden="true" size={20} />
          </button>
          {lightboxImages.length > 1 && (
            <>
              <button type="button" className="detail-lightbox-nav detail-lightbox-prev icon-button" onClick={(event) => { event.stopPropagation(); showPreviousLightboxImage(); }} aria-label="Imagem anterior" title="Imagem anterior">
                <ArrowLeft aria-hidden="true" size={24} />
              </button>
              <button type="button" className="detail-lightbox-nav detail-lightbox-next icon-button" onClick={(event) => { event.stopPropagation(); showNextLightboxImage(); }} aria-label="Próxima imagem" title="Próxima imagem">
                <ArrowRight aria-hidden="true" size={24} />
              </button>
            </>
          )}
          <img src={lightboxItem.url} alt={lightboxItem.label} onClick={(event) => { event.stopPropagation(); showNextLightboxImage(); }} title="Próxima imagem" />
        </div>
      )}

      {isEditModalOpen && (
        <div className="detail-edit-backdrop" onMouseDown={() => setIsEditModalOpen(false)} role="presentation">
          <section className="management-modal detail-edit-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="detail-edit-title">
            <header>
              <h2 id="detail-edit-title">Editar cadastro</h2>
              <button type="button" className="icon-button modal-close-button" onClick={() => setIsEditModalOpen(false)} aria-label="Fechar">
                <X aria-hidden="true" size={18} />
              </button>
            </header>
            <GameForm game={game} onCancel={() => setIsEditModalOpen(false)} onSaved={() => setIsEditModalOpen(false)} />
          </section>
        </div>
      )}
    </section>
  );
}

function getFileName(filePath: string, fallback: string): string {
  const fileName = filePath.split(/[\\/]/).pop();
  if (fileName) return fileName;
  return `${fallback.toLowerCase().replace(/\s+/g, "-")}.jpg`;
}

function buildSaveFileName(prefix: string, fileName: string): string {
  return `${prefix} - ${sanitizeFileNamePart(fileName)}`;
}

function sanitizeFileNamePart(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, "-").replace(/\s+/g, " ").trim() || "imagem";
}

function getPlayButtonTitle(hasRom: boolean, emulatorLoading: boolean, defaultEmulator: PlatformEmulator | null): string {
  if (!hasRom) return "ROM não configurada";
  if (emulatorLoading) return "Verificando emulador da plataforma";
  if (!defaultEmulator) return "Escolha um emulador padrão para esta plataforma";
  return `Jogar com ${defaultEmulator.emulator?.name ?? "emulador padrão"}`;
}
