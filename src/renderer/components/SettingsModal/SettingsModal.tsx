/**
 * SettingsModal.tsx
 *
 * Modal principal de configurações do GameStock.
 * Exibe um layout com navegação lateral (nav) e conteúdo à direita,
 * permitindo alternar entre as seções:
 *  - Geral: resumo da instalação (versão, biblioteca, armazenamento)
 *  - Plataformas: gerenciamento de plataformas (PlatformManager)
 *  - Emuladores: configuração de emuladores (EmulatorsSettings)
 *  - Biblioteca: pastas de ROMs (RomFolderImporter)
 *  - Mídia: download de capas (CoversSettings)
 *  - Backup: portabilidade de dados (DataPortabilitySettings)
 *  - Sobre: informações do app e acesso à pasta de dados
 *
 * O modal é arrastável via hook useDraggableDialog.
 * A seção ativa é controlada pelo store (settingsSection).
 */

import { useEffect, useState } from "react";
import { DatabaseBackup, ExternalLink, FolderOpen, Gamepad2, HardDrive, Images, Info, Library, MonitorPlay, RefreshCw, Settings, Waypoints, X } from "lucide-react";
import { CoversSettings } from "../CoversSettings/CoversSettings";
import { DataPortabilitySettings } from "../DataPortabilitySettings/DataPortabilitySettings";
import { EmulatorsSettings } from "../EmulatorsSettings/EmulatorsSettings";
import { useDraggableDialog } from "../../hooks/useDraggableDialog";
import { SettingsSection, useGameStockStore } from "../../store";
import { PlatformManager } from "../PlatformManager/PlatformManager";
import { RomFolderImporter } from "../RomFolderImporter/RomFolderImporter";
import { SectionIntro } from "../SectionIntro/SectionIntro";
import type { UpdaterAppInfo, UpdaterStatus } from "../../../shared/updater";
import "./SettingsModal.css";

/**
 * Itens de navegação do menu lateral.
 * Cada item define seu id (SettingsSection), label, ícone e grupo ("library" ou "app").
 * O agrupamento controla onde os separadores aparecem no nav.
 */
const NAV_ITEMS: Array<{ id: SettingsSection; label: string; Icon: typeof FolderOpen; group: "library" | "app" }> = [
  { id: "geral", label: "Geral", Icon: Settings, group: "app" },
  { id: "plataformas", label: "Plataformas", Icon: Gamepad2, group: "library" },
  { id: "emuladores", label: "Emuladores", Icon: MonitorPlay, group: "library" },
  { id: "biblioteca", label: "Biblioteca", Icon: FolderOpen, group: "library" },
  { id: "covers", label: "Mídia da biblioteca", Icon: Images, group: "library" },
  { id: "backup", label: "Backup", Icon: DatabaseBackup, group: "app" },
  { id: "sobre", label: "Sobre", Icon: Info, group: "app" }
];

/**
 * Títulos e eyebrows (subtítulos de contexto) para cada seção.
 * Eyebrow é opcional; aparece acima do título principal no header do conteúdo.
 */
const SECTION_TITLES: Record<SettingsSection, { eyebrow?: string; title: string }> = {
  geral: { eyebrow: "Aplicativo", title: "Configurações gerais" },
  backup: { eyebrow: "Aplicativo", title: "Backup da biblioteca" },
  biblioteca: { title: "Gerenciar biblioteca" },
  plataformas: { title: "Gerenciar plataformas" },
  emuladores: { title: "Gerenciar emuladores" },
  covers: { title: "Gerenciar mídia da biblioteca" },
  sobre: { eyebrow: "Aplicativo", title: "Sobre o GameStock" }
};

/**
 * Fases que representam operação ativa do updater manual.
 * Enquanto uma delas estiver presente, o botão da UI fica bloqueado.
 */
const RUNNING_UPDATER_PHASES = new Set<UpdaterStatus["phase"]>(["checking", "downloading", "applying"]);

/**
 * Retorna `true` quando a fase recebida ainda representa trabalho em andamento.
 */
