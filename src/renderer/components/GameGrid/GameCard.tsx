import { Game } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { localMediaUrl } from "../../utils/media";
import { GameCardPlaceholder } from "./GameCardPlaceholder";
import { PhysicalBadge } from "./PhysicalBadge";

export function GameCard({ game, style }: { game: Game; style?: React.CSSProperties }) {
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  const setSelectedGameId = useGameStockStore((state) => state.setSelectedGameId);
  const coverUrl = localMediaUrl(game.box_art_path);

  return (
    <button
      type="button"
      style={style}
      className={selectedGameId === game.id ? "game-card selected" : "game-card"}
      onClick={() => setSelectedGameId(game.id)}
    >
      <div className="cover-frame">
        {coverUrl ? <img src={coverUrl} alt="" /> : <GameCardPlaceholder platformName={game.platform_name} />}
        {game.owned_physical && <PhysicalBadge />}
        <div className="card-gradient" />
        <div className="card-copy">
          <span className="card-platform">{game.platform_name ?? "Sem plataforma"}</span>
          <strong>{game.title}</strong>
          <div className="card-progress">
            <span />
            <small>{game.year ?? "NEW"}</small>
          </div>
        </div>
      </div>
    </button>
  );
}
