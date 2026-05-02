import { ArrowUpDown, Grid2X2, List, Search } from "lucide-react";
import { useGameStockStore } from "../../store";
import "./TopBar.css";

export function TopBar() {
  const searchQuery = useGameStockStore((state) => state.searchQuery);
  const filtered = useGameStockStore((state) => state.filtered);
  const total = useGameStockStore((state) => state.total);
  const viewMode = useGameStockStore((state) => state.viewMode);
  const sortBy = useGameStockStore((state) => state.sortBy);
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  const setSearchQuery = useGameStockStore((state) => state.setSearchQuery);
  const setViewMode = useGameStockStore((state) => state.setViewMode);
  const setSortBy = useGameStockStore((state) => state.setSortBy);

  const nextSort = sortBy === "title" ? "year" : sortBy === "year" ? "recent" : "title";

  return (
    <header className="topbar">
      <div className="topbar-search">
        <Search aria-hidden="true" size={18} />
        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar biblioteca" />
      </div>
      {!selectedGameId && (
        <>
          <nav className="topbar-menu" aria-label="Visualizacao da biblioteca">
            <button type="button" className="topbar-icon" title="Ordenar" onClick={() => setSortBy(nextSort)}>
              <ArrowUpDown aria-hidden="true" size={18} />
            </button>
            <div className="view-switch">
              <button type="button" className={viewMode === "grid" ? "active" : ""} onClick={() => setViewMode("grid")} title="Grade">
                <Grid2X2 aria-hidden="true" size={18} />
              </button>
              <button type="button" className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")} title="Lista">
                <List aria-hidden="true" size={18} />
              </button>
            </div>
          </nav>
          <div className="topbar-count">Exibindo {filtered} de {total} jogos</div>
        </>
      )}
    </header>
  );
}
