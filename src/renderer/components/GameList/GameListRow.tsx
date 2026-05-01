import { Game } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { localMediaUrl } from "../../utils/media";

export function GameListRow({ game, style }: { game: Game; style: React.CSSProperties }) {
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  const setSelectedGameId = useGameStockStore((state) => state.setSelectedGameId);
  const coverUrl = localMediaUrl(game.box_art_path);

  return (
    <button type="button" style={style} className={selectedGameId === game.id ? "game-list-row selected" : "game-list-row"} onClick={() => setSelectedGameId(game.id)}>
      <span className="thumb">
        {coverUrl ? <img src={coverUrl} alt="" /> : <span className="material-symbols-outlined" aria-hidden="true">videogame_asset</span>}
      </span>
      <span>{game.title}</span>
      <span>{game.platform_name}</span>
      <span>{game.publisher}</span>
      <span>{game.year}</span>
      <span>{game.owned_physical ? "Fisico" : ""}</span>
    </button>
  );
}
