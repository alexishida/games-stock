import { FolderOpen, Gamepad2, X } from "lucide-react";
import { SettingsSection, useGameStockStore } from "../../store";
import { PlatformManager } from "../PlatformManager/PlatformManager";
import { RomFolderImporter } from "../RomFolderImporter/RomFolderImporter";
import "./SettingsModal.css";

const NAV_ITEMS: { id: SettingsSection; label: string; Icon: typeof FolderOpen }[] = [
  { id: "biblioteca", label: "Biblioteca", Icon: FolderOpen },
  { id: "plataformas", label: "Plataformas", Icon: Gamepad2 }
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
        <button type="button" className="settings-close icon-button" onClick={() => setOpen(false)} aria-label="Fechar">
          <X aria-hidden="true" size={18} />
        </button>
        <nav className="settings-nav">
          <p className="settings-nav-label">Configuracoes</p>
          {NAV_ITEMS.map(({ Icon, ...item }) => (
            <button
              key={item.id}
              type="button"
              className={`settings-nav-item ${section === item.id ? "active" : ""}`}
              onClick={() => setSection(item.id)}
            >
              <Icon aria-hidden="true" size={18} />
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
