import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, Gamepad2, Image, Monitor, Pencil, Play, Star, Trash2, X } from "lucide-react";
import { GameMediaItem } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { localMediaUrl } from "../../utils/media";
import { GameForm } from "./GameForm";
import "./GameDetail.css";

export function GameDetail() {
  const games = useGameStockStore((state) => state.games);
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  const setSelectedGameId = useGameStockStore((state) => state.setSelectedGameId);
  const setImporterOpen = useGameStockStore((state) => state.setImporterOpen);
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const game = useMemo(() => games.find((item) => item.id === selectedGameId) ?? null, [games, selectedGameId]);
  const coverUrl = localMediaUrl(game?.box_art_path);
  const screenshotUrl = localMediaUrl(game?.screenshot_path);
  const backgroundUrl = localMediaUrl(game?.background_path);
  const heroBgUrl = backgroundUrl ?? coverUrl;
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isCoverLandscape, setIsCoverLandscape] = useState(false);
  const [mediaItems, setMediaItems] = useState<GameMediaItem[]>([]);
  const editSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setIsCoverLandscape(false);
  }, [selectedGameId]);

  useEffect(() => {
    let canceled = false;
    setMediaItems([]);
    if (!selectedGameId) return undefined;

    window.gameStockAPI.games.listMedia(selectedGameId).then((items) => {
      if (!canceled) setMediaItems(items);
    });

    return () => {
      canceled = true;
    };
  }, [selectedGameId]);

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
  const publisher = game.publisher || "Publisher nao informado";
  const genre = game.genre || "Genero nao informado";
  const year = game.year?.toString() ?? "Ano nao informado";
  const overview = game.notes?.trim() || "Sem descricao cadastrada para este jogo.";
  const fileName = game.rom_path?.split(/[\\/]/).pop() ?? "ROM nao associada";
  const canOpenRom = Boolean(game.rom_path);
  const fallbackMediaItems = [
    screenshotUrl ? { path: game.screenshot_path!, label: "Screenshot", kind: "screenshot" as const } : null,
    backgroundUrl ? { path: game.background_path!, label: "Background", kind: "background" as const } : null
  ].filter(Boolean) as GameMediaItem[];
  const galleryItems = mediaItems.length ? mediaItems : fallbackMediaItems;

  async function deleteGame(): Promise<void> {
    if (!game) return;
    if (!window.confirm(`Excluir "${game.title}" da biblioteca?`)) return;
    await window.gameStockAPI.games.delete(game.id);
    setSelectedGameId(null);
    reloadGames();
  }

  async function toggleFavorite(): Promise<void> {
    await window.gameStockAPI.games.update(currentGame.id, { favorite: !currentGame.favorite });
    reloadGames();
  }

  async function togglePlayStatus(status: typeof currentGame.play_status): Promise<void> {
    await window.gameStockAPI.games.update(currentGame.id, { play_status: currentGame.play_status === status ? "unplayed" : status });
    reloadGames();
  }

  function scrollToEdit(): void {
    editSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="game-detail">
      <div className="detail-hero">
        {heroBgUrl ? <img className="detail-hero-bg" src={heroBgUrl} alt="" aria-hidden="true" /> : <div className="detail-hero-bg detail-hero-fallback" />}
        <div className="detail-hero-shade" />
        <button type="button" className="detail-back" onClick={() => setSelectedGameId(null)}>
          <ArrowLeft aria-hidden="true" size={18} />
          Biblioteca
        </button>
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
            <button type="button" className="detail-hero-play-button" disabled={!canOpenRom} onClick={() => game.rom_path && window.gameStockAPI.shell.openPath(game.rom_path)}>
              <Play aria-hidden="true" size={18} />
              Jogar
            </button>
            <button type="button" className={"detail-hero-icon-button" + (game.favorite ? " active" : "")} onClick={toggleFavorite} aria-label={game.favorite ? "Remover favorito" : "Marcar favorito"} title={game.favorite ? "Remover favorito" : "Marcar favorito"}>
              <Star aria-hidden="true" size={18} />
            </button>
            <button type="button" className={"detail-hero-icon-button" + (game.play_status === "completed" ? " active" : "")} onClick={() => togglePlayStatus("completed")} aria-label="Concluido" title="Concluido">
              <CheckCircle2 aria-hidden="true" size={18} />
            </button>
            <button type="button" className={"detail-hero-icon-button" + (game.play_status === "playing" ? " active" : "")} onClick={() => togglePlayStatus("playing")} aria-label="Jogando" title="Jogando">
              <Gamepad2 aria-hidden="true" size={18} />
            </button>
            <button type="button" className="detail-hero-icon-button" onClick={scrollToEdit} aria-label="Editar" title="Editar">
              <Pencil aria-hidden="true" size={18} />
            </button>
            <button type="button" className="detail-hero-icon-button danger" onClick={deleteGame} aria-label="Excluir" title="Excluir">
              <Trash2 aria-hidden="true" size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="detail-content-grid">
        <div className="detail-main-column">
          <section className="detail-panel detail-about">
            <h2>Sobre o jogo</h2>
            <p>{overview}</p>
            <div className="detail-primary-actions">
              <button type="button" className="detail-primary-button" disabled={!canOpenRom} onClick={() => game.rom_path && window.gameStockAPI.shell.openPath(game.rom_path)}>
                <Play aria-hidden="true" size={18} />
                Abrir ROM
              </button>
              <button type="button" className="detail-secondary-button" onClick={() => setImporterOpen(true)}>
                <Download aria-hidden="true" size={18} />
                Metadados
              </button>
              <button type="button" className="detail-danger-button" onClick={deleteGame}>
                <Trash2 aria-hidden="true" size={18} />
                Excluir
              </button>
            </div>
          </section>

          <section className="detail-stats-grid" aria-label="Resumo da colecao">
            <div className="detail-panel detail-stat-card">
              <div className="detail-card-label">
                <Star aria-hidden="true" size={18} />
                Colecao
              </div>
              <strong>{game.favorite ? "Favorito" : "Padrao"}</strong>
              <small>{game.play_status === "completed" ? "Concluido" : game.play_status === "playing" ? "Jogando" : "Nao jogado"}</small>
            </div>
          </section>

          <section className="detail-panel" ref={editSectionRef}>
            <h2>Editar cadastro</h2>
            <GameForm game={game} />
          </section>
        </div>

        <aside className="detail-side-column">
          <section className="detail-panel">
            <h3>Arquivo</h3>
            <dl className="detail-info-list">
              <div>
                <dt>ROM</dt>
                <dd>{fileName}</dd>
              </div>
              <div>
                <dt>Box Art</dt>
                <dd>{game.box_art_path ? "Associada" : "Nao associada"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd className={game.rom_path ? "detail-ok" : ""}>{game.rom_path ? "Pronto" : "Pendente"}</dd>
              </div>
            </dl>
          </section>

          <section className="detail-panel">
            <h3>Galeria</h3>
            <div className="detail-gallery">
              {galleryItems.length ? galleryItems.map((item) => {
                const itemUrl = localMediaUrl(item.path);
                return (
                  <button
                    type="button"
                    key={item.path}
                    className={"detail-gallery-thumb" + (item.kind === "background" ? " detail-gallery-wide" : "")}
                    onClick={() => itemUrl && setLightboxUrl(itemUrl)}
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

          {lightboxUrl && (
            <div className="detail-lightbox" onClick={() => setLightboxUrl(null)} role="dialog" aria-modal="true" aria-label="Visualizar imagem">
              <button type="button" className="detail-lightbox-close icon-button modal-close-button" onClick={() => setLightboxUrl(null)} aria-label="Fechar">
                <X aria-hidden="true" size={20} />
              </button>
              <img src={lightboxUrl} alt="" onClick={(e) => e.stopPropagation()} />
            </div>
          )}

        </aside>
      </div>
    </section>
  );
}
