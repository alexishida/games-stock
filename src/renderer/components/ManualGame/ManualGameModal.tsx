import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import { GameCreateInput } from "../../../shared/types";
import { useGameStockStore } from "../../store";

const emptyDraft: Partial<GameCreateInput> = {
  title: "",
  platform_id: undefined,
  publisher: "",
  year: null,
  genre: "",
  rating: "",
  notes: "",
  favorite: false,
  play_status: "unplayed"
};

export function ManualGameModal() {
  const open = useGameStockStore((state) => state.createGameOpen);
  const platforms = useGameStockStore((state) => state.platforms);
  const setOpen = useGameStockStore((state) => state.setCreateGameOpen);
  const setSelectedGame = useGameStockStore((state) => state.setSelectedGame);
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const [draft, setDraft] = useState<Partial<GameCreateInput>>(emptyDraft);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(emptyDraft);
      setError("");
    }
  }, [open]);

  if (!open) return null;

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError("");
    if (!draft.title?.trim()) {
      setError("Título é obrigatório");
      return;
    }
    if (!draft.platform_id) {
      setError("Plataforma é obrigatória");
      return;
    }

    setSaving(true);
    try {
      const game = await window.gameStockAPI.games.create(draft);
      setSelectedGame(game);
      reloadGames();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o jogo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="management-modal">
        <header>
          <h2>Novo jogo</h2>
          <button type="button" className="icon-button modal-close-button" onClick={() => setOpen(false)} aria-label="Fechar">
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <form className="management-form" onSubmit={save}>
          <label>Título<input value={draft.title ?? ""} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>Plataforma
            <select value={draft.platform_id ?? ""} onChange={(event) => setDraft({ ...draft, platform_id: Number(event.target.value) || undefined })}>
              <option value="">Selecione</option>
              {[...platforms].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })).map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
            </select>
          </label>
          <div className="form-grid-two">
            <label>Publisher<input value={draft.publisher ?? ""} onChange={(event) => setDraft({ ...draft, publisher: event.target.value })} /></label>
            <label>Ano<input type="number" value={draft.year ?? ""} onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) || null })} /></label>
            <label>Gênero<input value={draft.genre ?? ""} onChange={(event) => setDraft({ ...draft, genre: event.target.value })} /></label>
            <label>Rating<input value={draft.rating ?? ""} onChange={(event) => setDraft({ ...draft, rating: event.target.value })} /></label>
          </div>
          <label>Notas<textarea value={draft.notes ?? ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
          <div className="form-grid-two">
            <label className="checkbox-row">
              <input type="checkbox" checked={Boolean(draft.favorite)} onChange={(event) => setDraft({ ...draft, favorite: event.target.checked })} />
              Favorito
            </label>
            <label>Status
              <select value={draft.play_status ?? "unplayed"} onChange={(event) => setDraft({ ...draft, play_status: event.target.value as GameCreateInput["play_status"] })}>
                <option value="unplayed">Não jogado</option>
                <option value="playing">Jogando</option>
                <option value="completed">Concluído</option>
              </select>
            </label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <footer>
            <button type="button" className="text-button" onClick={() => setOpen(false)}>Cancelar</button>
            <button type="submit" className="text-button active" disabled={saving}>Salvar</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
