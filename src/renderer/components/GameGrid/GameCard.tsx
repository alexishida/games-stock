import { useState } from "react";
import { Play } from "lucide-react";
import { Game } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { localMediaUrl } from "../../utils/media";
import { GameCardPlaceholder } from "./GameCardPlaceholder";

export function GameCard({ game }: { game: Game }) {
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  const selectGame = useGameStockStore((state) => state.selectGame);
  const coverUrl = localMediaUrl(game.box_art_path);
  const [isLandscape, setIsLandscape] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");

  const canLaunch = Boolean(game.rom_path?.trim());

  async function launch(e: React.MouseEvent): Promise<void> {
    e.stopPropagation();
    if (!canLaunch || launching) return;
    setLaunchError("");
    setLaunching(true);
    try {
      await window.gameStockAPI.games.launch(game.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao lançar jogo";
      setLaunchError(msg);
      setTimeout(() => setLaunchError(""), 4000);
    } finally {
      setLaunching(false);
    }
  }

  const classes = [
    "game-card",
    selectedGameId === game.id ? "selected" : "",
    isLandscape ? "landscape" : "",
  ].filter(Boolean).join(" ");

  function handleSelect(): void {
    selectGame(game);
  }

  function handleCardKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleSelect();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={classes}
      onClick={handleSelect}
      onKeyDown={handleCardKeyDown}
    >
      <div className="cover-frame">
        {coverUrl
          ? <img
              src={coverUrl}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                setIsLandscape(img.naturalWidth > img.naturalHeight);
              }}
            />
          : <GameCardPlaceholder />
        }
        <div className="card-gradient" />
        <div className="card-copy">
          <span className="card-platform">{game.platform_name ?? "Sem plataforma"}</span>
          <strong>{game.title}</strong>
        </div>
        <button
          type="button"
          className={`card-launch-btn${!canLaunch ? " disabled" : ""}${launching ? " launching" : ""}`}
          title={canLaunch ? "Jogar" : "ROM não configurada"}
          disabled={!canLaunch || launching}
          onClick={launch}
          aria-label="Jogar"
        >
          <Play size={13} fill="currentColor" aria-hidden="true" />
        </button>
        {launchError && <div className="card-launch-error">{launchError}</div>}
      </div>
    </div>
  );
}
