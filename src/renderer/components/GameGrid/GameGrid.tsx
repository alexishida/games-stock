/**
 * GameGrid.tsx
 *
 * Componente de visualização em grade da biblioteca de jogos.
 * Lê a lista de jogos do store global e renderiza um GameCard para cada jogo.
 * Exibe mensagem de estado vazio quando não há jogos correspondentes aos filtros ativos.
 * Inclui o componente de Pagination ao final da grade.
 */

import { useGameStockStore } from "../../store";
import { Pagination } from "../Pagination/Pagination";
import { GameCard } from "./GameCard";
import "./GameGrid.css";

/**
 * Renderiza a grade de cards de jogos da biblioteca.
 * Exibe mensagem de estado vazio quando a lista está vazia.
 */
export function GameGrid() {
  // Lista de jogos da página atual, já filtrada e paginada pelo store
  const games = useGameStockStore((state) => state.games);

  // Estado vazio: exibido quando nenhum jogo corresponde à busca ou filtro ativo
  if (!games.length) return <div className="empty-state">Nenhum jogo encontrado</div>;

  return (
    <>
      {/* Grade responsiva com um GameCard por jogo */}
      <div className="game-grid-wrap">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
      {/* Controles de paginação posicionados abaixo da grade */}
      <Pagination />
    </>
  );
}
