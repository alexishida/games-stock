/**
 * HardwareInventoryList.tsx
 *
 * Visualizacao em lista do inventario fisico.
 * Exibe os itens em formato tabular, com miniatura, plataforma, tipo,
 * estado de conservacao e metadados uteis para conferencia rapida.
 */

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Cpu } from "lucide-react";
import { HardwareItem } from "../../../shared/types";
import { localMediaUrl } from "../../utils/media";
import { scrollToCollectionTop } from "../../utils/scrollToCollectionTop";
import "./HardwareInventoryList.css";

/** Quantidade de itens carregados por pagina no inventario. */
const PAGE_SIZE = 36;

/** Props recebidas pela lista tabular de inventario. */
interface Props {
  items: HardwareItem[];
  filtered: number;
  page: number;
  onPageChange: (page: number) => void;
  selectedItemId: number | null;
  onSelectItem: (item: HardwareItem) => void;
}

/**
 * Retorna uma classe CSS semantica para colorir o badge de conservacao.
 * Usa nomes em minusculas para tolerar estados cadastrados pelo usuario.
 */
function conditionClass(stateName: string | null): string {
  if (!stateName) return "";
  const lower = stateName.toLowerCase();
  if (lower === "novo") return "condition-new";
  if (lower === "otimo" || lower === "ótimo") return "condition-great";
  if (lower === "bom") return "condition-good";
  if (lower === "ruim") return "condition-bad";
  if (lower.includes("reparo")) return "condition-repair";
  return "";
}

/** Formata valores monetarios mantendo fallback simples quando nao houver valor. */
function formatValue(value: number | null): string {
  if (value == null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** Formata datas ISO simples (`YYYY-MM-DD`) no padrao brasileiro. */
function formatDate(value: string | null): string {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

/** Retorna texto seguro para celulas opcionais da tabela. */
function textOrDash(value: string | null | undefined): string {
  return value?.trim() ? value : "-";
}

/**
 * Renderiza uma linha selecionavel da lista de inventario.
 * Mantem navegacao por teclado equivalente aos cards.
 */
function HardwareInventoryListRow({
  item,
  selected,
  onSelect
}: {
  item: HardwareItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const coverUrl = localMediaUrl(item.cover_photo_path);

  /** Seleciona a linha quando o usuario usa Enter ou Espaco. */
  function handleRowKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={selected ? "hw-list-row selected" : "hw-list-row"}
      onClick={onSelect}
      onKeyDown={handleRowKeyDown}
    >
      <span className="hw-list-thumb">
        {coverUrl
          ? <img src={coverUrl} alt="" loading="lazy" decoding="async" draggable={false} />
          : <Cpu size={20} aria-hidden="true" />}
      </span>
      <span className="hw-list-title">{item.name}</span>
      <span className="hw-list-meta">{textOrDash(item.platform_name)}</span>
      <span className="hw-list-meta">{textOrDash(item.item_type_name)}</span>
      <span>
        {item.conservation_state_name
          ? <span className={`hw-list-condition ${conditionClass(item.conservation_state_name)}`}>{item.conservation_state_name}</span>
          : <span className="hw-list-meta">-</span>}
      </span>
      <span className="hw-list-meta">{textOrDash(item.color)}</span>
      <span className="hw-list-meta">{textOrDash(item.storage_location)}</span>
      <span className="hw-list-value">{formatValue(item.value)}</span>
      <span className="hw-list-date">{formatDate(item.acquisition_date)}</span>
    </div>
  );
}

/**
 * Renderiza a visualizacao em lista do inventario com paginacao local.
 * Exibe estado vazio quando os filtros nao retornam itens.
 */
export function HardwareInventoryList({
  items,
  filtered,
  page,
  onPageChange,
  selectedItemId,
  onSelectItem
}: Props) {
  const totalPages = Math.ceil(filtered / PAGE_SIZE);

  /** Atualiza página e retorna a lista ao topo para exibir seus primeiros itens. */
  function handlePageChange(nextPage: number): void {
    onPageChange(nextPage);
    scrollToCollectionTop();
  }

  if (items.length === 0) {
    return (
      <div className="hw-list-empty">
        <p>Nenhum item encontrado.</p>
        <span>Ajuste os filtros ou adicione itens ao inventário.</span>
      </div>
    );
  }

  return (
    <div className="hw-list-wrap">
      <div className="hw-list">
        <div className="hw-list-header">
          <span></span>
          <span>Nome</span>
          <span>Plataforma</span>
          <span>Tipo</span>
          <span>Estado</span>
          <span>Cor</span>
          <span>Local</span>
          <span>Valor</span>
          <span>Aquisição</span>
        </div>
        <div className="hw-list-body">
          {items.map((item) => (
            <HardwareInventoryListRow
              key={item.id}
              item={item}
              selected={selectedItemId === item.id}
              onSelect={() => onSelectItem(item)}
            />
          ))}
        </div>
      </div>

      {/* Barra de paginacao espelha os cards para manter comportamento igual nos dois modos. */}
      {totalPages > 1 && (
        <div className="hw-pagination">
          <span className="hw-pagination-info">
            {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered)} de {filtered}
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
