import { Game } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { localMediaUrl } from "../../utils/media";
import { GameCardPlaceholder } from "./GameCardPlaceholder";

export function GameCard({ game }: { game: Game }) {
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  const setSelectedGameId = useGameStockStore((state) => state.setSelectedGameId);
  const coverUrl = localMediaUrl(game.box_art_path);

  return (
    <button
      type="button"
      className={selectedGameId === game.id ? "game-card selected" : "game-card"}
      onClick={() => setSelectedGameId(game.id)}
    >
      <div className="cover-frame">
        {coverUrl ? <img src={coverUrl} alt="" loading="lazy" decoding="async" draggable={false} /> : <GameCardPlaceholder platformName={game.platform_name} />}
        <div className="card-gradient" />
        <div className="card-copy">
          <span className="card-platform">{game.platform_name ?? "Sem plataforma"}</span>
          <strong>{game.title}</strong>
        </div>
      </div>
    </button>
  );
}
