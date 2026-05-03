import { BookOpen, Gamepad2, Settings } from "lucide-react";
import { useGameStockStore } from "../../store";
import { PlatformTree } from "./PlatformTree";
import "./Sidebar.css";

export function Sidebar() {
  const openSettings = useGameStockStore((state) => state.openSettings);

  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="brand-mark">
          <Gamepad2 aria-hidden="true" size={22} />
        </div>
        <div>
          <strong>GameStock</strong>
          <span>Games Management</span>
        </div>
      </div>
      <nav className="sidebar-nav" aria-label="Navegacao principal">
        <button type="button" className="nav-item active">
          <BookOpen aria-hidden="true" size={18} />
          Biblioteca
        </button>
        <button type="button" className="nav-item">
          <Gamepad2 aria-hidden="true" size={18} />
          Inventario
        </button>
      </nav>
      <PlatformTree />
      <button type="button" className="scan-button" onClick={() => openSettings("biblioteca")}>
        <Settings aria-hidden="true" size={18} />
        Configurações
      </button>
    </aside>
  );
}
