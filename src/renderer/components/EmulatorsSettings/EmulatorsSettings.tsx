import { FormEvent, useEffect, useRef, useState } from "react";
import { FolderOpen, Link, Pencil, Plus, Save, Trash2, Unlink, X } from "lucide-react";
import { Emulator, Platform, PlatformEmulator } from "../../../shared/types";
import { getRetroArchCoreForPlatform, RETROARCH_CORE_NAMES } from "../../../shared/retroarch";
import { useGameStockStore } from "../../store";
import { SectionIntro } from "../SectionIntro/SectionIntro";
import "./EmulatorsSettings.css";

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
    <div className="modal-backdrop">
      <section className="management-modal emulator-form-modal">
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
    <div className="modal-backdrop">
      <section className="management-modal emulator-form-modal">
        <header>
          <h2>Vincular a plataforma</h2>
          <button type="button" className="icon-button modal-close-button" onClick={onClose} aria-label="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <form className="management-form" onSubmit={save}>
          <label>
            Plataforma
            <select value={platformId} onChange={(e) => setPlatformId(Number(e.target.value))}>
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
  onReload
}: {
  emulator: Emulator;
  platforms: Platform[];
  onEdit: () => void;
  onDelete: () => void;
  onReload: () => void;
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

export function EmulatorsSettings() {
  const platforms = useGameStockStore((state) => state.platforms);
  const reloadPlatforms = useGameStockStore((state) => state.reloadPlatforms);
  const [emulatorList, setEmulatorList] = useState<Emulator[]>([]);
  const [modal, setModal] = useState<EmulatorModalMode | null>(null);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  function reload(): void {
    setReloadToken((t) => t + 1);
    reloadPlatforms();
  }

  useEffect(() => {
    window.gameStockAPI.emulators.list().then(setEmulatorList).catch(() => {});
  }, [reloadToken]);

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
    </div>
  );
}
