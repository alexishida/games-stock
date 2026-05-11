import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FolderOpen, Link, Pencil, Plus, Save, SlidersHorizontal, Trash2, Unlink, X } from "lucide-react";
import { Emulator, Platform, PlatformEmulator, RetroArchCoreInventory } from "../../../shared/types";
import { getRetroArchCoreCandidatesForPlatform, getRetroArchCoreForPlatform, RETROARCH_CORE_NAMES } from "../../../shared/retroarch";
import { useDraggableDialog } from "../../hooks/useDraggableDialog";
import { useGameStockStore } from "../../store";
import { SectionIntro } from "../SectionIntro/SectionIntro";
import "./EmulatorsSettings.css";

interface PlatformRetroArchConfig {
  platform: Platform;
  retroArchLink: PlatformEmulator | null;
}

function normalizeCoreName(coreName: string | null | undefined): string {
  return coreName?.trim().toLowerCase() ?? "";
}

function toDllLabel(coreName: string): string {
  return coreName.toLowerCase().endsWith(".dll") ? coreName : `${coreName}.dll`;
}

function getCoreDisplayLabel(coreName: string): string {
  return coreName.includes("\\") || coreName.includes("/") ? coreName : toDllLabel(coreName);
}

function buildCoreOptions(
  platformName: string,
  installedCores: string[],
  currentValue: string
): { recommended: Array<{ value: string; installed: boolean }>; installed: string[] } {
  const recommended = getRetroArchCoreCandidatesForPlatform(platformName).map((coreName) => ({
    value: coreName,
    installed: installedCores.some((installedCore) => normalizeCoreName(installedCore) === normalizeCoreName(coreName))
  }));

  const installed = installedCores.filter((coreName) =>
    !recommended.some((entry) => normalizeCoreName(entry.value) === normalizeCoreName(coreName))
  );

  if (currentValue.trim()) {
    const currentExists =
      recommended.some((entry) => normalizeCoreName(entry.value) === normalizeCoreName(currentValue)) ||
      installed.some((entry) => normalizeCoreName(entry) === normalizeCoreName(currentValue));
    if (!currentExists) installed.unshift(currentValue.trim());
  }

  return { recommended, installed };
}

// EmulatorFormModal

type EmulatorModalMode = { kind: "create" } | { kind: "edit"; emulator: Emulator };

