/**
 * GameList.tsx
 *
 * Componente de visualização em lista da biblioteca de jogos.
 * Exibe os jogos em formato tabular com colunas de título, plataforma, gênero,
 * publisher, ano, status e ação de lançar. Lê a lista do store global e
 * renderiza um GameListRow por jogo. Inclui paginação ao final.
 */

import { useGameStockStore } from "../../store";
import { Pagination } from "../Pagination/Pagination";
import { GameListRow } from "./GameListRow";
import "./GameList.css";

/**
 * Renderiza a visualização em lista (tabular) dos jogos da biblioteca.
 * Exibe mensagem de estado vazio quando nenhum jogo é encontrado.
 */
export function GameList() {
  // Lista de jogos da página atual, já filtrada e paginada pelo store
  const games = useGameStockStore((state) => state.games);

  // Estado vazio: exibido quando nenhum jogo corresponde à busca ou filtro ativo
  if (!games.length) return <div className="empty-state">Nenhum jogo encontrado</div>;

  return (
    <>
      <div className="game-list">
        {/* Cabeçalho fixo com os rótulos das colunas da lista */}
        <div className="game-list-header">
          <span></span>         {/* Coluna da miniatura (thumb) — sem rótulo */}
          <span>Título</span>
          <span>Plataforma</span>
          <span>Estilo</span>   {/* Gênero do jogo */}
          <span>Publisher</span>
          <span>Ano</span>
          <span></span>         {/* Coluna de status (favorito, jogando, concluído) — sem rótulo */}
          <span></span>         {/* Coluna de ação de lançar — sem rótulo */}
        </div>
        {/* Corpo da lista com uma linha por jogo */}
        <div className="game-list-body">
          {games.map((game) => (
            <GameListRow key={game.id} game={game} />
          ))}
        </div>
      </div>
      {/* Controles de paginação posicionados abaixo da lista */}
      <Pagination />
    </>
  );
}
