/**
 * EmulatorsSettings.tsx
 *
 * Painel de configurações de emuladores dentro das configurações do aplicativo.
 * Responsável por:
 *   - Listar emuladores cadastrados (RetroArch sempre primeiro, demais em ordem alfabética)
 *   - Criar e editar emuladores via modal de formulário arrastável
 *   - Vincular/desvincular emuladores a plataformas
 *   - Configurar cores do RetroArch por plataforma em um modal dedicado
 *   - Remover emuladores não-RetroArch
 */

import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FolderOpen, Link, Pencil, Plus, RefreshCw, Save, SlidersHorizontal, Trash2, Unlink, X } from "lucide-react";
import { createPortal } from "react-dom";
import { Emulator, Platform, PlatformEmulator } from "../../../shared/types";
import {
  getRetroArchCompatibleInstalledCoresForPlatform,
  getRetroArchCoreCandidatesForPlatform,
  getRetroArchCoreForPlatform
} from "../../../shared/retroarch";
import { useDraggableDialog } from "../../hooks/useDraggableDialog";
import { useGameStockStore } from "../../store";
import { SectionIntro } from "../SectionIntro/SectionIntro";
import { useEmulatorAssociations } from "./useEmulatorAssociations";
import { useRetroArchCoreInventory } from "./useRetroArchCoreInventory";
import "./EmulatorsSettings.css";

/**
 * Representa a configuração de core do RetroArch para uma plataforma específica.
 * Combina os dados da plataforma com o vínculo existente (se houver).
 */
interface PlatformRetroArchConfig {
  platform: Platform;
  retroArchLink: PlatformEmulator | null;
}

/**
 * Normaliza o nome de um core para comparação case-insensitive sem espaços extras.
 * Retorna string vazia quando o valor é null ou undefined.
 */
function normalizeCoreName(coreName: string | null | undefined): string {
  const fileName = coreName?.trim().replace(/\\/g, "/").split("/").pop() ?? "";
  return fileName.toLowerCase().replace(/\.(dll|so|dylib)$/i, "");
}

/**
 * Retorna extensão nativa preferencial do core para a plataforma atual.
 */
function getPreferredRetroArchCoreExtension(): ".dll" | ".so" | ".dylib" {
  if (navigator.platform.toLowerCase().includes("win")) return ".dll";
  if (navigator.platform.toLowerCase().includes("mac")) return ".dylib";
  return ".so";
}

/**
 * Retorna o rótulo de exibição do core:
 * - Se contiver separador de caminho (\ ou /), exibe o caminho completo.
 * - Caso contrário, adiciona extensão compatível com a plataforma atual.
 */
function getCoreDisplayLabel(coreName: string): string {
  if (coreName.includes("\\") || coreName.includes("/")) return coreName;
  if (/\.(dll|so|dylib)$/i.test(coreName)) return coreName;
  return `${coreName}${getPreferredRetroArchCoreExtension()}`;
}

/**
 * Monta as opções de core para o picker de uma plataforma, separando em
 * "recomendados" (cores sugeridos para a plataforma) e "instalados" (inventário completo da pasta).
 *
 * @param platformName    Nome da plataforma para buscar sugestões.
 * @param installedCores  Lista de cores instalados no RetroArch.
 * @param currentValue    Core atualmente selecionado no draft (incluso nas opções se não estiver em nenhuma lista).
 */
function buildCoreOptions(
  platformName: string,
  installedCores: string[],
  currentValue: string
): { recommended: Array<{ value: string; installed: boolean }>; installed: string[] } {
  // Cores recomendados para a plataforma, marcados com flag de instalação
  const recommended = getRetroArchCoreCandidatesForPlatform(platformName).map((coreName) => ({
    value: coreName,
    installed: installedCores.some((installedCore) => normalizeCoreName(installedCore) === normalizeCoreName(coreName))
  }));

  // Exibe inventário completo: catálogo estático não pode esconder core recém-instalado.
  const installed = Array.from(new Set(installedCores))
    .filter((coreName) => !recommended.some((entry) => normalizeCoreName(entry.value) === normalizeCoreName(coreName)))
    .sort((left, right) => left.localeCompare(right));

  // Adiciona o valor atual ao início da lista de instalados caso não esteja em nenhum grupo
  if (currentValue.trim()) {
    const currentExists =
      recommended.some((entry) => normalizeCoreName(entry.value) === normalizeCoreName(currentValue)) ||
      installed.some((entry) => normalizeCoreName(entry) === normalizeCoreName(currentValue));
    if (!currentExists) installed.unshift(currentValue.trim());
  }

  return { recommended, installed };
}

// ── EmulatorFormModal ────────────────────────────────────────────────────────

/** Modo do modal de formulário: criação de novo emulador ou edição de existente. */
type EmulatorModalMode = { kind: "create" } | { kind: "edit"; emulator: Emulator };

/**
 * Modal arrastável para criar ou editar um emulador.
 * Abre diálogo nativo para selecionar o executável via IPC.
 *
 * @param mode     Modo do modal (criar ou editar) com dados do emulador atual.
 * @param onClose  Callback chamado ao fechar o modal sem salvar.
 * @param onSaved  Callback chamado após salvar com sucesso, para recarregar a lista.
 */
