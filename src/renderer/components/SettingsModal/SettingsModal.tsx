import { FolderOpen, Gamepad2, Images, Settings, X } from "lucide-react";
import { CoversSettings } from "../CoversSettings/CoversSettings";
import { SettingsSection, useGameStockStore } from "../../store";
import { PlatformManager } from "../PlatformManager/PlatformManager";
import { RomFolderImporter } from "../RomFolderImporter/RomFolderImporter";
import "./SettingsModal.css";

const NAV_ITEMS: { id: SettingsSection; label: string; Icon: typeof FolderOpen }[] = [
  { id: "biblioteca", label: "Biblioteca", Icon: FolderOpen },
  { id: "plataformas", label: "Plataformas", Icon: Gamepad2 },
  { id: "covers", label: "Mídia da biblioteca", Icon: Images }
];

const SECTION_TITLES: Record<SettingsSection, { eyebrow?: string; title: string }> = {
  biblioteca: { title: "Gerenciar biblioteca" },
  plataformas: { title: "Gerenciar plataformas" },
  covers: { title: "Gerenciar mídia da biblioteca" }
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
        <nav className="settings-nav">
          <p className="settings-nav-label">
            <Settings aria-hidden="true" size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
            Configurações
          </p>
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
            <div>
              {eyebrow && <p className="eyebrow">{eyebrow}</p>}
              <h2>{title}</h2>
            </div>
            <button type="button" className="icon-button modal-close-button" onClick={() => setOpen(false)} aria-label="Fechar">
              <X aria-hidden="true" size={18} />
            </button>
          </header>

          <div className="settings-body">
            {section === "biblioteca" && (
              <RomFolderImporter onImportStarted={() => setSection("covers")} />
            )}
            {section === "plataformas" && (
              <PlatformManager />
            )}
            {section === "covers" && (
              <CoversSettings />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
