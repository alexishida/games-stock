import { useState } from "react";
import { CircleCheck, Gamepad2, Star } from "lucide-react";
import { Game } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { localMediaUrl } from "../../utils/media";

export function GameListRow({ game }: { game: Game }) {
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  const setSelectedGameId = useGameStockStore((state) => state.setSelectedGameId);
  const coverUrl = localMediaUrl(game.box_art_path);
  const [isLandscape, setIsLandscape] = useState(false);

  return (
    <button
      type="button"
      className={selectedGameId === game.id ? "game-list-row selected" : "game-list-row"}
      onClick={() => setSelectedGameId(game.id)}
    >
      <span className={isLandscape ? "thumb landscape" : "thumb"}>
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
          : <Gamepad2 aria-hidden="true" size={22} />}
      </span>
      <span className="col-title">{game.title}</span>
      <span className="col-meta">{game.platform_name}</span>
      <span className="col-meta col-genre">{game.genre ?? "—"}</span>
      <span className="col-meta">{game.publisher ?? "—"}</span>
      <span className="col-year">{game.year ?? "—"}</span>
      <span className="col-status">
        {game.favorite && <Star size={13} fill="currentColor" className="icon-fav" aria-label="Favorito" />}
        {game.play_status === "playing" && <Gamepad2 size={13} className="icon-playing" aria-label="Jogando" />}
        {game.play_status === "completed" && <CircleCheck size={13} className="icon-completed" aria-label="Concluído" />}
      </span>
    </button>
  );
}