function isUpdaterBusy(status: UpdaterStatus | null): boolean {
  return status ? RUNNING_UPDATER_PHASES.has(status.phase) : false;
}

/**
 * Gera texto principal do card de atualização com base no último status recebido.
 */
function updaterSummary(status: UpdaterStatus | null): string {
  if (!status) {
    return "Pronto para comparar sua instalação com a release publicada.";
  }

  if (status.phase === "up-to-date") {
    return "Sua instalação já corresponde à release publicada.";
  }

  if (status.phase === "no-connection") {
    return "Não foi possível acessar o servidor de atualização.";
  }

  if (status.phase === "error") {
    return "Não foi possível concluir a verificação.";
  }

  if (status.phase === "downloading") {
    return "Atualização encontrada. Baixando pacote para preparar a troca.";
  }

  if (status.phase === "applying") {
    return "Pacote baixado. Preparando reinicialização do aplicativo.";
  }

  return status.message;
}

/**
 * Gera texto auxiliar com próximos passos e detalhes de erro/progresso.
 */
function updaterDetail(status: UpdaterStatus | null, appInfo: UpdaterAppInfo | null): string {
  const installedLabel = appInfo
    ? `Instalada: ${formatUpdaterVersion(appInfo.version)}, build ${formatUpdaterBuild(appInfo.buildNumber)}.`
    : "Dados da build instalada ainda carregando.";

  if (!status) {
    return `${installedLabel} Use Buscar atualização para consultar a versão disponível.`;
  }

  if (status.phase === "downloading") {
    return typeof status.percent === "number"
      ? `${status.percent}% concluído. O app reinicia automaticamente ao terminar.`
      : "Download em andamento. O app reinicia automaticamente ao terminar.";
  }

  if (status.phase === "up-to-date") {
    return `Disponível: ${formatUpdaterVersion(status.version)}, build ${formatUpdaterBuild(status.buildNumber)}.`;
  }

  if (status.phase === "error" || status.phase === "no-connection") {
    return status.error ?? "Tente novamente em instantes.";
  }

  if (status.phase === "applying") {
    return "O app vai reiniciar automaticamente ao terminar.";
  }

  return status.message;
}

/**
 * Define o rótulo dinâmico do botão conforme etapa atual do updater.
 */
function updaterButtonLabel(status: UpdaterStatus | null): string {
  if (!status) return "Buscar atualização";
  if (status.phase === "checking") return "Buscando...";
  if (status.phase === "downloading") return "Baixando...";
  if (status.phase === "applying") return "Aplicando...";
  return "Buscar atualização";
}

/**
 * Formata versão para exibição consistente com prefixo `v`.
 */
function formatUpdaterVersion(version: string | undefined): string {
  return version?.trim() ? `v${version}` : "—";
}

/**
 * Formata identificador de build para exibição humana no modal.
 */
function formatUpdaterBuild(buildNumber: string | number | undefined): string {
  if (typeof buildNumber === "number") return String(buildNumber);
  return buildNumber?.trim() ? buildNumber : "—";
}

/**
 * Retorna rótulo curto de status para leitura rápida no topo do modal.
 */
function updaterStatusLabel(status: UpdaterStatus | null): string {
  if (!status) return "Aguardando busca";
  if (status.phase === "checking") return "Buscando atualização";
  if (status.phase === "downloading") return "Baixando pacote";
  if (status.phase === "applying") return "Preparando reinício";
  if (status.phase === "up-to-date") return "Atualizado";
  if (status.phase === "no-connection") return "Sem conexão";
  return "Falha";
}

/**
 * Formata data do manifesto, aceitando ISO ou formato legado `YYYY-MM-DD HH:mm:ss`.
 */
function formatUpdaterReleaseDate(value: string | undefined): string {
  if (!value?.trim()) return "—";
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!match) return trimmed;
  const [, year, month, day, hour, minute] = match;
  return hour && minute ? `${day}/${month}/${year} ${hour}:${minute}` : `${day}/${month}/${year}`;
}

/**
 * Modal de configurações principal do app.
 * Busca versão e estatísticas de armazenamento via IPC ao abrir.
 * Controla a seção ativa via store (settingsSection).
 */
