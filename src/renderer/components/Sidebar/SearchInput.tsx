import { useGameStockStore } from "../../store";

export function SearchInput() {
  const searchQuery = useGameStockStore((state) => state.searchQuery);
  const setSearchQuery = useGameStockStore((state) => state.setSearchQuery);

  return (
    <div className="search-input">
      <span aria-hidden="true">⌕</span>
      <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar jogos" />
      <button type="button" title="Filtro">≡</button>
    </div>
  );
}