function EmulatorFormModal({
  mode,
  onClose,
  onSaved
}: {
  mode: EmulatorModalMode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = mode.kind === "edit" ? mode.emulator : null;
  const [name, setName] = useState(editing?.name ?? "");
  const [executable, setExecutable] = useState(editing?.executable ?? "");
  const [args, setArgs] = useState(editing?.args ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const draggable = useDraggableDialog();

  async function browsePath(): Promise<void> {
    const result = await window.gameStockAPI.dialogs.openExecutableFile();
    if (result) setExecutable(result);
  }

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

// LinkPlatformModal

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
  const [platformId, setPlatformId] = useState<number | "">(platforms[0]?.id ?? "");
  const [isDefault, setIsDefault] = useState(true);
  const [corePath, setCorePath] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isRetroArch = emulator.is_retroarch === 1;
  const autoCoreRef = useRef("");
  const selectedPlatform = platformId ? platforms.find((p) => p.id === Number(platformId)) : null;
  const defaultRetroArchCore = selectedPlatform ? getRetroArchCoreForPlatform(selectedPlatform.name) : null;
  const coreListId = `retroarch-core-options-${emulator.id}`;
  const draggable = useDraggableDialog();

  useEffect(() => {
    if (!isRetroArch) return;
    const nextAutoCore = defaultRetroArchCore ?? "";
    setCorePath((current) => {
      const shouldAutofill = !current.trim() || current === autoCoreRef.current;
      autoCoreRef.current = nextAutoCore;
      return shouldAutofill ? nextAutoCore : current;
    });
  }, [defaultRetroArchCore, isRetroArch]);

  async function browseCorePath(): Promise<void> {
    const result = await window.gameStockAPI.dialogs.openAnyFile();
    if (result) setCorePath(result);
  }

  function selectPlatform(nextPlatformId: number): void {
    setPlatformId(nextPlatformId);
    if (!isRetroArch) return;
    const platform = platforms.find((p) => p.id === nextPlatformId);
    const suggestedCore = platform ? getRetroArchCoreForPlatform(platform.name) : null;
    autoCoreRef.current = suggestedCore ?? "";
    setCorePath(suggestedCore ?? "");
  }

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
          {isRetroArch && (
            <label>
              Core
              <div className="emulator-exe-row">
                <input
                  list={coreListId}
                  value={corePath}
                  onChange={(e) => setCorePath(e.target.value)}
                  placeholder={defaultRetroArchCore ? `Padrão: ${defaultRetroArchCore}` : "Nome ou caminho do core libretro"}
                />
                <datalist id={coreListId}>
                  {RETROARCH_CORE_NAMES.map((coreName) => (
                    <option key={coreName} value={coreName} />
                  ))}
                </datalist>
                <button type="button" className="icon-button" title="Selecionar core" onClick={browseCorePath}>
                  <FolderOpen size={15} aria-hidden="true" />
                </button>
              </div>
              {defaultRetroArchCore && (
                <span className="emulator-core-hint">
                  Core padrão desta plataforma. Pode trocar antes de vincular.
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

// EmulatorRow

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
  const [associations, setAssociations] = useState<PlatformEmulator[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [linking, setLinking] = useState(false);

  async function loadAssociations(): Promise<void> {
    const all: PlatformEmulator[] = [];
    for (const p of platforms) {
      const list = await window.gameStockAPI.emulators.listByPlatform(p.id);
      for (const pe of list) {
        if (pe.emulator_id === emulator.id) all.push({ ...pe, emulator });
      }
    }
    setAssociations(all);
  }

  useEffect(() => {
    if (expanded) void loadAssociations();
  }, [expanded]);

  async function unlink(platformId: number): Promise<void> {
    await window.gameStockAPI.emulators.unlinkPlatform(emulator.id, platformId);
    void loadAssociations();
    onReload();
  }

  const platformName = (id: number) => platforms.find((p) => p.id === id)?.name ?? `#${id}`;

  return (
    <>
      <div className="platform-row emulator-row">
        <div className="platform-row-info">
          <strong>{emulator.name}</strong>
          <span>{emulator.executable || <em>Executável não configurado</em>}</span>
        </div>
        <div className="platform-row-actions">
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
          {emulator.is_retroarch !== 1 && (
            <button type="button" className="icon-button danger" title="Remover" onClick={onDelete}>
              <Trash2 size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
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

// EmulatorsSettings

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
  const [configs, setConfigs] = useState<PlatformRetroArchConfig[]>([]);
  const [coreDrafts, setCoreDrafts] = useState<Record<number, string>>({});
  const [editedPlatformIds, setEditedPlatformIds] = useState<Record<number, true>>({});
  const [coreInventory, setCoreInventory] = useState<RetroArchCoreInventory | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [openCorePickerPlatformId, setOpenCorePickerPlatformId] = useState<number | null>(null);
  const draggable = useDraggableDialog<HTMLDivElement>();

  const filteredConfigs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return configs;
    return configs.filter((config) => {
      const suggestedCore = getRetroArchCoreCandidatesForPlatform(config.platform.name).join(" ");
      const currentCore = config.retroArchLink?.core_path ?? "";
      const installedCoreNames = coreInventory?.installedCores.join(" ") ?? "";
      return [config.platform.name, suggestedCore, currentCore, installedCoreNames].some((value) =>
        value.toLowerCase().includes(query)
      );
    });
  }, [configs, coreInventory?.installedCores, search]);

  useEffect(() => {
    if (openCorePickerPlatformId === null) return;

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".retroarch-core-picker")) return;
      setOpenCorePickerPlatformId(null);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [openCorePickerPlatformId]);

  useEffect(() => {
    if (!platforms.length) {
      setConfigs([]);
      setCoreDrafts({});
      setEditedPlatformIds({});
      setCoreInventory(null);
      return;
    }

    let active = true;
    void Promise.all([
      Promise.all(
        platforms.map(async (platform) => {
          const links = await window.gameStockAPI.emulators.listByPlatform(platform.id);
          const retroArchLink = links.find((entry) => entry.emulator_id === retroArch.id) ?? null;
          return { platform, retroArchLink };
        })
      ),
      window.gameStockAPI.emulators.listRetroArchCores(retroArch.id)
    ]).then(([nextConfigs, inventory]) => {
      if (!active) return;
      setConfigs(nextConfigs);
      setCoreInventory(inventory);
      setOpenCorePickerPlatformId(null);
      setCoreDrafts((current) => {
        const nextDrafts: Record<number, string> = {};
        for (const config of nextConfigs) {
          nextDrafts[config.platform.id] =
            current[config.platform.id] ??
            config.retroArchLink?.core_path ??
            getRetroArchCoreForPlatform(config.platform.name) ??
            "";
        }
        return nextDrafts;
      });
      setEditedPlatformIds({});
    }).catch(() => {
      if (active) {
        setConfigs([]);
        setCoreInventory(null);
        setOpenCorePickerPlatformId(null);
      }
    });

    return () => {
      active = false;
    };
  }, [platforms, reloadToken, retroArch.id]);

  async function saveAllCores(): Promise<void> {
    const configsToSave = configs.filter((config) => editedPlatformIds[config.platform.id]);
    if (!configsToSave.length) {
      setError("Nenhuma alteração para salvar");
      return;
    }

    const missingCore = configsToSave.find((config) => !(coreDrafts[config.platform.id]?.trim()));
    if (missingCore) {
      setError(`Selecione um core para ${missingCore.platform.name}`);
      return;
    }

    setError("");
    setSavingAll(true);
    try {
      for (const config of configsToSave) {
        await window.gameStockAPI.emulators.linkPlatform(
          retroArch.id,
          config.platform.id,
          config.retroArchLink?.is_default === 1,
          coreDrafts[config.platform.id].trim()
        );
      }
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
        </div>

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
          const suggestedMatchesCurrent =
            Boolean(defaultSuggestedCore) && normalizeCoreName(defaultSuggestedCore) === normalizeCoreName(currentCore);
          const options = buildCoreOptions(config.platform.name, coreInventory?.installedCores ?? [], draftValue);
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
                {!primaryRecommendedInstalled && defaultSuggestedCore && (
                  <em className="retroarch-core-warning">
                    Core recomendado {defaultSuggestedCore} não instalado. Baixe no RetroArch.
                  </em>
                )}
                {edited && <em className="retroarch-core-pending">Alteração pendente</em>}
              </div>
              <div className="retroarch-core-controls">
                <label className="retroarch-core-field">
                  <span className="retroarch-core-field-header">
                    <span>Core</span>
                    {defaultSuggestedCore && !suggestedMatchesCurrent && (
                      <em className="retroarch-core-suggestion">Sugestão: {defaultSuggestedCore}</em>
                    )}
                  </span>
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
                        {options.recommended.length > 0 && (
                          <div className="retroarch-core-group">
                            <strong>Recomendados</strong>
                            {options.recommended.map((entry) => (
                              <button
                                key={`recommended-${platformId}-${entry.value}`}
                                type="button"
                                className={`retroarch-core-option ${normalizeCoreName(draftValue) === normalizeCoreName(entry.value) ? "selected" : ""} ${!entry.installed ? "disabled" : ""}`}
                                onClick={() => {
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
          {coreInventory && !coreInventory.executableConfigured && (
            <p className="form-error">Configure executável do RetroArch antes de selecionar cores.</p>
          )}
          {coreInventory?.executableConfigured && !coreInventory.coresDirExists && (
            <p className="form-error">Pasta de cores não encontrada ao lado do RetroArch.</p>
          )}
          {error && <p className="form-error">{error}</p>}
          <button type="button" className="text-button danger form-action-button" onClick={onClose}>
            <X size={14} aria-hidden="true" />
            Fechar
          </button>
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

export function EmulatorsSettings() {
  const platforms = useGameStockStore((state) => state.platforms);
  const reloadPlatforms = useGameStockStore((state) => state.reloadPlatforms);
  const [emulatorList, setEmulatorList] = useState<Emulator[]>([]);
  const [modal, setModal] = useState<EmulatorModalMode | null>(null);
  const [retroArchCoreModalOpen, setRetroArchCoreModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  function reload(): void {
    setReloadToken((t) => t + 1);
    reloadPlatforms();
  }

  useEffect(() => {
    window.gameStockAPI.emulators.list().then(setEmulatorList).catch(() => {});
  }, [reloadToken]);

  const retroArch = useMemo(
    () => emulatorList.find((emulator) => emulator.is_retroarch === 1) ?? null,
    [emulatorList]
  );

  const orderedEmulators = useMemo(() => {
    const retroArchEntry = emulatorList.find((emulator) => emulator.is_retroarch === 1) ?? null;
    const others = emulatorList
      .filter((emulator) => emulator.is_retroarch !== 1)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return retroArchEntry ? [retroArchEntry, ...others] : others;
  }, [emulatorList]);

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
      {modal && (
        <EmulatorFormModal
          mode={modal}
          onClose={() => setModal(null)}
          onSaved={reload}
        />
      )}
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
