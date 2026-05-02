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
        <span className="material-symbols-outlined" aria-hidden="true">search</span>
        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar biblioteca" />
      </div>
      {!selectedGameId && (
        <>
          <nav className="topbar-menu" aria-label="Visualizacao da biblioteca">
            <button type="button" className="topbar-icon" title="Ordenar" onClick={() => setSortBy(nextSort)}>
              <span className="material-symbols-outlined" aria-hidden="true">sort</span>
            </button>
            <div className="view-switch">
              <button type="button" className={viewMode === "grid" ? "active" : ""} onClick={() => setViewMode("grid")} title="Grade">
                <span className="material-symbols-outlined" aria-hidden="true">grid_view</span>
              </button>
              <button type="button" className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")} title="Lista">
                <span className="material-symbols-outlined" aria-hidden="true">view_list</span>
              </button>
            </div>
          </nav>
          <div className="topbar-count">Exibindo {filtered} de {total} jogos</div>
        </>
      )}
    </header>
  );
}
