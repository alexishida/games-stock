import { useEffect, useState } from "react";
import { DatabaseBackup, ExternalLink, FolderOpen, Gamepad2, HardDrive, Images, Info, Library, MonitorPlay, Settings, Waypoints, X } from "lucide-react";
import { CoversSettings } from "../CoversSettings/CoversSettings";
import { DataPortabilitySettings } from "../DataPortabilitySettings/DataPortabilitySettings";
import { EmulatorsSettings } from "../EmulatorsSettings/EmulatorsSettings";
import { SettingsSection, useGameStockStore } from "../../store";
import { PlatformManager } from "../PlatformManager/PlatformManager";
import { RomFolderImporter } from "../RomFolderImporter/RomFolderImporter";
import { SectionIntro } from "../SectionIntro/SectionIntro";
import "./SettingsModal.css";

const NAV_ITEMS: Array<{ id: SettingsSection; label: string; Icon: typeof FolderOpen; group: "library" | "app" }> = [
  { id: "geral", label: "Geral", Icon: Settings, group: "app" },
  { id: "plataformas", label: "Plataformas", Icon: Gamepad2, group: "library" },
  { id: "emuladores", label: "Emuladores", Icon: MonitorPlay, group: "library" },
  { id: "biblioteca", label: "Biblioteca", Icon: FolderOpen, group: "library" },
  { id: "covers", label: "Mídia da biblioteca", Icon: Images, group: "library" },
  { id: "backup", label: "Backup", Icon: DatabaseBackup, group: "app" },
  { id: "sobre", label: "Sobre", Icon: Info, group: "app" }
];

const SECTION_TITLES: Record<SettingsSection, { eyebrow?: string; title: string }> = {
  geral: { eyebrow: "Aplicativo", title: "Configurações gerais" },
  backup: { eyebrow: "Aplicativo", title: "Backup da biblioteca" },
  biblioteca: { title: "Gerenciar biblioteca" },
  plataformas: { title: "Gerenciar plataformas" },
  emuladores: { title: "Gerenciar emuladores" },
  covers: { title: "Gerenciar mídia da biblioteca" },
  sobre: { eyebrow: "Aplicativo", title: "Sobre o GameStock" }
};

