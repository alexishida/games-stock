import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Check, FolderOpen, Link, Pencil, Plus, Save, SlidersHorizontal, Trash2, Unlink, X } from "lucide-react";
import { Emulator, Platform, PlatformEmulator } from "../../../shared/types";
import { getRetroArchCoreForPlatform, RETROARCH_CORE_NAMES } from "../../../shared/retroarch";
import { useGameStockStore } from "../../store";
import { SectionIntro } from "../SectionIntro/SectionIntro";
import "./EmulatorsSettings.css";

interface PlatformRetroArchConfig {
  platform: Platform;
  retroArchLink: PlatformEmulator | null;
  defaultEmulator: PlatformEmulator | null;
}

function useDraggableDialog() {
  const [dialogOffset, setDialogOffset] = useState({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLElement | null>(null);
  const dragState = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const interactiveSelector = "button, input, select, textarea, label, option, [role='button'], a";

  function clampDialogOffset(x: number, y: number): { x: number; y: number } {
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return { x, y };

    const margin = 12;
    const maxX = Math.max(0, (window.innerWidth - rect.width) / 2 - margin);
    const maxY = Math.max(0, (window.innerHeight - rect.height) / 2 - margin);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y))
    };
  }

  function startDialogDrag(event: ReactPointerEvent<HTMLElement>): void {
    if ((event.target as HTMLElement).closest(interactiveSelector)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: dialogOffset.x,
      originY: dialogOffset.y
    };
  }

  function dragDialog(event: ReactPointerEvent<HTMLElement>): void {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDialogOffset(clampDialogOffset(
      drag.originX + event.clientX - drag.startX,
      drag.originY + event.clientY - drag.startY
    ));
  }

  function stopDialogDrag(event: ReactPointerEvent<HTMLElement>): void {
    if (dragState.current?.pointerId !== event.pointerId) return;
    dragState.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return {
    dialogRef,
    style: { "--dialog-x": `${dialogOffset.x}px`, "--dialog-y": `${dialogOffset.y}px` } as CSSProperties,
    startDialogDrag,
    dragDialog,
    stopDialogDrag
  };
}

// ─── EmulatorFormModal ────────────────────────────────────────────────────────

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
        className="management-modal emulator-form-modal draggable-emulator-modal"
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
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

