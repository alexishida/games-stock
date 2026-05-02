import { SettingsSection, useGameStockStore } from "../../store";
import { PlatformManager } from "../PlatformManager/PlatformManager";
import { RomFolderImporter } from "../RomFolderImporter/RomFolderImporter";
import "./SettingsModal.css";

const NAV_ITEMS: { id: SettingsSection; label: string; icon: string }[] = [
  { id: "biblioteca", label: "Biblioteca", icon: "folder_open" },
  { id: "plataformas", label: "Plataformas", icon: "videogame_asset" }
];

const SECTION_TITLES: Record<SettingsSection, { eyebrow: string; title: string }> = {
  biblioteca: { eyebrow: "Importacao em lote", title: "Gerenciar biblioteca" },
  plataformas: { eyebrow: "Configuracoes", title: "Gerenciar plataformas" }
};

export function SettingsModal() {
  const open = useGameStockStore((state) => state.settingsOpen);
  const section = useGameStockStore((state) => state.settingsSection);
  const setOpen = useGameStockStore((state) => state.setSettingsOpen);
  const setSection = useGameStockStore((state) => state.setSettingsSection);

  if (!open) return null;

  const { eyebrow, title } = SECTION_TITLES[section];

  return (
    <div className="modal-backdrop">
      <div className="settings-modal">
        <button type="button" className="settings-close icon-button" onClick={() => setOpen(false)}>×</button>
        <nav className="settings-nav">
          <p className="settings-nav-label">Configuracoes</p>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`settings-nav-item ${section === item.id ? "active" : ""}`}
              onClick={() => setSection(item.id)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          <header className="settings-header">
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </header>

          <div className="settings-body">
            {section === "biblioteca" && (
              <RomFolderImporter onClose={() => setOpen(false)} />
            )}
            {section === "plataformas" && (
              <PlatformManager />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
