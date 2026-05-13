/**
 * HardwareInventory.tsx
 *
 * Componente orquestrador do módulo de inventário físico de hardware.
 *
 * Quando nenhum item está selecionado → exibe barra de busca + grade paginada.
 * Quando um item é selecionado → exibe HardwareItemDetail em tela cheia,
 * seguindo o mesmo padrão de alternância do GameDetail na biblioteca.
 */

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { HardwareItem, HardwareItemListResult } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { HardwareInventoryGrid } from "./HardwareInventoryGrid";
import { HardwareItemDetail } from "./HardwareItemDetail";
import { HardwareItemForm } from "./HardwareItemForm";
import "./HardwareInventory.css";

/** Módulo completo do inventário de hardware. */
export function HardwareInventory() {
  const inventoryFilters      = useGameStockStore((state) => state.inventoryFilters);
  const setInventoryFilters   = useGameStockStore((state) => state.setInventoryFilters);
  const inventoryCreateOpen   = useGameStockStore((state) => state.inventoryCreateOpen);
  const setInventoryCreateOpen = useGameStockStore((state) => state.setInventoryCreateOpen);

  const [result, setResult]         = useState<HardwareItemListResult>({ items: [], total: 0, filtered: 0 });
  const [page, setPage]             = useState(1);
  const [selectedItem, setSelectedItem] = useState<HardwareItem | null>(null);
  const [formOpen, setFormOpen]     = useState(false);
  const [editItem, setEditItem]     = useState<HardwareItem | null>(null);
  const [loading, setLoading]       = useState(false);

  const [localSearch, setLocalSearch] = useState(inventoryFilters.search ?? "");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

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
        page,
        pageSize: 50
      })
      .then((data) => { if (!canceled) setResult(data); })
      .finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [inventoryFilters, page, reloadToken]);

  // Filtros mudaram → volta para página 1 e fecha detalhe
  useEffect(() => {
    setPage(1);
    setSelectedItem(null);
  }, [inventoryFilters]);

  function handleSearchChange(value: string) {
    setLocalSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setInventoryFilters({ ...inventoryFilters, search: value || null });
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

  // Quando item selecionado → tela cheia de detalhe (mesmo padrão do GameDetail)
  if (selectedItem) {
    return (
      <>
        <HardwareItemDetail
          item={selectedItem}
          allItems={result.items}
          onEdit={() => handleOpenEdit(selectedItem)}
          onDelete={handleDeleteComplete}
          onClose={() => setSelectedItem(null)}
          onNavigate={(item) => setSelectedItem(item)}
        />
        {formOpen && (
          <HardwareItemForm
            item={editItem}
            onSave={handleFormSave}
            onClose={() => setFormOpen(false)}
          />
        )}
      </>
    );
  }

  // Grade de itens
  return (
    <div className="hw-inventory">
      {/* Barra de busca */}
      <div className="hw-inventory-toolbar">
        <div className="hw-search-wrap">
          <Search size={14} aria-hidden="true" className="hw-search-icon" />
          <input
            type="text"
            placeholder="Buscar por nome…"
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="hw-search-input"
          />
        </div>
      </div>

      {/* Contador */}
      <div className="hw-inventory-count">
        {loading
          ? "Carregando…"
          : result.filtered === result.total
            ? `${result.total} item${result.total !== 1 ? "s" : ""}`
            : `${result.filtered} de ${result.total} item${result.total !== 1 ? "s" : ""}`
        }
      </div>

      {/* Grade */}
      <div className="hw-inventory-grid-area hw-inventory-grid-full">
        <HardwareInventoryGrid
          items={result.items}
          total={result.total}
          filtered={result.filtered}
          page={page}
          onPageChange={setPage}
          selectedItemId={null}
          onSelectItem={setSelectedItem}
        />
      </div>

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
