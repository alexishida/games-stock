import { useGameStockStore } from "../../store";
import { Pagination } from "../Pagination/Pagination";
import { GameCard } from "./GameCard";
import "./GameGrid.css";

export function GameGrid() {
  const games = useGameStockStore((state) => state.games);

  if (!games.length) return <div className="empty-state">Nenhum jogo encontrado</div>;

  return (
    <>
      <div className="game-grid-wrap">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
      <Pagination />
    </>
  );
}
