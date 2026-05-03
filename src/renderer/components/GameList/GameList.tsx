import { useGameStockStore } from "../../store";
import { Pagination } from "../Pagination/Pagination";
import { GameListRow } from "./GameListRow";
import "./GameList.css";

export function GameList() {
  const games = useGameStockStore((state) => state.games);

  if (!games.length) return <div className="empty-state">Nenhum jogo encontrado</div>;

  return (
    <>
      <div className="game-list">
        <div className="game-list-header">
          <span></span>
          <span>Título</span>
          <span>Plataforma</span>
          <span>Estilo</span>
          <span>Publisher</span>
          <span>Ano</span>
          <span></span>
        </div>
        <div className="game-list-body">
          {games.map((game) => (
            <GameListRow key={game.id} game={game} />
          ))}
        </div>
      </div>
      <Pagination />
    </>
  );
}
