import { Search, SlidersHorizontal } from "lucide-react";
import { useGameStockStore } from "../../store";

export function SearchInput() {
  const searchQuery = useGameStockStore((state) => state.searchQuery);
  const setSearchQuery = useGameStockStore((state) => state.setSearchQuery);

  return (
    <div className="search-input">
      <Search size={16} aria-hidden="true" />
      <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar jogos" />
      <button type="button" title="Filtro" aria-label="Filtro">
        <SlidersHorizontal size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
