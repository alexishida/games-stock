import { FormEvent, useState } from "react";
import { Platform } from "../../../shared/types";
import { useGameStockStore } from "../../store";

export function PlatformManager() {
  const platforms = useGameStockStore((state) => state.platforms);
  const selectedPlatformId = useGameStockStore((state) => state.selectedPlatformId);
  const setSelectedPlatformId = useGameStockStore((state) => state.setSelectedPlatformId);
  const reloadPlatforms = useGameStockStore((state) => state.reloadPlatforms);
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const [editing, setEditing] = useState<Platform | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Console");
  const [error, setError] = useState("");

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
      setCategory("Console");
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

  function edit(platform: Platform): void {
    setEditing(platform);
    setName(platform.name);
    setCategory(platform.category);
    setError("");
  }

  return (
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
        <label>Categoria
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="Console">Console</option>
            <option value="Portátil">Portátil</option>
            <option value="PC">PC</option>
          </select>
        </label>
        {error && <p className="form-error">{error}</p>}
        <footer>
          {editing && <button type="button" className="text-button" onClick={() => { setEditing(null); setName(""); setCategory("Console"); }}>Limpar</button>}
          <button type="submit" className="text-button active">Salvar</button>
        </footer>
      </form>
    </div>
  );
}
