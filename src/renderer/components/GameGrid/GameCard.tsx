import { useState } from "react";
import { Game } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { localMediaUrl } from "../../utils/media";
import { GameCardPlaceholder } from "./GameCardPlaceholder";

export function GameCard({ game }: { game: Game }) {
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  const setSelectedGameId = useGameStockStore((state) => state.setSelectedGameId);
  const coverUrl = localMediaUrl(game.box_art_path);
  const [isLandscape, setIsLandscape] = useState(false);

  const classes = [
    "game-card",
    selectedGameId === game.id ? "selected" : "",
    isLandscape ? "landscape" : "",
  ].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={classes}
      onClick={() => setSelectedGameId(game.id)}
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
      </div>
    </button>
  );
}
