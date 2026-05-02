import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useGameStockStore } from "../../store";
import "./Pagination.css";

const PAGE_SIZE = 50;

export function Pagination() {
  const filtered = useGameStockStore((state) => state.filtered);
  const currentPage = useGameStockStore((state) => state.currentPage);
  const setCurrentPage = useGameStockStore((state) => state.setCurrentPage);

  const totalPages = Math.ceil(filtered / PAGE_SIZE);
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, filtered);

  return (
    <div className="pagination">
      <span className="pagination-info">
        {start}–{end} de {filtered}
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(1)}
          aria-label="Primeira página"
        >
          <ChevronsLeft aria-hidden="true" size={18} />
        </button>
        <button
          type="button"
          className="pagination-btn"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(currentPage - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft aria-hidden="true" size={18} />
        </button>
        <span className="pagination-pages">
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          className="pagination-btn"
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage(currentPage + 1)}
          aria-label="Próxima página"
        >
          <ChevronRight aria-hidden="true" size={18} />
        </button>
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
