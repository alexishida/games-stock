import { Gamepad2 } from "lucide-react";
import { Game } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { localMediaUrl } from "../../utils/media";

export function GameListRow({ game }: { game: Game }) {
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  const setSelectedGameId = useGameStockStore((state) => state.setSelectedGameId);
  const coverUrl = localMediaUrl(game.box_art_path);

  return (
    <button
      type="button"
      className={selectedGameId === game.id ? "game-list-row selected" : "game-list-row"}
      onClick={() => setSelectedGameId(game.id)}
    >
      <span className="thumb">
        {coverUrl ? <img src={coverUrl} alt="" loading="lazy" decoding="async" draggable={false} /> : <Gamepad2 aria-hidden="true" size={22} />}
      </span>
      <span>{game.title}</span>
      <span>{game.platform_name}</span>
      <span>{game.publisher}</span>
      <span>{game.year}</span>
    </button>
  );
}
