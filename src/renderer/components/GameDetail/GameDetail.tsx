import { useMemo } from "react";
import { useGameStockStore } from "../../store";
import { localMediaUrl } from "../../utils/media";
import { GameForm } from "./GameForm";
import "./GameDetail.css";

export function GameDetail() {
  const games = useGameStockStore((state) => state.games);
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  const setSelectedGameId = useGameStockStore((state) => state.setSelectedGameId);
  const setImporterOpen = useGameStockStore((state) => state.setImporterOpen);
  const game = useMemo(() => games.find((item) => item.id === selectedGameId) ?? null, [games, selectedGameId]);
  const coverUrl = localMediaUrl(game?.box_art_path);

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
            </div>
          </section>

          <section className="detail-stats-grid" aria-label="Resumo da colecao">
            <div className="detail-panel detail-stat-card">
              <div className="detail-card-label">
                <span className="material-symbols-outlined" aria-hidden="true">inventory_2</span>
                Inventario
              </div>
              <strong>{game.owned_physical ? "Fisico" : "Digital"}</strong>
              <small>{game.physical_condition ?? "Sem condicao fisica"}</small>
            </div>
            <div className="detail-panel detail-stat-card">
              <div className="detail-card-label">
                <span className="material-symbols-outlined" aria-hidden="true">stars</span>
                Avaliacao
              </div>
              <strong>{game.rating || "Sem nota"}</strong>
              <small>{game.launchbox_id ? "Importado do LaunchBox" : "Cadastro local"}</small>
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
              <div>{coverUrl ? <img src={coverUrl} alt="" /> : <span className="material-symbols-outlined" aria-hidden="true">image</span>}</div>
              <div><span className="material-symbols-outlined" aria-hidden="true">photo_library</span></div>
              <div><span className="material-symbols-outlined" aria-hidden="true">stadia_controller</span></div>
              <div><span>+0</span></div>
            </div>
          </section>

          <section className="detail-panel">
            <h3>Configurar</h3>
            <button type="button" className="detail-setting-row">
              <span className="material-symbols-outlined" aria-hidden="true">settings_input_component</span>
              Core do emulador
              <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
            </button>
          </section>
        </aside>
      </div>
    </section>
  );
}
