import { useMemo } from "react";
import { useGameStockStore } from "../../store";
import { localMediaUrl } from "../../utils/media";
import { GameForm } from "./GameForm";
import "./GameDetail.css";

export function GameDetail() {
  const games = useGameStockStore((state) => state.games);
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  const game = useMemo(() => games.find((item) => item.id === selectedGameId) ?? null, [games, selectedGameId]);
  const coverUrl = localMediaUrl(game?.box_art_path);

  if (!game) {
    return (
      <aside className="game-detail">
        <div className="detail-empty">Selecione um jogo</div>
      </aside>
    );
  }

  return (
    <aside className="game-detail">
      <div className="detail-cover">
        {coverUrl ? <img src={coverUrl} alt="" /> : <span>◇</span>}
      </div>
      <div className="detail-meta">
        <h2>{game.title}</h2>
        <p>{game.platform_name}</p>
      </div>
      <GameForm game={game} />
    </aside>
  );
}