// ─── LinkPlatformModal ────────────────────────────────────────────────────────

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
      setError("Core do RetroArch e obrigatorio");
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
        className="management-modal emulator-form-modal draggable-emulator-modal"
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
                  placeholder={defaultRetroArchCore ? `Padrao: ${defaultRetroArchCore}` : "Nome ou caminho do core libretro"}
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
                  Core padrao desta plataforma. Pode trocar antes de vincular.
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
              {saving ? "Vinculando…" : "Vincular"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

// ─── EmulatorRow ──────────────────────────────────────────────────────────────

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
          <strong>
            {emulator.name}
            {emulator.is_retroarch === 1 && <span className="emulator-badge retroarch">RetroArch</span>}
          </strong>
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
            associations.map((pe) => (
              <div key={pe.platform_id} className="emulator-assoc-row">
                <span>
                  {platformName(pe.platform_id)}
                  {pe.core_path && <em className="emulator-core-path">{pe.core_path}</em>}
                  {pe.is_default === 1 && <span className="emulator-badge default">padrão</span>}
                </span>
                <button
                  type="button"
                  className="icon-button danger"
                  title="Desvincular"
                  onClick={() => void unlink(pe.platform_id)}
                >
                  <Unlink size={12} aria-hidden="true" />
                </button>
              </div>
            ))
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

// ─── EmulatorsSettings ────────────────────────────────────────────────────────

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
  const [savingPlatformId, setSavingPlatformId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [successPlatformId, setSuccessPlatformId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [dialogOffset, setDialogOffset] = useState({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const interactiveSelector = "button, input, select, textarea, label, option, [role='button'], a";

  const filteredConfigs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return configs;
    return configs.filter((config) => {
      const suggestedCore = getRetroArchCoreForPlatform(config.platform.name) ?? "";
      const currentCore = config.retroArchLink?.core_path ?? "";
      return [config.platform.name, suggestedCore, currentCore].some((value) =>
        value.toLowerCase().includes(query)
      );
    });
  }, [configs, search]);

  function clampDialogOffset(x: number, y: number): { x: number; y: number } {
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return { x, y };

    const margin = 12;
    const maxX = Math.max(0, (window.innerWidth - rect.width) / 2 - margin);
    const maxY = Math.max(0, (window.innerHeight - rect.height) / 2 - margin);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y))
    };
  }

  function startDialogDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    if ((event.target as HTMLElement).closest(interactiveSelector)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: dialogOffset.x,
      originY: dialogOffset.y
    };
  }

  function dragDialog(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDialogOffset(clampDialogOffset(
      drag.originX + event.clientX - drag.startX,
      drag.originY + event.clientY - drag.startY
    ));
  }

  function stopDialogDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    if (dragState.current?.pointerId !== event.pointerId) return;
    dragState.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  useEffect(() => {
    if (!platforms.length) {
      setConfigs([]);
      setCoreDrafts({});
      return;
    }

    let active = true;
    void Promise.all(
      platforms.map(async (platform) => {
        const links = await window.gameStockAPI.emulators.listByPlatform(platform.id);
        const retroArchLink = links.find((entry) => entry.emulator_id === retroArch.id) ?? null;
        const defaultEmulator = links.find((entry) => entry.is_default === 1) ?? null;
        return { platform, retroArchLink, defaultEmulator };
      })
    ).then((nextConfigs) => {
      if (!active) return;
      setConfigs(nextConfigs);
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
    }).catch(() => {
      if (active) setConfigs([]);
    });

    return () => {
      active = false;
    };
  }, [platforms, reloadToken, retroArch.id]);

  async function browseCorePath(platformId: number): Promise<void> {
    const result = await window.gameStockAPI.dialogs.openAnyFile();
    if (result) {
      setCoreDrafts((current) => ({ ...current, [platformId]: result }));
      setSuccessPlatformId(null);
    }
  }

  async function savePlatformCore(config: PlatformRetroArchConfig): Promise<void> {
    const corePath = coreDrafts[config.platform.id]?.trim() ?? "";
    if (!corePath) {
      setError("Core do RetroArch e obrigatorio");
      return;
    }

    setError("");
    setSuccessPlatformId(null);
    setSavingPlatformId(config.platform.id);
    try {
      await window.gameStockAPI.emulators.linkPlatform(
        retroArch.id,
        config.platform.id,
        config.retroArchLink?.is_default === 1,
        corePath
      );
      setSuccessPlatformId(config.platform.id);
      onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar core do RetroArch");
    } finally {
      setSavingPlatformId(null);
    }
  }

  return (
    <div className="emulator-secondary-overlay">
      <div
        ref={dialogRef}
        className="retroarch-core-dialog"
        style={{ "--dialog-x": `${dialogOffset.x}px`, "--dialog-y": `${dialogOffset.y}px` } as CSSProperties}
        onPointerDown={startDialogDrag}
        onPointerMove={dragDialog}
        onPointerUp={stopDialogDrag}
        onPointerCancel={stopDialogDrag}
      >
        <header className="retroarch-core-dialog-header">
          <div>
            <h3>Cores do RetroArch</h3>
            <p>Configure o core usado por plataforma sem trocar o emulador padrao atual.</p>
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
          const saving = savingPlatformId === platformId;
          const defaultSuggestedCore = getRetroArchCoreForPlatform(config.platform.name);
          const isRetroArchDefault = config.defaultEmulator?.emulator_id === retroArch.id;
          const draftValue = coreDrafts[platformId] ?? "";
          const currentCore = config.retroArchLink?.core_path?.trim() ?? "";

          return (
            <div key={platformId} className="retroarch-core-row">
              <div className="retroarch-core-info">
                <strong>{config.platform.name}</strong>
                <span>
                  {isRetroArchDefault ? "RetroArch padrao" : `Padrao atual: ${config.defaultEmulator?.emulator?.name ?? "Sem emulador"}`}
                  {defaultSuggestedCore && (
                    <>
                      {" · "}
                      Sugestao: {defaultSuggestedCore}
                    </>
                  )}
                </span>
                {currentCore && <em className="retroarch-core-current">Core salvo: {currentCore}</em>}
              </div>
              <div className="retroarch-core-controls">
                <label className="retroarch-core-field">
                  <span>Core</span>
                  <input
                    list={`retroarch-platform-core-options-${platformId}`}
                    value={draftValue}
                    onChange={(e) => {
                      setCoreDrafts((current) => ({ ...current, [platformId]: e.target.value }));
                      setSuccessPlatformId(null);
                    }}
                    placeholder="Nome ou caminho do core libretro"
                  />
                </label>
                <datalist id={`retroarch-platform-core-options-${platformId}`}>
                  {RETROARCH_CORE_NAMES.map((coreName) => (
                    <option key={coreName} value={coreName} />
                  ))}
                </datalist>
                <button
                  type="button"
                  className="icon-button"
                  title="Selecionar core"
                  onClick={() => void browseCorePath(platformId)}
                >
                  <FolderOpen size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="text-button active retroarch-core-save"
                  onClick={() => void savePlatformCore(config)}
                  disabled={saving || !draftValue.trim()}
                >
                  {successPlatformId === platformId ? <Check size={14} aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
                  {saving ? "Salvando..." : successPlatformId === platformId ? "Salvo" : "Salvar"}
                </button>
              </div>
            </div>
          );
        })}
        </div>

        <footer className="retroarch-core-dialog-footer">
          {error && <p className="form-error">{error}</p>}
          <button type="button" className="text-button danger form-action-button" onClick={onClose}>
            <X size={14} aria-hidden="true" />
            Fechar
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
        {emulatorList.length === 0 && (
          <p className="platform-list-empty">Nenhum emulador cadastrado.</p>
        )}
        {emulatorList.map((emulator) => (
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