export function SettingsModal() {
  const open = useGameStockStore((state) => state.settingsOpen);
  const section = useGameStockStore((state) => state.settingsSection);
  const setOpen = useGameStockStore((state) => state.setSettingsOpen);
  const setSection = useGameStockStore((state) => state.setSettingsSection);
  const [appVersion, setAppVersion] = useState("");
  const [storageStats, setStorageStats] = useState<{ totalGames: number; dataDirSizeMb: number; dataDirPath: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    let mounted = true;

    void window.gameStockAPI.app.getVersion().then((version) => {
      if (mounted) setAppVersion(version);
    });
    void window.gameStockAPI.app.getStorageStats().then((stats) => {
      if (mounted) setStorageStats(stats);
    });

    return () => {
      mounted = false;
    };
  }, [open]);

  if (!open) return null;

  const { eyebrow, title } = SECTION_TITLES[section];
  const appNavItems = NAV_ITEMS.filter((item) => item.group === "app");
  const libraryNavItems = NAV_ITEMS.filter((item) => item.group === "library");
  const generalNavItem = appNavItems.find((item) => item.id === "geral");
  const secondaryAppNavItems = appNavItems.filter((item) => item.id !== "geral");
  const totalGamesLabel = storageStats ? `${storageStats.totalGames} jogos` : "Carregando";
  const dataDirSizeLabel = storageStats ? `${storageStats.dataDirSizeMb.toFixed(1)} MB` : "Carregando";

  return (
    <div className="modal-backdrop">
      <div className="settings-modal">
        <nav className="settings-nav">
          <p className="settings-nav-label">
            <Settings aria-hidden="true" size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
            Configurações
          </p>
          {generalNavItem ? (
            <button
              type="button"
              className={`settings-nav-item ${section === generalNavItem.id ? "active" : ""}`}
              onClick={() => setSection(generalNavItem.id)}
            >
              <generalNavItem.Icon aria-hidden="true" size={18} />
              {generalNavItem.label}
            </button>
          ) : null}
          <div className="settings-nav-separator" aria-hidden="true" />
          {libraryNavItems.map(({ Icon, ...item }) => (
            item.id === "emuladores" ? (
              <div key={item.id}>
                <button
                  type="button"
                  className={`settings-nav-item ${section === item.id ? "active" : ""}`}
                  onClick={() => setSection(item.id)}
                >
                  <Icon aria-hidden="true" size={18} />
                  {item.label}
                </button>
                <div className="settings-nav-separator" aria-hidden="true" />
              </div>
            ) : (
              <button
                key={item.id}
                type="button"
                className={`settings-nav-item ${section === item.id ? "active" : ""}`}
                onClick={() => setSection(item.id)}
              >
                <Icon aria-hidden="true" size={18} />
                {item.label}
              </button>
            )
          ))}
          <div className="settings-nav-separator" aria-hidden="true" />
          {secondaryAppNavItems.map(({ Icon, ...item }) => (
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
            {section === "geral" && (
              <section className="settings-section-grid">
                <SectionIntro
                  title="Resumo do aplicativo"
                  description="Estado atual da instalação, biblioteca local e armazenamento usado pelo GameStock."
                />

                <div className="settings-summary-grid">
                  <article className="settings-summary-card">
                    <div className="settings-summary-label">
                      <Waypoints aria-hidden="true" size={14} />
                      <span>Versão</span>
                    </div>
                    <strong className="settings-summary-value">{appVersion || "Carregando"}</strong>
                  </article>

                  <article className="settings-summary-card">
                    <div className="settings-summary-label">
                      <Library aria-hidden="true" size={14} />
                      <span>Biblioteca</span>
                    </div>
                    <strong className="settings-summary-value">{totalGamesLabel}</strong>
                  </article>

                  <article className="settings-summary-card">
                    <div className="settings-summary-label">
                      <HardDrive aria-hidden="true" size={14} />
                      <span>Dados locais</span>
                    </div>
                    <strong className="settings-summary-value">{dataDirSizeLabel}</strong>
                  </article>
                </div>

                <div className="settings-info-card">
                  <div className="settings-info-card-icon">
                    <FolderOpen aria-hidden="true" size={18} />
                  </div>
                  <div>
                    <strong>Pasta de dados</strong>
                    <p>
                      Arquivos locais, banco e imagens da biblioteca ficam centralizados na pasta de dados do aplicativo.
                    </p>
                    <button
                      type="button"
                      className="about-open-folder-button"
                      onClick={() => storageStats && void window.gameStockAPI.shell.openPath(storageStats.dataDirPath)}
                      disabled={!storageStats}
                    >
                      <FolderOpen aria-hidden="true" size={15} />
                      Abrir pasta de dados
                      <ExternalLink aria-hidden="true" size={13} className="about-open-folder-external" />
                    </button>
                  </div>
                </div>
              </section>
            )}
            {section === "backup" && (
              <DataPortabilitySettings appVersion={appVersion} storageStats={storageStats} />
            )}
            {section === "biblioteca" && (
              <RomFolderImporter onImportStarted={() => setSection("covers")} />
            )}
            {section === "plataformas" && (
              <PlatformManager />
            )}
            {section === "emuladores" && (
              <EmulatorsSettings />
            )}
            {section === "covers" && (
              <CoversSettings />
            )}
            {section === "sobre" && (
              <div className="about-page">
                <div className="about-app-icon">
                  <Gamepad2 aria-hidden="true" size={40} />
                </div>
                <h3 className="about-app-name">GameStock</h3>
                {appVersion && (
                  <span className="about-version-badge">v{appVersion}</span>
                )}
                <p className="about-description">
                  Organizador de biblioteca para jogos com cadastro manual,
                  importação de ROMs, gerenciamento de mídia e integração com emuladores.
                </p>
                <div className="about-divider" />
                <div className="about-meta">
                  <div className="about-meta-row">
                    <span className="about-meta-label">Jogos na biblioteca</span>
                    <span className="about-meta-value">
                      {storageStats != null ? `${storageStats.totalGames} jogos` : "—"}
                    </span>
                  </div>
                  <div className="about-meta-row">
                    <span className="about-meta-label">Espaço em disco</span>
                    <span className="about-meta-value">
                      {storageStats != null ? `${storageStats.dataDirSizeMb} MB` : "—"}
                    </span>
                  </div>
                  <div className="about-meta-row">
                    <span className="about-meta-label">Criado por</span>
                    <span className="about-meta-value about-meta-author">Alex Ishida</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="about-open-folder-button"
                  onClick={() => storageStats && void window.gameStockAPI.shell.openPath(storageStats.dataDirPath)}
                  disabled={!storageStats}
                >
                  <FolderOpen aria-hidden="true" size={15} />
                  Abrir pasta de dados
                  <ExternalLink aria-hidden="true" size={13} className="about-open-folder-external" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