function EmulatorFormModal({
  mode,
  onClose,
  onSaved
}: {
  mode: EmulatorModalMode;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Emulador sendo editado (null no modo criação)
  const editing = mode.kind === "edit" ? mode.emulator : null;

  const [name, setName] = useState(editing?.name ?? "");
  const [executable, setExecutable] = useState(editing?.executable ?? "");
  const [args, setArgs] = useState(editing?.args ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Hook de drag para tornar o modal arrastável dentro da janela principal
  const draggable = useDraggableDialog();

  /** Abre diálogo nativo para selecionar o executável do emulador. */
  async function browsePath(): Promise<void> {
    const result = await window.gameStockAPI.dialogs.openExecutableFile();
    if (result) setExecutable(result);
  }

  /**
   * Salva o emulador via IPC (create ou update conforme o modo),
   * chama os callbacks e fecha o modal.
   */
  async function save(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editing) {
        await window.gameStockAPI.emulators.update(editing.id, { name, executable, args });
      } else {
        await window.gameStockAPI.emulators.create({ name, executable, args, is_retroarch: 0 });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar");
      setSaving(false);
    }
  }

  return (
    <div className="emulator-secondary-overlay">
      <section
        ref={draggable.dialogRef}
        className="management-modal emulator-form-modal draggable-modal"
        style={draggable.style}
        onPointerDown={draggable.startDialogDrag}
        onPointerMove={draggable.dragDialog}
        onPointerUp={draggable.stopDialogDrag}
        onPointerCancel={draggable.stopDialogDrag}
      >
        <header>
          <h2>{editing ? "Editar emulador" : "Novo emulador"}</h2>
          <button type="button" className="icon-button modal-close-button" onClick={onClose} aria-label="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <form className="management-form" onSubmit={save}>
          <label>
            Nome
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: PCSX2" />
          </label>
          <label>
            Executável
            <div className="emulator-exe-row">
              <input
                value={executable}
                onChange={(e) => setExecutable(e.target.value)}
                placeholder="Caminho do executável"
              />
              {/* Botão para abrir diálogo nativo de seleção de arquivo */}
              <button type="button" className="icon-button" title="Selecionar arquivo" onClick={browsePath}>
                <FolderOpen size={15} aria-hidden="true" />
              </button>
            </div>
          </label>
          <label>
            Argumentos <span className="emulator-label-hint">(opcional, separados por espaço)</span>
            <input value={args} onChange={(e) => setArgs(e.target.value)} placeholder="Ex: -fullscreen -noaudio" />
          </label>
          {error && <p className="form-error">{error}</p>}
          <footer>
            <button type="button" className="text-button danger form-action-button" onClick={onClose} disabled={saving}>
              <X size={14} aria-hidden="true" />
              Cancelar
            </button>
            <button type="submit" className="text-button active form-action-button" disabled={saving || !name.trim()}>
              <Save size={14} aria-hidden="true" />
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

// ── LinkPlatformModal ────────────────────────────────────────────────────────

/**
 * Modal arrastável para vincular um emulador a uma plataforma.
 * Para emuladores RetroArch, exibe picker adicional de core
 * com recomendados e variantes compativeis encontradas no inventario instalado.
 *
 * @param emulator  Emulador a ser vinculado.
 * @param platforms Lista de plataformas disponíveis para vincular.
 * @param onClose   Callback chamado ao fechar sem salvar.
 * @param onSaved   Callback chamado após vínculo criado com sucesso.
 */
function LinkPlatformModal({
  emulator,
  platforms,
  onClose,
  onSaved
}: {
  emulator: Emulator;
  platforms: Platform[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // ID da plataforma selecionada no select (string vazia = nenhuma)
  const [platformId, setPlatformId] = useState<number | "">(platforms[0]?.id ?? "");
  const [isDefault, setIsDefault] = useState(true);
  const [corePath, setCorePath] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [corePickerOpen, setCorePickerOpen] = useState(false);
  const [corePickerMenuStyle, setCorePickerMenuStyle] = useState<CSSProperties>({});

  /** Indica se o emulador é uma instância do RetroArch */
  const isRetroArch = emulator.is_retroarch === 1;
  const { inventory: coreInventory } = useRetroArchCoreInventory(emulator.id, isRetroArch);

  /**
   * Ref que rastreia o último core sugerido automaticamente,
   * permitindo substituir o valor apenas se o usuário não editou manualmente.
   */
  const autoCoreRef = useRef("");
  const corePickerTriggerRef = useRef<HTMLButtonElement | null>(null);

  const selectedPlatform = platformId ? platforms.find((p) => p.id === Number(platformId)) : null;

  /** Core padrão sugerido para a plataforma selecionada (pode ser null) */
  const defaultRetroArchCore = selectedPlatform ? getRetroArchCoreForPlatform(selectedPlatform.name) : null;

  const draggable = useDraggableDialog();

  /**
   * Opcoes reais do picker, derivadas do inventario instalado e da plataforma atual.
   * Mantém recomendados separados dos demais cores instalados detectados.
   */
  const coreOptions = useMemo(
    () => buildCoreOptions(selectedPlatform?.name ?? "", coreInventory?.installedCores ?? [], corePath),
    [coreInventory?.installedCores, corePath, selectedPlatform?.name]
  );

  /**
   * Fecha menu de selecao quando usuario clica fora do picker.
   */
  useEffect(() => {
    if (!corePickerOpen) return;

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".retroarch-core-picker")) return;
      setCorePickerOpen(false);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [corePickerOpen]);

  /**
   * Posiciona menu flutuante do picker no viewport.
   * Usa `position: fixed` via portal para escapar do clipping do modal pai.
   */
  useEffect(() => {
    if (!corePickerOpen) return;

    function updateCorePickerMenuPosition(): void {
      const trigger = corePickerTriggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 16;
      const desiredWidth = rect.width;
      const clampedLeft = Math.min(rect.left, window.innerWidth - desiredWidth - viewportPadding);
      const availableHeight = Math.max(120, window.innerHeight - rect.bottom - viewportPadding);

      setCorePickerMenuStyle({
        top: rect.bottom + 6,
        left: Math.max(viewportPadding, clampedLeft),
        width: desiredWidth,
        maxHeight: Math.min(260, availableHeight)
      });
    }

    updateCorePickerMenuPosition();
    window.addEventListener("resize", updateCorePickerMenuPosition);
    window.addEventListener("scroll", updateCorePickerMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateCorePickerMenuPosition);
      window.removeEventListener("scroll", updateCorePickerMenuPosition, true);
    };
  }, [corePickerOpen]);

  /**
   * Preenche automaticamente o campo de core quando a plataforma muda,
   * mas respeita edições manuais do usuário (usa autoCoreRef como sentinela).
   */
  useEffect(() => {
    if (!isRetroArch) return;
    const nextAutoCore = defaultRetroArchCore ?? "";
    setCorePath((current) => {
      const shouldAutofill = !current.trim() || current === autoCoreRef.current;
      autoCoreRef.current = nextAutoCore;
      return shouldAutofill ? nextAutoCore : current;
    });
  }, [defaultRetroArchCore, isRetroArch]);

  /** Abre diálogo nativo para localizar o arquivo .dll do core manualmente. */
  async function browseCorePath(): Promise<void> {
    const result = await window.gameStockAPI.dialogs.openAnyFile();
    if (result) {
      setCorePath(result);
      setCorePickerOpen(false);
    }
  }

  /**
   * Atualiza a plataforma selecionada e, para RetroArch,
   * preenche automaticamente o core sugerido para a nova plataforma.
   */
  function selectPlatform(nextPlatformId: number): void {
    setPlatformId(nextPlatformId);
    setCorePickerOpen(false);
    if (!isRetroArch) return;
    const platform = platforms.find((p) => p.id === nextPlatformId);
    const suggestedCore = platform ? getRetroArchCoreForPlatform(platform.name) : null;
    autoCoreRef.current = suggestedCore ?? "";
    setCorePath(suggestedCore ?? "");
  }

  /**
   * Cria o vínculo emulador↔plataforma via IPC,
   * incluindo o core path quando for RetroArch.
   */
  async function save(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (!platformId) return;
    if (isRetroArch && !corePath.trim()) {
      setError("Core do RetroArch é obrigatório");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await window.gameStockAPI.emulators.linkPlatform(
        emulator.id,
        Number(platformId),
        isDefault,
        isRetroArch ? corePath.trim() : null
      );
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível vincular");
      setSaving(false);
    }
  }

  return (
    <div className="emulator-secondary-overlay">
      <section
        ref={draggable.dialogRef}
        className="management-modal emulator-form-modal draggable-modal"
        style={draggable.style}
        onPointerDown={draggable.startDialogDrag}
        onPointerMove={draggable.dragDialog}
        onPointerUp={draggable.stopDialogDrag}
        onPointerCancel={draggable.stopDialogDrag}
      >
        <header>
          <h2>Vincular a plataforma</h2>
          <button type="button" className="icon-button modal-close-button" onClick={onClose} aria-label="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <form className="management-form" onSubmit={save}>
          <label>
            Plataforma
            <select value={platformId} onChange={(e) => selectPlatform(Number(e.target.value))}>
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          {/* Campo de core exibido apenas para emuladores RetroArch */}
          {isRetroArch && (
            <label>
              Core
              <div className="emulator-exe-row emulator-core-picker-row">
                <div className={`retroarch-core-picker ${corePickerOpen ? "open" : ""}`}>
                  <button
                    ref={corePickerTriggerRef}
                    type="button"
                    className="retroarch-core-picker-trigger"
                    onClick={() => setCorePickerOpen((current) => !current)}
                  >
                    <span>
                      {corePath
                        ? getCoreDisplayLabel(corePath)
                        : defaultRetroArchCore
                          ? `Padrao: ${getCoreDisplayLabel(defaultRetroArchCore)}`
                          : "Selecione um core"}
                    </span>
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                  {corePickerOpen && createPortal(
                    <div
                      className="retroarch-core-picker-menu retroarch-core-picker-menu-floating"
                      style={corePickerMenuStyle}
                    >
                      {coreOptions.recommended.length > 0 && (
                        <div className="retroarch-core-group">
                          <strong>Recomendados</strong>
                          {coreOptions.recommended.map((entry) => (
                            <button
                              key={`link-recommended-${entry.value}`}
                              type="button"
                              className={`retroarch-core-option ${normalizeCoreName(corePath) === normalizeCoreName(entry.value) ? "selected" : ""}`}
                              onClick={() => {
                                setCorePath(entry.value);
                                setCorePickerOpen(false);
                              }}
                            >
                              {getCoreDisplayLabel(entry.value)}
                            </button>
                          ))}
                        </div>
                      )}
                      {coreOptions.installed.length > 0 && (
                        <div className="retroarch-core-group">
                          <strong>Outros instalados</strong>
                          {coreOptions.installed.map((installedCore) => (
                            <button
                              key={`link-installed-${installedCore}`}
                              type="button"
                              className={`retroarch-core-option ${normalizeCoreName(corePath) === normalizeCoreName(installedCore) ? "selected" : ""}`}
                              onClick={() => {
                                setCorePath(installedCore);
                                setCorePickerOpen(false);
                              }}
                            >
                              {getCoreDisplayLabel(installedCore)}
                            </button>
                          ))}
                        </div>
                      )}
                      {coreOptions.recommended.length === 0 && coreOptions.installed.length === 0 && (
                        <p className="retroarch-core-picker-empty">Nenhum core compativel encontrado para esta plataforma.</p>
                      )}
                    </div>,
                    document.body
                  )}
                </div>
                <button type="button" className="icon-button" title="Selecionar core" onClick={browseCorePath}>
                  <FolderOpen size={15} aria-hidden="true" />
                </button>
              </div>
              {/* Dica informando core padrao e o uso do inventario instalado como filtro */}
              {defaultRetroArchCore && (
                <span className="emulator-core-hint">
                  Core padrao desta plataforma. Lista inclui variantes compativeis instaladas.
                </span>
              )}
              {!defaultRetroArchCore && (
                <span className="emulator-core-hint">
                  Lista mostra todos os cores instalados no RetroArch.
                </span>
              )}
              {coreInventory && !coreInventory.executableConfigured && (
                <span className="emulator-core-hint emulator-core-warning-text">
                  Configure executavel do RetroArch para carregar inventario de cores instalados.
                </span>
              )}
              {coreInventory?.executableConfigured && !coreInventory.coresDirExists && (
                <span className="emulator-core-hint emulator-core-warning-text">
                  Pasta `cores` nao encontrada ao lado do RetroArch configurado.
                </span>
              )}
            </label>
          )}
          <label className="emulator-checkbox-label">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Definir como emulador padrão desta plataforma
          </label>
          {error && <p className="form-error">{error}</p>}
          <footer>
            <button type="button" className="text-button danger form-action-button" onClick={onClose} disabled={saving}>
              <X size={14} aria-hidden="true" />
              Cancelar
            </button>
            <button type="submit" className="text-button active form-action-button" disabled={saving || !platformId}>
              <Link size={14} aria-hidden="true" />
              {saving ? "Vinculando..." : "Vincular"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

// ── EmulatorRow ──────────────────────────────────────────────────────────────

/**
 * Linha de listagem de um emulador com ações inline.
 * Expande para mostrar as plataformas vinculadas e permite adicionar novos vínculos.
 *
 * @param emulator                Emulador exibido nesta linha.
 * @param platforms               Lista global de plataformas para busca de nomes e vínculos.
 * @param onEdit                  Abre o modal de edição do emulador.
 * @param onDelete                Remove o emulador após confirmação.
 * @param onReload                Recarrega a lista de emuladores e plataformas.
 * @param onConfigureRetroArchCores Abre o modal de configuração de cores (apenas RetroArch).
 */
function EmulatorRow({
  emulator,
  platforms,
  onEdit,
  onDelete,
  onReload,
  onConfigureRetroArchCores
}: {
  emulator: Emulator;
  platforms: Platform[];
  onEdit: () => void;
  onDelete: () => void;
  onReload: () => void;
  onConfigureRetroArchCores?: () => void;
}) {
  const { associations, expanded, setExpanded, loadAssociations, unlink } = useEmulatorAssociations(emulator, platforms, onReload);

  // Controla se o modal de vincular plataforma está aberto
  const [linking, setLinking] = useState(false);

  /** Retorna o nome da plataforma pelo ID, com fallback para "#id" se não encontrada. */
  const platformName = (id: number) => platforms.find((p) => p.id === id)?.name ?? `#${id}`;

  return (
    <>
      <div className="platform-row emulator-row">
        <div className="platform-row-info">
          <strong>{emulator.name}</strong>
          <span>{emulator.executable || <em>Executável não configurado</em>}</span>
        </div>
        <div className="platform-row-actions">
          {/* Botão que expande/colapsa a lista de plataformas vinculadas */}
          <button
            type="button"
            className={`icon-button ${expanded ? "active" : ""}`}
            title="Plataformas vinculadas"
            onClick={() => setExpanded((v) => !v)}
          >
            <Link size={14} aria-hidden="true" />
          </button>
          <button type="button" className="icon-button" title="Editar" onClick={onEdit}>
            <Pencil size={14} aria-hidden="true" />
          </button>
          {/* Botão de configuração de cores — exclusivo para o RetroArch */}
          {emulator.is_retroarch === 1 && onConfigureRetroArchCores && (
            <button
              type="button"
              className="text-button emulator-core-config-button"
              title="Configurar cores por plataforma"
              onClick={onConfigureRetroArchCores}
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              Cores
            </button>
          )}
          {/* Botão de remoção — oculto para o RetroArch (não pode ser removido) */}
          {emulator.is_retroarch !== 1 && (
            <button type="button" className="icon-button danger" title="Remover" onClick={onDelete}>
              <Trash2 size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {/* Painel expandido com tabela de associações e botão de adicionar vínculo */}
      {expanded && (
        <div className="emulator-associations">
          {associations.length === 0 ? (
            <p className="emulator-assoc-empty">Nenhuma plataforma vinculada.</p>
          ) : (
            <div className="emulator-assoc-table">
              <div className="emulator-assoc-head">
                <span>Plataforma</span>
                <span>Core</span>
                <span>Ações</span>
              </div>
              {associations.map((pe) => (
                <div key={pe.platform_id} className="emulator-assoc-row">
                  <span className="emulator-assoc-platform">{platformName(pe.platform_id)}</span>
                  <span className="emulator-assoc-core">{pe.core_path ?? "-"}</span>
                  {/* Botão para desvincular o emulador desta plataforma */}
                  <button
                    type="button"
                    className="icon-button danger"
                    title="Desvincular"
                    onClick={() => void unlink(pe.platform_id)}
                  >
                    <Unlink size={12} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            className="text-button emulator-link-btn"
            onClick={() => setLinking(true)}
          >
            <Plus size={12} aria-hidden="true" />
            Vincular plataforma
          </button>
        </div>
      )}
      {/* Modal de vínculo de plataforma, aberto inline abaixo da linha */}
      {linking && (
        <LinkPlatformModal
          emulator={emulator}
          platforms={platforms}
          onClose={() => setLinking(false)}
          onSaved={() => {
            void loadAssociations();
            onReload();
          }}
        />
      )}
    </>
  );
}

// ── EmulatorsSettings ────────────────────────────────────────────────────────

/**
 * Modal de configuração de cores do RetroArch por plataforma.
 * Permite selecionar o core libretro para cada plataforma cadastrada
 * e salvar todas as alterações de uma vez.
 *
 * @param retroArch    Emulador RetroArch cadastrado no sistema.
 * @param platforms    Lista de plataformas para configurar.
 * @param reloadToken  Token numérico que incrementa para forçar recarga dos dados.
 * @param onReload     Callback para disparar recarga da lista principal.
 * @param onClose      Callback para fechar este modal.
 */
function RetroArchPlatformCores({
  retroArch,
  platforms,
  reloadToken,
  onReload,
  onClose
}: {
  retroArch: Emulator;
  platforms: Platform[];
  reloadToken: number;
  onReload: () => void;
  onClose: () => void;
}) {
  // Configurações de core por plataforma (vínculo atual + dados da plataforma)
  const [configs, setConfigs] = useState<PlatformRetroArchConfig[]>([]);

  // Rascunhos de core editados pelo usuário (platformId → nome do core)
  const [coreDrafts, setCoreDrafts] = useState<Record<number, string>>({});

  // Set de plataformas com alterações pendentes (não salvas ainda)
  const [editedPlatformIds, setEditedPlatformIds] = useState<Record<number, true>>({});
  const editedPlatformIdsRef = useRef(editedPlatformIds);

  useEffect(() => {
    // Resposta IPC precisa consultar edições mais recentes sem refazer leitura a cada clique.
    editedPlatformIdsRef.current = editedPlatformIds;
  }, [editedPlatformIds]);

  // Inventário relê pasta ao abrir, ao voltar para janela e por ação manual.
  const {
    inventory: coreInventory,
    loading: loadingCoreInventory,
    error: coreInventoryError,
    reload: reloadCoreInventory
  } = useRetroArchCoreInventory(retroArch.id, true);

  const [savingAll, setSavingAll] = useState(false);
  const [error, setError] = useState("");

  // Filtro de busca para localizar plataformas ou cores rapidamente
  const [search, setSearch] = useState("");

  // ID da plataforma cujo picker de cores está aberto (null = todos fechados)
  const [openCorePickerPlatformId, setOpenCorePickerPlatformId] = useState<number | null>(null);

  const draggable = useDraggableDialog<HTMLDivElement>();

  /**
   * Lista de configurações filtrada pela query de busca.
   * Pesquisa em: nome da plataforma, cores recomendados, core atual e cores instalados.
   */
  const filteredConfigs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return configs;
    return configs.filter((config) => {
      const suggestedCore = getRetroArchCoreCandidatesForPlatform(config.platform.name).join(" ");
      const currentCore = config.retroArchLink?.core_path ?? "";
      // Busca usa apenas cores compativeis com plataforma atual para evitar ruido de outras DLLs.
      const installedCoreNames = getRetroArchCompatibleInstalledCoresForPlatform(
        config.platform.name,
        coreInventory?.installedCores ?? []
      ).join(" ");
      return [config.platform.name, suggestedCore, currentCore, installedCoreNames].some((value) =>
        value.toLowerCase().includes(query)
      );
    });
  }, [configs, coreInventory?.installedCores, search]);

  /**
   * Fecha o picker de core quando o usuário clica fora do elemento.
   * Registra listener global de pointerdown enquanto algum picker está aberto.
   */
  useEffect(() => {
    if (openCorePickerPlatformId === null) return;

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target as HTMLElement | null;
      // Não fecha se o clique foi dentro do próprio picker
      if (target?.closest(".retroarch-core-picker")) return;
      setOpenCorePickerPlatformId(null);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [openCorePickerPlatformId]);

  /**
   * Carrega vínculos em lote e atualiza rascunhos com dados persistidos.
   * Inventário do filesystem possui ciclo independente para uma falha não apagar plataformas.
   * Roda sempre que platforms, reloadToken ou retroArch.id mudam.
   */
  useEffect(() => {
    if (!platforms.length) {
      setConfigs([]);
      setCoreDrafts({});
      setEditedPlatformIds({});
      return;
    }

    // Flag para evitar atualizar estado após desmontagem do componente
    let active = true;
    void window.gameStockAPI.emulators.listByPlatforms(platforms.map((platform) => platform.id)).then((linksByPlatform) => {
      if (!active) return;
      const nextConfigs = platforms.map((platform) => ({
        platform,
        retroArchLink: linksByPlatform[platform.id]?.find((entry) => entry.emulator_id === retroArch.id) ?? null
      }));
      setConfigs(nextConfigs);
      setOpenCorePickerPlatformId(null);
      setCoreDrafts((current) => {
        const nextDrafts: Record<number, string> = {};
        const currentEdited = editedPlatformIdsRef.current;
        for (const config of nextConfigs) {
          const loadedValue = config.retroArchLink?.core_path ?? getRetroArchCoreForPlatform(config.platform.name) ?? "";
          // Preserva somente edição pendente; demais linhas recebem valor novo do SQLite.
          nextDrafts[config.platform.id] = currentEdited[config.platform.id]
            ? current[config.platform.id] ?? loadedValue
            : loadedValue;
        }
        return nextDrafts;
      });
      setEditedPlatformIds((current) => Object.fromEntries(
        Object.entries(current).filter(([platformId]) => nextConfigs.some((config) => config.platform.id === Number(platformId)))
      ));
    }).catch(() => {
      if (active) {
        setConfigs([]);
        setOpenCorePickerPlatformId(null);
      }
    });

    return () => {
      active = false;
    };
  }, [platforms, reloadToken, retroArch.id]);

  /**
   * Salva todos os cores que foram editados (marcados em editedPlatformIds).
   * Valida que nenhum core editado está vazio antes de salvar.
   */
  async function saveAllCores(): Promise<void> {
    const configsToSave = configs.filter((config) => editedPlatformIds[config.platform.id]);
    if (!configsToSave.length) {
      setError("Nenhuma alteração para salvar");
      return;
    }

    // Bloqueia salvamento se alguma plataforma editada não tiver core definido
    const missingCore = configsToSave.find((config) => !(coreDrafts[config.platform.id]?.trim()));
    if (missingCore) {
      setError(`Selecione um core para ${missingCore.platform.name}`);
      return;
    }

    setError("");
    setSavingAll(true);
    try {
      // Envia todas as edições uma vez; SQLite reverte lote inteiro se algum vínculo falhar.
      await window.gameStockAPI.emulators.savePlatformLinks(configsToSave.map((config) => ({
        platformId: config.platform.id,
        emulatorId: retroArch.id,
        isDefault: config.retroArchLink?.is_default === 1,
        corePath: coreDrafts[config.platform.id].trim()
      })));
      setEditedPlatformIds({});
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar cores do RetroArch");
    } finally {
      setSavingAll(false);
    }
  }

  return (
    <div className="emulator-secondary-overlay">
      <div
        ref={draggable.dialogRef}
        className="retroarch-core-dialog draggable-modal"
        style={draggable.style}
        onPointerDown={draggable.startDialogDrag}
        onPointerMove={draggable.dragDialog}
        onPointerUp={draggable.stopDialogDrag}
        onPointerCancel={draggable.stopDialogDrag}
      >
        <header className="retroarch-core-dialog-header">
          <div>
            <h3>Cores do RetroArch</h3>
            <p>Escolha cores recomendados ou DLLs instaladas e salve tudo de uma vez.</p>
          </div>
          <button type="button" className="icon-button modal-close-button" onClick={onClose} aria-label="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {/* Barra de busca para filtrar plataformas por nome ou core */}
        <div className="retroarch-core-toolbar">
          <label>
            Buscar
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Plataforma ou core"
            />
          </label>
          <button
            type="button"
            className="text-button retroarch-core-refresh-button"
            onClick={reloadCoreInventory}
            disabled={loadingCoreInventory}
          >
            <RefreshCw className={loadingCoreInventory ? "retroarch-core-refreshing" : ""} size={14} aria-hidden="true" />
            {loadingCoreInventory ? "Atualizando..." : "Atualizar cores"}
          </button>
        </div>

        {/* Lista de plataformas com seus respectivos pickers de core */}
        <div className="retroarch-core-list">
        {filteredConfigs.length === 0 && (
          <p className="platform-list-empty">Nenhuma plataforma cadastrada.</p>
        )}
        {filteredConfigs.map((config) => {
          const platformId = config.platform.id;
          const recommendedCores = getRetroArchCoreCandidatesForPlatform(config.platform.name);
          const defaultSuggestedCore = recommendedCores[0] ?? getRetroArchCoreForPlatform(config.platform.name);
          const draftValue = coreDrafts[platformId] ?? "";
          const currentCore = config.retroArchLink?.core_path?.trim() ?? "";

          // Verdadeiro se o core sugerido já está salvo — linha fica em estado "ok"
          const suggestedMatchesCurrent =
            Boolean(defaultSuggestedCore) && normalizeCoreName(defaultSuggestedCore) === normalizeCoreName(currentCore);

          // Opções separadas em recomendados e instalados para o picker
          const options = buildCoreOptions(config.platform.name, coreInventory?.installedCores ?? [], draftValue);

          // Verdadeiro se o core recomendado principal está instalado na máquina do usuário
          const primaryRecommendedInstalled = defaultSuggestedCore
            ? (coreInventory?.installedCores ?? []).some((installedCore) => normalizeCoreName(installedCore) === normalizeCoreName(defaultSuggestedCore))
            : true;

          const edited = Boolean(editedPlatformIds[platformId]);
          const isPickerOpen = openCorePickerPlatformId === platformId;

          return (
            <div key={platformId} className="retroarch-core-row">
              <div className="retroarch-core-info">
                <strong>{config.platform.name}</strong>
                {suggestedMatchesCurrent ? (
                  <span>Core recomendado já salvo: {defaultSuggestedCore}</span>
                ) : (
                  <>
                    {!defaultSuggestedCore && <span>Defina core usado pelo RetroArch nesta plataforma</span>}
                    {currentCore && <em className="retroarch-core-current">Core salvo: {currentCore}</em>}
                  </>
                )}
                {/* Aviso quando o core recomendado não está instalado no RetroArch do usuário */}
                {!primaryRecommendedInstalled && defaultSuggestedCore && (
                  <em className="retroarch-core-warning">
                    Core recomendado {defaultSuggestedCore} não instalado. Baixe no RetroArch.
                  </em>
                )}
                {/* Indicador visual de alteração pendente não salva */}
                {edited && <em className="retroarch-core-pending">Alteração pendente</em>}
              </div>
              <div className="retroarch-core-controls">
                <label className="retroarch-core-field">
                  <span className="retroarch-core-field-header">
                    <span>Core</span>
                    {/* Sugestão exibida quando o core atual difere do recomendado */}
                    {defaultSuggestedCore && !suggestedMatchesCurrent && (
                      <em className="retroarch-core-suggestion">Sugestão: {defaultSuggestedCore}</em>
                    )}
                  </span>
                  {/* Picker customizado de core (dropdown com grupos recomendados/instalados) */}
                  <div className={`retroarch-core-picker ${isPickerOpen ? "open" : ""}`}>
                    <button
                      type="button"
                      className="retroarch-core-picker-trigger"
                      onClick={() => setOpenCorePickerPlatformId((current) => current === platformId ? null : platformId)}
                    >
                      <span>{draftValue ? getCoreDisplayLabel(draftValue) : "Selecione um core"}</span>
                      <ChevronDown size={14} aria-hidden="true" />
                    </button>
                    {isPickerOpen && (
                      <div className="retroarch-core-picker-menu">
                        {/* Opção de limpar seleção */}
                        <button
                          type="button"
                          className={`retroarch-core-option ${!draftValue ? "selected" : ""}`}
                          onClick={() => {
                            setCoreDrafts((current) => ({ ...current, [platformId]: "" }));
                            setEditedPlatformIds((current) => ({ ...current, [platformId]: true }));
                            setOpenCorePickerPlatformId(null);
                          }}
                        >
                          Selecione um core
                        </button>
                        {/* Grupo de cores recomendados para a plataforma */}
                        {options.recommended.length > 0 && (
                          <div className="retroarch-core-group">
                            <strong>Recomendados</strong>
                            {options.recommended.map((entry) => (
                              <button
                                key={`recommended-${platformId}-${entry.value}`}
                                type="button"
                                className={`retroarch-core-option ${normalizeCoreName(draftValue) === normalizeCoreName(entry.value) ? "selected" : ""} ${!entry.installed ? "disabled" : ""}`}
                                onClick={() => {
                                  // Não permite selecionar core recomendado que não está instalado
                                  if (!entry.installed) return;
                                  setCoreDrafts((current) => ({ ...current, [platformId]: entry.value }));
                                  setEditedPlatformIds((current) => ({ ...current, [platformId]: true }));
                                  setOpenCorePickerPlatformId(null);
                                }}
                                disabled={!entry.installed}
                              >
                                {entry.installed ? getCoreDisplayLabel(entry.value) : `${entry.value} (baixar no RetroArch)`}
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Grupo de cores instalados que não são os recomendados */}
                        {options.installed.length > 0 && (
                          <div className="retroarch-core-group">
                            <strong>Instalados</strong>
                            {options.installed.map((coreName) => (
                              <button
                                key={`installed-${platformId}-${coreName}`}
                                type="button"
                                className={`retroarch-core-option ${normalizeCoreName(draftValue) === normalizeCoreName(coreName) ? "selected" : ""}`}
                                onClick={() => {
                                  setCoreDrafts((current) => ({ ...current, [platformId]: coreName }));
                                  setEditedPlatformIds((current) => ({ ...current, [platformId]: true }));
                                  setOpenCorePickerPlatformId(null);
                                }}
                              >
                                {getCoreDisplayLabel(coreName)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>
          );
        })}
        </div>

        <footer className="retroarch-core-dialog-footer">
          {/* Erros de configuração do RetroArch exibidos antes do botão de salvar */}
          {coreInventory && !coreInventory.executableConfigured && (
            <p className="form-error">Configure executável do RetroArch antes de selecionar cores.</p>
          )}
          {coreInventory?.executableConfigured && !coreInventory.coresDirExists && (
            <p className="form-error">Pasta de cores não encontrada ao lado do RetroArch.</p>
          )}
          {coreInventoryError && <p className="form-error">{coreInventoryError}</p>}
          {error && <p className="form-error">{error}</p>}
          <button type="button" className="text-button danger form-action-button" onClick={onClose}>
            <X size={14} aria-hidden="true" />
            Fechar
          </button>
          {/* Botão de salvar desabilitado quando não há alterações pendentes */}
          <button
            type="button"
            className="text-button active form-action-button"
            onClick={() => void saveAllCores()}
            disabled={savingAll || !Object.keys(editedPlatformIds).length}
          >
            <Save size={14} aria-hidden="true" />
            {savingAll ? "Salvando..." : "Salvar"}
          </button>
        </footer>
      </div>
    </div>
  );
}

/**
 * Componente principal da aba de emuladores dentro das configurações.
 * Gerencia a lista de emuladores, modais de criação/edição e o modal de cores do RetroArch.
 */
export function EmulatorsSettings() {
  // Plataformas cadastradas no store (usadas para vincular emuladores)
  const platforms = useGameStockStore((state) => state.platforms);
  const reloadPlatforms = useGameStockStore((state) => state.reloadPlatforms);

  const [emulatorList, setEmulatorList] = useState<Emulator[]>([]);

  // Modal de criar/editar emulador (null = fechado)
  const [modal, setModal] = useState<EmulatorModalMode | null>(null);

  // Controla a abertura do modal de configuração de cores do RetroArch
  const [retroArchCoreModalOpen, setRetroArchCoreModalOpen] = useState(false);

  const [error, setError] = useState("");

  /**
   * Token numérico que incrementa para forçar recarga da lista de emuladores.
   * Passado ao useEffect e ao modal de cores para sincronizar recargas.
   */
  const [reloadToken, setReloadToken] = useState(0);

  /** Incrementa o token de recarga e recarrega as plataformas do store. */
  function reload(): void {
    setReloadToken((t) => t + 1);
    reloadPlatforms();
  }

  /** Busca a lista de emuladores via IPC sempre que reloadToken muda. */
  useEffect(() => {
    window.gameStockAPI.emulators.list().then(setEmulatorList).catch(() => {});
  }, [reloadToken]);

  /** Instância do RetroArch na lista (identificado pelo flag is_retroarch === 1). */
  const retroArch = useMemo(
    () => emulatorList.find((emulator) => emulator.is_retroarch === 1) ?? null,
    [emulatorList]
  );

  /**
   * Lista de emuladores ordenada para exibição:
   * RetroArch sempre primeiro, demais em ordem alfabética case-insensitive.
   */
  const orderedEmulators = useMemo(() => {
    const retroArchEntry = emulatorList.find((emulator) => emulator.is_retroarch === 1) ?? null;
    const others = emulatorList
      .filter((emulator) => emulator.is_retroarch !== 1)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return retroArchEntry ? [retroArchEntry, ...others] : others;
  }, [emulatorList]);

  /**
   * Remove um emulador após confirmação do usuário.
   * Não disponível para o RetroArch (botão oculto no EmulatorRow).
   */
  async function remove(emulator: Emulator): Promise<void> {
    if (!window.confirm(`Remover o emulador "${emulator.name}"?`)) return;
    setError("");
    try {
      await window.gameStockAPI.emulators.delete(emulator.id);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível remover");
    }
  }

  return (
    <div className="platform-manager">
      <SectionIntro
        title="Emuladores"
        description="Configure emuladores e vincule-os às plataformas para lançar jogos diretamente da biblioteca."
      />
      <div className="platform-list">
        {orderedEmulators.length === 0 && (
          <p className="platform-list-empty">Nenhum emulador cadastrado.</p>
        )}
        {orderedEmulators.map((emulator) => (
          // Abre o modal de cores apenas para o RetroArch (onConfigureRetroArchCores)
          <EmulatorRow
            key={emulator.id}
            emulator={emulator}
            platforms={platforms}
            onEdit={() => setModal({ kind: "edit", emulator })}
            onDelete={() => void remove(emulator)}
            onReload={reload}
            onConfigureRetroArchCores={
              emulator.is_retroarch === 1 ? () => setRetroArchCoreModalOpen(true) : undefined
            }
          />
        ))}
      </div>
      <div className="platform-manager-toolbar">
        {error && <p className="form-error">{error}</p>}
        <button type="button" className="text-button active platform-add-button" onClick={() => setModal({ kind: "create" })}>
          <Plus size={14} aria-hidden="true" />
          Novo emulador
        </button>
      </div>
      {/* Modal de criar/editar emulador */}
      {modal && (
        <EmulatorFormModal
          mode={modal}
          onClose={() => setModal(null)}
          onSaved={reload}
        />
      )}
      {/* Modal de configuração de cores do RetroArch — aberto apenas quando RetroArch existe */}
      {retroArch && retroArchCoreModalOpen && (
        <RetroArchPlatformCores
          retroArch={retroArch}
          platforms={platforms}
          reloadToken={reloadToken}
          onReload={reload}
          onClose={() => setRetroArchCoreModalOpen(false)}
        />
      )}
    </div>
  );
}
