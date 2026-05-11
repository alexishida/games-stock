/**
 * Pagination.tsx
 *
 * Barra de paginação da lista de jogos na biblioteca.
 * Exibe navegação por primeira, página anterior, próxima e última página,
 * além de um indicador de intervalo atual (ex.: "1–50 de 320").
 *
 * Não é renderizado quando o total de jogos filtrados cabe em uma única página.
 */

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useGameStockStore } from "../../store";
import "./Pagination.css";

/** Quantidade de jogos exibidos por página */
const PAGE_SIZE = 50;

/**
 * Componente de paginação da biblioteca.
 * Lê `filtered` e `currentPage` do store para calcular o total de páginas
 * e o intervalo de itens exibido na página corrente.
 */
export function Pagination() {
  // Total de jogos após aplicar os filtros ativos (busca, plataforma, coleção)
  const filtered = useGameStockStore((state) => state.filtered);
  // Página atual (base 1)
  const currentPage = useGameStockStore((state) => state.currentPage);
  // Atualiza a página atual no store, disparando novo carregamento de jogos
  const setCurrentPage = useGameStockStore((state) => state.setCurrentPage);

  // Calcula o número total de páginas com base nos itens filtrados
  const totalPages = Math.ceil(filtered / PAGE_SIZE);

  // Não renderiza a barra quando há apenas uma página ou nenhum resultado
  if (totalPages <= 1) return null;

  // Índice do primeiro e do último item exibidos na página corrente
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, filtered);

  return (
    <div className="pagination">
      {/* Indicador textual do intervalo atual (ex.: "1–50 de 320") */}
      <span className="pagination-info">
        {start}–{end} de {filtered}
      </span>

      <div className="pagination-controls">
        {/* Botão: vai para a primeira página */}
        <button
          type="button"
          className="pagination-btn"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(1)}
          aria-label="Primeira página"
        >
          <ChevronsLeft aria-hidden="true" size={18} />
        </button>

        {/* Botão: página anterior */}
        <button
          type="button"
          className="pagination-btn"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(currentPage - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft aria-hidden="true" size={18} />
        </button>

        {/* Indicador de página atual sobre o total (ex.: "3 / 7") */}
        <span className="pagination-pages">
          {currentPage} / {totalPages}
        </span>

        {/* Botão: próxima página */}
        <button
          type="button"
          className="pagination-btn"
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage(currentPage + 1)}
          aria-label="Próxima página"
        >
          <ChevronRight aria-hidden="true" size={18} />
        </button>

        {/* Botão: vai para a última página */}
        <button
          type="button"
          className="pagination-btn"
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage(totalPages)}
          aria-label="Última página"
        >
          <ChevronsRight aria-hidden="true" size={18} />
        </button>
      </div>
    </div>
  );
}
