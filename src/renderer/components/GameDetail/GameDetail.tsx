import { useMemo, useState } from "react";
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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

  const publisher = game.publisher || "Publisher nao informado";
  const genre = game.genre || "Genero nao informado";
  const year = game.year?.toString() ?? "Ano nao informado";
  const overview = game.notes?.trim() || "Sem descricao cadastrada para este jogo.";
  const fileName = game.rom_path?.split(/[\\/]/).pop() ?? "ROM nao associada";
  const canOpenRom = Boolean(game.rom_path);

  async function deleteGame(): Promise<void> {
    if (!game) return;
    if (!window.confirm(`Excluir "${game.title}" da biblioteca?`)) return;
    await window.gameStockAPI.games.delete(game.id);
    setSelectedGameId(null);
    reloadGames();
  }

  return (
    <section className="game-detail">
      <div className="detail-hero">
        {coverUrl ? <img className="detail-hero-bg" src={coverUrl} alt="" aria-hidden="true" /> : <div className="detail-hero-bg detail-hero-fallback" />}
        <div className="detail-hero-shade" />
        <button type="button" className="detail-back" onClick={() => setSelectedGameId(null)}>
          <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
          Biblioteca
        </button>
        <div className="detail-hero-content">
          <div className="detail-cover-card">
            {coverUrl ? <img src={coverUrl} alt="" /> : <span className="material-symbols-outlined" aria-hidden="true">videogame_asset</span>}
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
        </div>
      </div>

      <div className="detail-content-grid">
        <div className="detail-main-column">
          <section className="detail-panel detail-about">
            <h2>Sobre o jogo</h2>
            <p>{overview}</p>
            <div className="detail-primary-actions">
              <button type="button" className="detail-primary-button" disabled={!canOpenRom} onClick={() => game.rom_path && window.gameStockAPI.shell.openPath(game.rom_path)}>
                <span className="material-symbols-outlined" aria-hidden="true">play_arrow</span>
                Abrir ROM
              </button>
              <button type="button" className="detail-secondary-button" onClick={() => setImporterOpen(true)}>
                <span className="material-symbols-outlined" aria-hidden="true">download</span>
                Metadados
              </button>
              <button type="button" className="detail-danger-button" onClick={deleteGame}>
                <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                Excluir
              </button>
            </div>
          </section>

          <section className="detail-stats-grid" aria-label="Resumo da colecao">
            <div className="detail-panel detail-stat-card">
              <div className="detail-card-label">
                <span className="material-symbols-outlined" aria-hidden="true">stars</span>
                Colecao
              </div>
              <strong>{game.favorite ? "Favorito" : "Padrao"}</strong>
              <small>{game.play_status === "completed" ? "Concluido" : game.play_status === "playing" ? "Jogando" : "Nao jogado"}</small>
            </div>
          </section>

          <section className="detail-panel">
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
              <button
                type="button"
                className={"detail-gallery-thumb" + (screenshotUrl ? "" : " detail-gallery-empty")}
                onClick={() => screenshotUrl && setLightboxUrl(screenshotUrl)}
                disabled={!screenshotUrl}
                aria-label="Screenshot"
              >
                {screenshotUrl
                  ? <img src={screenshotUrl} alt="Screenshot" />
                  : <span className="material-symbols-outlined" aria-hidden="true">screenshot_monitor</span>}
                <span className="detail-gallery-label">Screenshot</span>
              </button>
              <button
                type="button"
                className={"detail-gallery-thumb" + (coverUrl ? "" : " detail-gallery-empty")}
                onClick={() => coverUrl && setLightboxUrl(coverUrl)}
                disabled={!coverUrl}
                aria-label="Box Art"
              >
                {coverUrl
                  ? <img src={coverUrl} alt="Box Art" />
                  : <span className="material-symbols-outlined" aria-hidden="true">image</span>}
                <span className="detail-gallery-label">Box Art</span>
              </button>
              <button
                type="button"
                className={"detail-gallery-thumb detail-gallery-wide" + (backgroundUrl ? "" : " detail-gallery-empty")}
                onClick={() => backgroundUrl && setLightboxUrl(backgroundUrl)}
                disabled={!backgroundUrl}
                aria-label="Background"
              >
                {backgroundUrl
                  ? <img src={backgroundUrl} alt="Background" />
                  : <span className="material-symbols-outlined" aria-hidden="true">wallpaper</span>}
                <span className="detail-gallery-label">Background</span>
              </button>
            </div>
          </section>

          {lightboxUrl && (
            <div className="detail-lightbox" onClick={() => setLightboxUrl(null)} role="dialog" aria-modal="true" aria-label="Visualizar imagem">
              <button type="button" className="detail-lightbox-close" onClick={() => setLightboxUrl(null)} aria-label="Fechar">
                <span className="material-symbols-outlined">close</span>
              </button>
              <img src={lightboxUrl} alt="" onClick={(e) => e.stopPropagation()} />
            </div>
          )}

        </aside>
      </div>
    </section>
  );
}
