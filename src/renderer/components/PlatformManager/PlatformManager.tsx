import { FormEvent, useEffect, useState } from "react";
import { Platform } from "../../../shared/types";
import { useGameStockStore } from "../../store";

export function PlatformManager() {
  const open = useGameStockStore((state) => state.platformManagerOpen);
  const platforms = useGameStockStore((state) => state.platforms);
  const selectedPlatformId = useGameStockStore((state) => state.selectedPlatformId);
  const setOpen = useGameStockStore((state) => state.setPlatformManagerOpen);
  const setSelectedPlatformId = useGameStockStore((state) => state.setSelectedPlatformId);
  const reloadPlatforms = useGameStockStore((state) => state.reloadPlatforms);
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const [editing, setEditing] = useState<Platform | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Consoles");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setEditing(null);
    setName("");
    setCategory("Consoles");
    setError("");
  }, [open]);

  if (!open) return null;

  function edit(platform: Platform): void {
    setEditing(platform);
    setName(platform.name);
    setCategory(platform.category);
    setError("");
  }

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError("");
    try {
      if (editing) {
        await window.gameStockAPI.platforms.update(editing.id, { name, category });
      } else {
        await window.gameStockAPI.platforms.create({ name, category });
      }
      setEditing(null);
      setName("");
      setCategory("Consoles");
      reloadPlatforms();
      reloadGames();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar a plataforma");
    }
  }

  async function remove(platform: Platform): Promise<void> {
    if (!window.confirm(`Remover a plataforma "${platform.name}"?`)) return;
    setError("");
    try {
      await window.gameStockAPI.platforms.delete(platform.id);
      if (selectedPlatformId === platform.id) setSelectedPlatformId(null);
      reloadPlatforms();
      reloadGames();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel remover a plataforma");
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="management-modal platform-modal">
        <header>
          <h2>Gerenciar plataformas</h2>
          <button type="button" className="icon-button" onClick={() => setOpen(false)}>x</button>
        </header>
        <div className="platform-manager-grid">
          <div className="platform-list">
            {platforms.map((platform) => (
              <div className="platform-row" key={platform.id}>
                <button type="button" onClick={() => edit(platform)}>
                  <strong>{platform.name}</strong>
                  <span>{platform.category} - {platform.gameCount ?? 0} jogos</span>
                </button>
                <button type="button" className="icon-button" title="Remover" onClick={() => remove(platform)}>
                  <span className="material-symbols-outlined" aria-hidden="true">delete</span>
                </button>
              </div>
            ))}
          </div>
          <form className="management-form" onSubmit={save}>
            <h3>{editing ? "Editar plataforma" : "Nova plataforma"}</h3>
            <label>Nome<input value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label>Categoria<input value={category} onChange={(event) => setCategory(event.target.value)} /></label>
            {error && <p className="form-error">{error}</p>}
            <footer>
              {editing && <button type="button" className="text-button" onClick={() => { setEditing(null); setName(""); setCategory("Consoles"); }}>Limpar</button>}
              <button type="submit" className="text-button active">Salvar</button>
            </footer>
          </form>
        </div>
      </section>
    </div>
  );
}
