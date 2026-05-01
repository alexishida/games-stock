import { useGameStockStore } from "../../store";
import { CategoryDropdown } from "./CategoryDropdown";
import { PlatformTree } from "./PlatformTree";
import "./Sidebar.css";

export function Sidebar() {
  const setImporterOpen = useGameStockStore((state) => state.setImporterOpen);

  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="brand-mark">
          <span className="material-symbols-outlined" aria-hidden="true">videogame_asset</span>
        </div>
        <div>
          <strong>GameStock</strong>
          <span>ROM Manager</span>
        </div>
      </div>
      <nav className="sidebar-nav" aria-label="Navegacao principal">
        <button type="button" className="nav-item active">
          <span className="material-symbols-outlined" aria-hidden="true">library_books</span>
          Biblioteca
        </button>
        <button type="button" className="nav-item">
          <span className="material-symbols-outlined" aria-hidden="true">pending_actions</span>
          Pendentes
        </button>
      </nav>
      <div className="sidebar-label">Plataformas</div>
      <CategoryDropdown />
      <PlatformTree />
      <button type="button" className="scan-button" onClick={() => setImporterOpen(true)}>
        <span className="material-symbols-outlined" aria-hidden="true">sync</span>
        Scan New ROMs
      </button>
    </aside>
  );
}
