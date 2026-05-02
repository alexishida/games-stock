import { useGameStockStore } from "../../store";
import { PlatformTree } from "./PlatformTree";
import "./Sidebar.css";

export function Sidebar() {
  const openSettings = useGameStockStore((state) => state.openSettings);

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
          <span className="material-symbols-outlined" aria-hidden="true">videogame_asset</span>
          Inventario
        </button>
      </nav>
      <PlatformTree />
      <button type="button" className="scan-button" onClick={() => openSettings("biblioteca")}>
        <span className="material-symbols-outlined" aria-hidden="true">manage_search</span>
        Gerenciar biblioteca
      </button>
    </aside>
  );
}