export function SettingsModal() {
  // Controla se o modal está aberto
  const open = useGameStockStore((state) => state.settingsOpen);
  // Seção ativa no momento (determina qual conteúdo é renderizado à direita)
  const section = useGameStockStore((state) => state.settingsSection);
  // Abre/fecha o modal de configurações
  const setOpen = useGameStockStore((state) => state.setSettingsOpen);
  // Muda a seção ativa
  const setSection = useGameStockStore((state) => state.setSettingsSection);

  // Versão do app exibida na seção "Geral" e "Sobre"
  const [appVersion, setAppVersion] = useState("");
  // Estatísticas de armazenamento: total de jogos, tamanho e caminho da pasta de dados
  const [storageStats, setStorageStats] = useState<{ totalGames: number; dataDirSizeMb: number; dataDirPath: string } | null>(null);
  // Versão semântica e build local usados no modal de atualização
  const [updaterAppInfo, setUpdaterAppInfo] = useState<UpdaterAppInfo | null>(null);
  // Último status recebido do updater manual disparado pela seção "Sobre"
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus | null>(null);
  // Controla abertura do modal secundário de atualização manual
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);

  // Hook para tornar o modal arrastável
  const draggable = useDraggableDialog<HTMLDivElement>();
  // Hook específico do modal secundário de atualização
  const updateDialogDraggable = useDraggableDialog<HTMLDivElement>();

  /**
   * Busca versão e estatísticas de armazenamento via IPC sempre que o modal abre.
   * Usa flag `mounted` para ignorar atualizações após desmontagem.
   */
  useEffect(() => {
    if (!open) return;
    let mounted = true;

    void window.gameStockAPI.app.getVersion().then((version) => {
      if (mounted) setAppVersion(version);
    });
    void window.gameStockAPI.app.getStorageStats().then((stats) => {
      if (mounted) setStorageStats(stats);
    });
    void window.gameStockAPI.updater.getAppInfo().then((info) => {
      if (mounted) setUpdaterAppInfo(info);
    });

    return () => {
      mounted = false;
    };
  }, [open]);

  /**
   * Escuta eventos de status do updater enviados pelo processo main.
   * O mesmo contrato da splash é reaproveitado pela verificação manual.
   */
  useEffect(() => {
    return window.gameStockAPI.updater.onStatus((status) => {
      setUpdaterStatus(status);
    });
  }, []);

  // Não renderiza quando o modal está fechado
  if (!open) return null;

  // Dados do header da seção atual (eyebrow + título)
  const { eyebrow, title } = SECTION_TITLES[section];

  // Divide os itens de navegação em grupos para inserir separadores visuais
  const appNavItems = NAV_ITEMS.filter((item) => item.group === "app");
  const libraryNavItems = NAV_ITEMS.filter((item) => item.group === "library");

  // "Geral" aparece no topo do nav, antes do separador
  const generalNavItem = appNavItems.find((item) => item.id === "geral");
  // Itens de app restantes (Backup, Sobre) ficam após os itens de biblioteca
  const secondaryAppNavItems = appNavItems.filter((item) => item.id !== "geral");

  // Labels formatados para as métricas da seção "Geral"
  const totalGamesLabel = storageStats ? `${storageStats.totalGames} jogos` : "Carregando";
  const dataDirSizeLabel = storageStats ? `${storageStats.dataDirSizeMb.toFixed(1)} MB` : "Carregando";
  // Feedback derivado do último status do updater manual
  const updaterBusy = isUpdaterBusy(updaterStatus);
  const updateSummaryText = updaterSummary(updaterStatus);
  const updateDetailText = updaterDetail(updaterStatus, updaterAppInfo);
  const updateButtonText = updaterButtonLabel(updaterStatus);
  // Labels normalizados para versão/build local e remoto exibidos no modal
  const localUpdaterVersionLabel = formatUpdaterVersion(updaterAppInfo?.version);
  const localUpdaterBuildLabel = formatUpdaterBuild(updaterAppInfo?.buildNumber);
  const remoteUpdaterVersionLabel = formatUpdaterVersion(updaterStatus?.version);
  const remoteUpdaterBuildLabel = formatUpdaterBuild(updaterStatus?.buildNumber);
  const remoteUpdaterReleaseDateLabel = formatUpdaterReleaseDate(updaterStatus?.releaseDate);
  const updateStatusLabel = updaterStatusLabel(updaterStatus);

  return (
    <div className="modal-backdrop">
      {/* Container arrastável do modal de configurações */}
      <div
        ref={draggable.dialogRef}
        className="settings-modal draggable-modal"
        style={draggable.style}
        onPointerDown={draggable.startDialogDrag}
        onPointerMove={draggable.dragDialog}
        onPointerUp={draggable.stopDialogDrag}
        onPointerCancel={draggable.stopDialogDrag}
      >
        {/* Navegação lateral com grupos separados por divisores */}
        <nav className="settings-nav">
          <p className="settings-nav-label">
            <Settings aria-hidden="true" size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
            Configurações
          </p>

          {/* Item "Geral" no topo, separado dos itens de biblioteca */}
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

          {/* Itens do grupo "library": Plataformas, Emuladores, Biblioteca, Mídia */}
          {libraryNavItems.map(({ Icon, ...item }) => (
            // "Emuladores" recebe um separador abaixo por ser o último de seu subgrupo
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

          {/* Itens secundários do grupo "app": Backup, Sobre */}
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

        {/* Área de conteúdo da seção ativa */}
        <div className="settings-content">
          {/* Header com eyebrow, título da seção e botão de fechar */}
          <header className="settings-header">
            <div>
              {/* Eyebrow de contexto (ex.: "Aplicativo") exibido quando definido */}
              {eyebrow && <p className="eyebrow">{eyebrow}</p>}
              <h2>{title}</h2>
            </div>
            <button type="button" className="icon-button modal-close-button" onClick={() => setOpen(false)} aria-label="Fechar">
              <X aria-hidden="true" size={18} />
            </button>
          </header>

          {/* Corpo da seção: renderização condicional por seção ativa */}
          <div className="settings-body">

            {/* Seção: Geral — resumo de versão, biblioteca e armazenamento */}
            {section === "geral" && (
              <section className="settings-section-grid">
                <SectionIntro
                  title="Resumo do aplicativo"
                  description="Estado atual da instalação, biblioteca local e armazenamento usado pelo GameStock."
                />

                {/* Cards de métricas: versão, total de jogos, tamanho em disco */}
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

                {/* Card informativo com botão para abrir a pasta de dados no Explorer */}
                <div className="settings-info-card">
                  <div className="settings-info-card-icon">
                    <FolderOpen aria-hidden="true" size={18} />
                  </div>
                  <div>
                    <strong>Pasta de dados</strong>
                    <p>
                      Arquivos locais, banco e imagens da biblioteca ficam centralizados na pasta de dados do aplicativo.
                    </p>
                    {/* Abre a pasta de dados no gerenciador de arquivos via IPC */}
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

            {/* Seção: Backup — exportação e importação de dados */}
            {section === "backup" && (
              <DataPortabilitySettings appVersion={appVersion} storageStats={storageStats} />
            )}

            {/* Seção: Biblioteca — gerenciamento de pastas de ROMs */}
            {section === "biblioteca" && (
              // Ao iniciar importação, navega automaticamente para a seção de mídia
              <RomFolderImporter onImportStarted={() => setSection("covers")} />
            )}

            {/* Seção: Plataformas — CRUD de plataformas e vínculos */}
            {section === "plataformas" && (
              <PlatformManager />
            )}

            {/* Seção: Emuladores — configuração de emuladores por plataforma */}
            {section === "emuladores" && (
              <EmulatorsSettings />
            )}

            {/* Seção: Mídia — download e gerenciamento de capas */}
            {section === "covers" && (
              <CoversSettings />
            )}

            {/* Seção: Sobre — informações do app, créditos e pasta de dados */}
            {section === "sobre" && (
              <div className="about-page">
                {/* Ícone decorativo do app */}
                <div className="about-app-icon">
                  <Gamepad2 aria-hidden="true" size={40} />
                </div>
                <h3 className="about-app-name">GameStock</h3>
                {/* Badge de versão exibido apenas quando carregado */}
                {appVersion && (
                  <span className="about-version-badge">v{appVersion}</span>
                )}
                <p className="about-description">
                  Organizador de biblioteca para jogos com cadastro manual,
                  importação de ROMs, gerenciamento de mídia e integração com emuladores.
                </p>
                <div className="about-divider" />

                {/* Metadados: jogos, armazenamento e autoria */}
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

                {/* Ações principais da seção Sobre: abrir modal de update e pasta de dados. */}
                <div className="about-actions">
                  {/* Botão para abrir a pasta de dados no gerenciador de arquivos */}
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

                  <button
                    type="button"
                    className="about-open-folder-button"
                    onClick={() => setUpdateDialogOpen(true)}
                  >
                    <RefreshCw aria-hidden="true" size={15} className={updaterBusy ? "about-update-spin" : ""} />
                    Buscar atualização
                  </button>
                </div>

                {/* Modal secundário arrastável com status detalhado de atualização. */}
                {updateDialogOpen && (
                  <div className="settings-secondary-overlay">
                    <section
                      ref={updateDialogDraggable.dialogRef}
                      className="about-update-dialog draggable-modal"
                      style={updateDialogDraggable.style}
                      onPointerDown={updateDialogDraggable.startDialogDrag}
                      onPointerMove={updateDialogDraggable.dragDialog}
                      onPointerUp={updateDialogDraggable.stopDialogDrag}
                      onPointerCancel={updateDialogDraggable.stopDialogDrag}
                    >
                      <header className="about-update-dialog-header">
                        <div>
                          <h3>Buscar atualização</h3>
                        </div>
                        <button
                          type="button"
                          className="icon-button modal-close-button"
                          onClick={() => setUpdateDialogOpen(false)}
                          aria-label="Fechar"
                        >
                          <X aria-hidden="true" size={18} />
                        </button>
                      </header>

                      <div className="about-update-dialog-body">
                        <p className="about-update-status-text">{updateSummaryText} {updateDetailText}</p>

                        {/* Tabela compacta com dados instalados e remotos para diagnóstico rápido. */}
                        <div className="about-meta about-update-meta">
                          <div className="about-meta-row">
                            <span className="about-meta-label">Status</span>
                            <span className="about-meta-value">{updateStatusLabel}</span>
                          </div>
                          <div className="about-meta-row">
                            <span className="about-meta-label">Versão instalada</span>
                            <span className="about-meta-value">{localUpdaterVersionLabel}</span>
                          </div>
                          <div className="about-meta-row">
                            <span className="about-meta-label">Build instalada</span>
                            <span className="about-meta-value">{localUpdaterBuildLabel}</span>
                          </div>
                          <div className="about-meta-row">
                            <span className="about-meta-label">Versão disponível</span>
                            <span className="about-meta-value">{remoteUpdaterVersionLabel}</span>
                          </div>
                          <div className="about-meta-row">
                            <span className="about-meta-label">Build disponível</span>
                            <span className="about-meta-value">{remoteUpdaterBuildLabel}</span>
                          </div>
                          <div className="about-meta-row">
                            <span className="about-meta-label">Publicada em</span>
                            <span className="about-meta-value">{remoteUpdaterReleaseDateLabel}</span>
                          </div>
                        </div>
                      </div>

                      <footer className="about-update-dialog-footer">
                        <button
                          type="button"
                          className="text-button danger form-action-button"
                          onClick={() => setUpdateDialogOpen(false)}
                        >
                          <X aria-hidden="true" size={14} />
                          Fechar
                        </button>
                        <button
                          type="button"
                          className="text-button active form-action-button"
                          onClick={() => void window.gameStockAPI.updater.checkNow()}
                          disabled={updaterBusy}
                        >
                          <RefreshCw aria-hidden="true" size={14} className={updaterBusy ? "about-update-spin" : ""} />
                          {updateButtonText}
                        </button>
                      </footer>
                    </section>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
