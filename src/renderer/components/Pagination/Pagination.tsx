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
          <span className="material-symbols-outlined">first_page</span>
        </button>
        <button
          type="button"
          className="pagination-btn"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(currentPage - 1)}
          aria-label="Página anterior"
        >
          <span className="material-symbols-outlined">chevron_left</span>
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
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
        <button
          type="button"
          className="pagination-btn"
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage(totalPages)}
          aria-label="Última página"
        >
          <span className="material-symbols-outlined">last_page</span>
        </button>
      </div>
    </div>
  );
}
