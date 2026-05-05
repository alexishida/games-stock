import { type ReactNode } from "react";
import { Gamepad2, Library, Settings, Star, Trophy } from "lucide-react";
import { CollectionCounts, CollectionFilter } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { PlatformTree } from "./PlatformTree";
import "./Sidebar.css";

type FilterDef = { value: CollectionFilter; label: string; icon: ReactNode; countKey: keyof CollectionCounts };

const COLLECTION_FILTERS: FilterDef[] = [
  { value: "favorites", label: "Favoritos", icon: <Star aria-hidden="true" size={15} />, countKey: "favorites" },
  { value: "playing", label: "Jogando", icon: <Gamepad2 aria-hidden="true" size={15} />, countKey: "playing" },
  { value: "completed", label: "Concluído", icon: <Trophy aria-hidden="true" size={15} />, countKey: "completed" }
];

export function Sidebar() {
  const openSettings = useGameStockStore((state) => state.openSettings);
  const collectionFilter = useGameStockStore((state) => state.collectionFilter);
  const collectionCounts = useGameStockStore((state) => state.collectionCounts);
  const setCollectionFilter = useGameStockStore((state) => state.setCollectionFilter);
  const setSelectedPlatformId = useGameStockStore((state) => state.setSelectedPlatformId);

  // Toda navegacao atual pertence a Biblioteca.
  // So deve perder estado ativo quando existir fluxo real de Inventario.
  const isLibraryActive = true;

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
      <nav className="sidebar-nav" aria-label="Navegação principal">
        <button type="button" className={isLibraryActive ? "nav-item active" : "nav-item"} onClick={() => setSelectedPlatformId(null)}>
          <Library aria-hidden="true" size={18} />
          Biblioteca
        </button>
        <button type="button" className="nav-item">
          <Gamepad2 aria-hidden="true" size={18} />
          Inventário
        </button>
      </nav>
      <div className="sidebar-separator" />
      <nav className="sidebar-nav" aria-label="Filtros de coleção">
        {COLLECTION_FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            className={collectionFilter === item.value ? "nav-item nav-item-sub active" : "nav-item nav-item-sub"}
            onClick={() => setCollectionFilter(item.value)}
          >
            {item.icon}
            {item.label}
            <span className="nav-item-count">{collectionCounts[item.countKey]}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-separator" />
      <PlatformTree />
      <button type="button" className="scan-button" onClick={() => openSettings("biblioteca")}>
        <Settings aria-hidden="true" size={18} />
        Configurações
      </button>
    </aside>
  );
}
