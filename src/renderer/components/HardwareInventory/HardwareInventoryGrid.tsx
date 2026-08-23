/**
 * HardwareInventoryGrid.tsx
 *
 * Grade paginada de cards de itens de hardware do inventário físico.
 * Exibe 36 itens por página, reutilizando lógica de paginação local
 * (não usa o store global para não interferir com a grade de jogos).
 */

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { HardwareItem } from "../../../shared/types";
import { scrollToCollectionTop } from "../../utils/scrollToCollectionTop";
import { HardwareItemCard } from "./HardwareItemCard";
import "./HardwareInventoryGrid.css";

const PAGE_SIZE = 36;

interface Props {
  items: HardwareItem[];
  total: number;
  filtered: number;
  page: number;
  onPageChange: (page: number) => void;
  selectedItemId: number | null;
  onSelectItem: (item: HardwareItem) => void;
}

/**
 * Grade de cards de inventário com paginação.
 * Recebe os dados já carregados pelo componente pai para separar
 * responsabilidade de dados da responsabilidade de renderização.
 */
export function HardwareInventoryGrid({
  items,
  filtered,
  page,
  onPageChange,
  selectedItemId,
  onSelectItem
}: Props) {
  const totalPages = Math.ceil(filtered / PAGE_SIZE);

  /** Atualiza página e retorna a grade ao topo para exibir seus primeiros cards. */
  function handlePageChange(nextPage: number): void {
    onPageChange(nextPage);
    scrollToCollectionTop();
  }

  if (items.length === 0) {
    return (
      <div className="hw-grid-empty">
        <p>Nenhum item encontrado.</p>
        <span>Ajuste os filtros ou adicione itens ao inventário.</span>
      </div>
    );
  }

  return (
    <div className="hw-grid-wrap">
      <div className="hw-grid">
        {items.map((item) => (
          <HardwareItemCard
            key={item.id}
            item={item}
            selected={selectedItemId === item.id}
            onSelect={() => onSelectItem(item)}
          />
        ))}
      </div>

      {/* Barra de paginação — só exibida quando há mais de uma página */}
      {totalPages > 1 && (
        <div className="hw-pagination">
          <span className="hw-pagination-info">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered)} de {filtered}
          </span>
          <div className="hw-pagination-controls">
            <button
              type="button"
              className="hw-pagination-btn"
              disabled={page === 1}
              onClick={() => handlePageChange(1)}
              aria-label="Primeira página"
            >
              <ChevronsLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="hw-pagination-btn"
              disabled={page === 1}
              onClick={() => handlePageChange(page - 1)}
              aria-label="Página anterior"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span className="hw-pagination-pages">{page} / {totalPages}</span>
            <button
              type="button"
              className="hw-pagination-btn"
              disabled={page === totalPages}
              onClick={() => handlePageChange(page + 1)}
              aria-label="Próxima página"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="hw-pagination-btn"
              disabled={page === totalPages}
              onClick={() => handlePageChange(totalPages)}
              aria-label="Última página"
            >
              <ChevronsRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
