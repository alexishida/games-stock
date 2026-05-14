/**
 * HardwareInventory.tsx
 *
 * Componente orquestrador do módulo de inventário físico de hardware.
 *
 * O topo padrao permanece fixo em todos os estados.
 * Quando nenhum item esta selecionado, exibe cards ou lista paginada.
 * Quando um item e selecionado, exibe HardwareItemDetail abaixo da busca.
 */

import { useEffect, useRef, useState } from "react";
import { ArrowUpDown, Grid2X2, List, Search } from "lucide-react";
import { HardwareItem, HardwareItemListResult } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { HardwareInventoryGrid } from "./HardwareInventoryGrid";
import { HardwareInventoryList } from "./HardwareInventoryList";
import { HardwareItemDetail } from "./HardwareItemDetail";
import { HardwareItemForm } from "./HardwareItemForm";
import "../TopBar/TopBar.css";
import "./HardwareInventory.css";

/** Módulo completo do inventário de hardware. */
export function HardwareInventory() {
  const inventoryFilters      = useGameStockStore((state) => state.inventoryFilters);
  const setInventoryFilters   = useGameStockStore((state) => state.setInventoryFilters);
  const inventoryCreateOpen   = useGameStockStore((state) => state.inventoryCreateOpen);
  const setInventoryCreateOpen = useGameStockStore((state) => state.setInventoryCreateOpen);
  const inventoryViewMode     = useGameStockStore((state) => state.inventoryViewMode);
  const inventorySortBy       = useGameStockStore((state) => state.inventorySortBy);
  const setInventoryViewMode  = useGameStockStore((state) => state.setInventoryViewMode);
  const setInventorySortBy    = useGameStockStore((state) => state.setInventorySortBy);

  const [result, setResult]         = useState<HardwareItemListResult>({ items: [], total: 0, filtered: 0 });
  const [page, setPage]             = useState(1);
  const [selectedItem, setSelectedItem] = useState<HardwareItem | null>(null);
  const [formOpen, setFormOpen]     = useState(false);
  const [editItem, setEditItem]     = useState<HardwareItem | null>(null);
  const [loading, setLoading]       = useState(false);

  const [localSearch, setLocalSearch] = useState(inventoryFilters.search ?? "");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Proximo criterio do ciclo de ordenacao do inventario: nome -> tipo -> recentes.
  const nextInventorySort = inventorySortBy === "name" ? "type" : inventorySortBy === "type" ? "recent" : "name";
  const inventorySortTitle = inventorySortBy === "name"
    ? "Ordenar por tipo"
    : inventorySortBy === "type"
      ? "Ordenar por recentes"
      : "Ordenar por nome";

  function reloadItems() { setReloadToken((t) => t + 1); }

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    void window.gameStockAPI.hardwareInventory
      .itemsList({
        platformId:          inventoryFilters.platformId,
        itemTypeId:          inventoryFilters.itemTypeId,
        conservationStateId: inventoryFilters.conservationStateId,
        search:              inventoryFilters.search,
        sortBy:              inventorySortBy,
        page,
        pageSize: 50
      })
      .then((data) => { if (!canceled) setResult(data); })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [inventoryFilters, inventorySortBy, page, reloadToken]);

  // Filtros ou ordenacao mudaram: volta para pagina 1 e fecha detalhe.
  useEffect(() => {
    setPage(1);
    setSelectedItem(null);
  }, [inventoryFilters, inventorySortBy]);

  // Mantem o texto local alinhado quando a busca e alterada por outro fluxo.
  useEffect(() => {
    setLocalSearch(inventoryFilters.search ?? "");
  }, [inventoryFilters.search]);

  // Limpa debounce pendente ao desmontar para evitar update tardio no filtro.
  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  function handleSearchChange(value: string) {
    setLocalSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setInventoryFilters({ search: value || null });
    }, 300);
  }

  function handleOpenCreate() { setEditItem(null); setFormOpen(true); }

  // Sinal da sidebar para abrir formulário de criação
  useEffect(() => {
    if (!inventoryCreateOpen) return;
    handleOpenCreate();
    setInventoryCreateOpen(false);
  }, [inventoryCreateOpen, setInventoryCreateOpen]);

  function handleOpenEdit(item: HardwareItem) { setEditItem(item); setFormOpen(true); }

  function handleFormSave(saved: HardwareItem) {
    setFormOpen(false);
    reloadItems();
    setSelectedItem(saved);
  }

  function handleDeleteComplete() {
    setSelectedItem(null);
    reloadItems();
  }

  // A busca fica sempre visivel no topo para permitir voltar/filtrar sem sair do inventario.
  return (
    <div className="hw-inventory">
      {/* Topo padrao: busca, ordenacao, alternancia cards/lista e contador. */}
      <header className="topbar hw-inventory-topbar">
        <div className="topbar-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="text"
            placeholder="Buscar inventário"
            aria-label="Buscar inventário"
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        {!selectedItem && (
          <>
            <nav className="topbar-menu" aria-label="Visualização do inventário">
              <button
                type="button"
                className="topbar-icon"
                title={inventorySortTitle}
                aria-label={inventorySortTitle}
                onClick={() => setInventorySortBy(nextInventorySort)}
              >
                <ArrowUpDown aria-hidden="true" size={18} />
              </button>

              <div className="view-switch">
                <button
                  type="button"
                  className={inventoryViewMode === "grid" ? "active" : ""}
                  onClick={() => setInventoryViewMode("grid")}
                  title="Cards"
                  aria-label="Ver inventário em cards"
                >
                  <Grid2X2 aria-hidden="true" size={18} />
                </button>
                <button
                  type="button"
                  className={inventoryViewMode === "list" ? "active" : ""}
                  onClick={() => setInventoryViewMode("list")}
                  title="Lista"
                  aria-label="Ver inventário em lista"
                >
                  <List aria-hidden="true" size={18} />
                </button>
              </div>
            </nav>

            <div className="topbar-count">
              {loading ? "Carregando inventário..." : `Exibindo ${result.filtered} de ${result.total} itens`}
            </div>
          </>
        )}
      </header>

      {selectedItem ? (
        /* Area dedicada ao detalhe sem remover a busca fixa acima. */
        <div className="hw-inventory-detail-area">
          <HardwareItemDetail
            item={selectedItem}
            allItems={result.items}
            onEdit={() => handleOpenEdit(selectedItem)}
            onDelete={handleDeleteComplete}
            onClose={() => setSelectedItem(null)}
            onNavigate={(item) => setSelectedItem(item)}
          />
        </div>
      ) : (
        /* Area de itens alterna entre cards e lista sem trocar a busca fixa acima. */
        <div className="hw-inventory-grid-area hw-inventory-grid-full">
          {inventoryViewMode === "grid" ? (
            <HardwareInventoryGrid
              items={result.items}
              total={result.total}
              filtered={result.filtered}
              page={page}
              onPageChange={setPage}
              selectedItemId={null}
              onSelectItem={setSelectedItem}
            />
          ) : (
            <HardwareInventoryList
              items={result.items}
              filtered={result.filtered}
              page={page}
              onPageChange={setPage}
              selectedItemId={null}
              onSelectItem={setSelectedItem}
            />
          )}
        </div>
      )}

      {formOpen && (
        <HardwareItemForm
          item={editItem}
          onSave={handleFormSave}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}
