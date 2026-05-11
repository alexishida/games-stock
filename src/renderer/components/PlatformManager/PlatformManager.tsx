import { FormEvent, useEffect, useState } from "react";
import { Link2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Platform, PlatformEmulator, PlatformMappingsInput } from "../../../shared/types";
import { useDraggableDialog } from "../../hooks/useDraggableDialog";
import { useGameStockStore } from "../../store";
import { SectionIntro } from "../SectionIntro/SectionIntro";

type ModalMode = { kind: "create" } | { kind: "edit"; platform: Platform };

type MappingRow = {
  id: string;
  value: string;
};

type ExtensionRow = {
  id: string;
  extension: string;
  kind: string;
  isPrimary: boolean;
};

function PlatformFormModal({ mode, onClose }: { mode: ModalMode; onClose: () => void }) {
  const reloadPlatforms = useGameStockStore((state) => state.reloadPlatforms);
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const [name, setName] = useState(mode.kind === "edit" ? mode.platform.name : "");
  const [category, setCategory] = useState(mode.kind === "edit" ? normalizeCategory(mode.platform.category) : "Console");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const draggable = useDraggableDialog<HTMLElement>();

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (mode.kind === "edit") {
        await window.gameStockAPI.platforms.update(mode.platform.id, { name, category });
      } else {
        await window.gameStockAPI.platforms.create({ name, category });
      }
      reloadPlatforms();
      reloadGames();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a plataforma");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <section
        ref={draggable.dialogRef}
        className="management-modal platform-form-modal draggable-modal"
        style={draggable.style}
        onPointerDown={draggable.startDialogDrag}
        onPointerMove={draggable.dragDialog}
        onPointerUp={draggable.stopDialogDrag}
        onPointerCancel={draggable.stopDialogDrag}
      >
        <header>
          <h2>{mode.kind === "edit" ? "Editar plataforma" : "Nova plataforma"}</h2>
          <button type="button" className="icon-button modal-close-button" onClick={onClose} aria-label="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <form className="management-form" onSubmit={save}>
          <label>
            Nome
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: PlayStation 2"
            />
          </label>
          <label>
            Categoria
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="Console">Console</option>
              <option value="Portatil">Portátil</option>
              <option value="PC">PC</option>
            </select>
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

function PlatformMappingsModal({ platform, onClose }: { platform: Platform; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [aliases, setAliases] = useState<MappingRow[]>([]);
  const [extensions, setExtensions] = useState<ExtensionRow[]>([]);
  const draggable = useDraggableDialog<HTMLElement>();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void window.gameStockAPI.platforms.getMappings(platform.id)
      .then((mappings) => {
        if (cancelled) return;
        setAliases(
          mappings.aliases.length
            ? mappings.aliases.map((entry, index) => ({ id: `alias-${index}-${entry.alias}`, value: entry.alias }))
            : [{ id: "alias-default", value: platform.name }]
        );
        setExtensions(
          mappings.romExtensions.length
            ? mappings.romExtensions.map((entry, index) => ({
              id: `ext-${index}-${entry.extension}`,
              extension: entry.extension,
              kind: entry.kind,
              isPrimary: entry.is_primary === 1
            }))
            : [{ id: "ext-default", extension: "", kind: "", isPrimary: true }]
        );
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Não foi possível carregar os vínculos");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [platform.id, platform.name]);

  function updateAlias(id: string, value: string): void {
    setAliases((current) => current.map((item) => item.id === id ? { ...item, value } : item));
  }

  function addAlias(): void {
    setAliases((current) => [...current, { id: createRowId("alias"), value: "" }]);
  }

  function removeAlias(id: string): void {
    setAliases((current) => current.length <= 1 ? current : current.filter((item) => item.id !== id));
  }

  function updateExtension(id: string, patch: Partial<ExtensionRow>): void {
    setExtensions((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function addExtension(): void {
    setExtensions((current) => [...current, { id: createRowId("ext"), extension: "", kind: "", isPrimary: true }]);
  }

  function removeExtension(id: string): void {
    setExtensions((current) => current.length <= 1 ? current : current.filter((item) => item.id !== id));
  }

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload: PlatformMappingsInput = {
      aliases: aliases.map((item) => item.value),
      romExtensions: extensions.map((item) => ({
        extension: item.extension,
        kind: item.kind,
        is_primary: item.isPrimary
      }))
    };

    try {
      await window.gameStockAPI.platforms.saveMappings(platform.id, payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar os vínculos");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <section
        ref={draggable.dialogRef}
        className="management-modal platform-mappings-modal draggable-modal"
        style={draggable.style}
        onPointerDown={draggable.startDialogDrag}
        onPointerMove={draggable.dragDialog}
        onPointerUp={draggable.stopDialogDrag}
        onPointerCancel={draggable.stopDialogDrag}
      >
        <header>
          <div>
            <h2>Vínculos de plataforma</h2>
            <p className="platform-mappings-subtitle">{platform.name}</p>
          </div>
          <button type="button" className="icon-button modal-close-button" onClick={onClose} aria-label="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        {loading ? (
          <div className="platform-mappings-loading">Carregando...</div>
        ) : (
          <form className="management-form platform-mappings-form" onSubmit={save}>
            <section className="platform-mappings-section">
              <div className="platform-mappings-section-head">
                <div>
                  <strong>Aliases</strong>
                  <p>Nomes equivalentes usados na busca e no casamento automático de metadados.</p>
                </div>
                <button type="button" className="text-button" onClick={addAlias}>
                  <Plus size={14} aria-hidden="true" />
                  Alias
                </button>
              </div>
              <div className="platform-mappings-list">
                {aliases.map((alias, index) => (
                  <div className="platform-mappings-row" key={alias.id}>
                    <input
                      value={alias.value}
                      onChange={(event) => updateAlias(alias.id, event.target.value)}
                      placeholder={index === 0 ? platform.name : "Ex: Sony Playstation"}
                    />
                    <button
                      type="button"
                      className="icon-button danger"
                      onClick={() => removeAlias(alias.id)}
                      disabled={aliases.length <= 1}
                      title="Remover alias"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="platform-mappings-section">
              <div className="platform-mappings-section-head">
                <div>
                  <strong>Extensões de ROM</strong>
                  <p>Definem o filtro do importador de pasta para esta plataforma.</p>
                </div>
                <button type="button" className="text-button" onClick={addExtension}>
                  <Plus size={14} aria-hidden="true" />
                  Extensão
                </button>
              </div>
              <div className="platform-extension-header">
                <span>Extensão</span>
                <span>Descrição</span>
                <span>Usar</span>
                <span />
              </div>
              <div className="platform-mappings-list">
                {extensions.map((extension) => (
                  <div className="platform-extension-row" key={extension.id}>
                    <input
                      value={extension.extension}
                      onChange={(event) => updateExtension(extension.id, { extension: event.target.value })}
                      placeholder=".iso"
                    />
                    <input
                      value={extension.kind}
                      onChange={(event) => updateExtension(extension.id, { kind: event.target.value })}
                      placeholder="Imagem de disco"
                    />
                    <label className="platform-extension-check">
                      <input
                        type="checkbox"
                        checked={extension.isPrimary}
                        onChange={(event) => updateExtension(extension.id, { isPrimary: event.target.checked })}
                      />
                      <span>{extension.isPrimary ? "Sim" : "Não"}</span>
                    </label>
                    <button
                      type="button"
                      className="icon-button danger"
                      onClick={() => removeExtension(extension.id)}
                      disabled={extensions.length <= 1}
                      title="Remover extensão"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
            {error && <p className="form-error">{error}</p>}
            <footer>
              <button type="button" className="text-button danger form-action-button" onClick={onClose} disabled={saving}>
                <X size={14} aria-hidden="true" />
                Cancelar
              </button>
              <button type="submit" className="text-button active form-action-button" disabled={saving}>
                <Save size={14} aria-hidden="true" />
                {saving ? "Salvando..." : "Salvar mapeamentos"}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}

export function PlatformManager() {
  const platforms = useGameStockStore((state) => state.platforms);
  const selectedPlatformId = useGameStockStore((state) => state.selectedPlatformId);
  const setSelectedPlatformId = useGameStockStore((state) => state.setSelectedPlatformId);
  const reloadPlatforms = useGameStockStore((state) => state.reloadPlatforms);
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [mappingPlatform, setMappingPlatform] = useState<Platform | null>(null);
  const [error, setError] = useState("");
  const [defaultEmulators, setDefaultEmulators] = useState<Record<number, PlatformEmulator | null>>({});

  useEffect(() => {
    if (!platforms.length) return;
    void Promise.all(
      platforms.map((p) =>
        window.gameStockAPI.emulators
          .listByPlatform(p.id)
          .then((list) => [p.id, list.find((pe) => pe.is_default === 1) ?? null] as const)
      )
    ).then((entries) => setDefaultEmulators(Object.fromEntries(entries)));
  }, [platforms]);

  async function remove(platform: Platform): Promise<void> {
    if (!window.confirm(`Remover a plataforma "${platform.name}"?`)) return;
    setError("");
    try {
      await window.gameStockAPI.platforms.delete(platform.id);
      if (selectedPlatformId === platform.id) setSelectedPlatformId(null);
      reloadPlatforms();
      reloadGames();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível remover a plataforma");
    }
  }

  return (
    <div className="platform-manager">
      <SectionIntro title="Plataformas" description="Plataformas cadastradas para organizar biblioteca, aliases de busca e extensões aceitas no importador." />
      <div className="platform-list">
        {platforms.length === 0 && (
          <p className="platform-list-empty">Nenhuma plataforma cadastrada.</p>
        )}
        {platforms.map((platform) => (
          <div className="platform-row" key={platform.id}>
            <div className="platform-row-info">
              <strong>{platform.name}</strong>
              <span>
                {platform.category} · {platform.gameCount ?? 0} jogos
                {" · "}
                {defaultEmulators[platform.id]?.emulator?.name ?? <em>Sem emulador</em>}
              </span>
            </div>
            <div className="platform-row-actions">
              <button
                type="button"
                className="icon-button"
                title="Editar aliases e extensões"
                onClick={() => setMappingPlatform(platform)}
              >
                <Link2 size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-button"
                title="Editar"
                onClick={() => setModal({ kind: "edit", platform })}
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
              {!platform.is_default && (
                <button
                  type="button"
                  className="icon-button danger"
                  title="Remover"
                  onClick={() => remove(platform)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="platform-manager-toolbar">
        {error && <p className="form-error">{error}</p>}
        <button
          type="button"
          className="text-button active platform-add-button"
          onClick={() => setModal({ kind: "create" })}
        >
          <Plus size={14} aria-hidden="true" />
          Nova plataforma
        </button>
      </div>
      {modal && <PlatformFormModal mode={modal} onClose={() => setModal(null)} />}
      {mappingPlatform && <PlatformMappingsModal platform={mappingPlatform} onClose={() => {
        reloadPlatforms();
        setMappingPlatform(null);
      }} />}
    </div>
  );
}

function normalizeCategory(category: string): string {
  const normalized = category
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (normalized === "pc") return "PC";
  if (normalized.includes("port")) return "Portatil";
  return "Console";
}

function createRowId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
