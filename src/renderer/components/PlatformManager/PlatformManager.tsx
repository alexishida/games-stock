import { FormEvent, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Platform } from "../../../shared/types";
import { useGameStockStore } from "../../store";

type ModalMode = { kind: "create" } | { kind: "edit"; platform: Platform };

function PlatformFormModal({ mode, onClose }: { mode: ModalMode; onClose: () => void }) {
  const reloadPlatforms = useGameStockStore((state) => state.reloadPlatforms);
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const [name, setName] = useState(mode.kind === "edit" ? mode.platform.name : "");
  const [category, setCategory] = useState(mode.kind === "edit" ? mode.platform.category : "Console");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
      <section className="management-modal platform-form-modal">
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
              placeholder="Ex: PlayStation 2"
            />
          </label>
          <label>
            Categoria
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="Console">Console</option>
              <option value="Portátil">Portátil</option>
              <option value="PC">PC</option>
            </select>
          </label>
          {error && <p className="form-error">{error}</p>}
          <footer>
            <button type="button" className="text-button" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="text-button active" disabled={saving || !name.trim()}>
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </footer>
        </form>
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
  const [error, setError] = useState("");

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
      <div className="platform-list">
        {platforms.length === 0 && (
          <p className="platform-list-empty">Nenhuma plataforma cadastrada.</p>
        )}
        {platforms.map((platform) => (
          <div className="platform-row" key={platform.id}>
            <div className="platform-row-info">
              <strong>{platform.name}</strong>
              <span>{platform.category} &middot; {platform.gameCount ?? 0} jogos</span>
            </div>
            <div className="platform-row-actions">
              <button
                type="button"
                className="icon-button"
                title="Editar"
                onClick={() => setModal({ kind: "edit", platform })}
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-button"
                title="Remover"
                onClick={() => remove(platform)}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
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
    </div>
  );
}
