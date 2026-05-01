import { FormEvent, useEffect, useState } from "react";
import { Game, PhysicalCondition } from "../../../shared/types";
import { useGameStockStore } from "../../store";

export function GameForm({ game }: { game: Game }) {
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const [draft, setDraft] = useState(game);

  useEffect(() => setDraft(game), [game]);

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    await window.gameStockAPI.games.update(game.id, draft);
    reloadGames();
  }

  async function associateRom(): Promise<void> {
    const romPath = await window.gameStockAPI.dialogs.openRomFile();
    if (!romPath) return;
    setDraft((current) => ({ ...current, rom_path: romPath }));
    await window.gameStockAPI.games.update(game.id, { rom_path: romPath });
    reloadGames();
  }

  async function importBoxArt(): Promise<void> {
    const boxArtPath = await window.gameStockAPI.dialogs.openImageFile();
    if (!boxArtPath) return;
    setDraft((current) => ({ ...current, box_art_path: boxArtPath }));
    await window.gameStockAPI.games.update(game.id, { box_art_path: boxArtPath });
    reloadGames();
  }

  return (
    <form className="game-form" onSubmit={save}>
      <label>Titulo<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <label>Publisher<input value={draft.publisher ?? ""} onChange={(event) => setDraft({ ...draft, publisher: event.target.value })} /></label>
      <label>Ano<input type="number" value={draft.year ?? ""} onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) || null })} /></label>
      <label>Genero<input value={draft.genre ?? ""} onChange={(event) => setDraft({ ...draft, genre: event.target.value })} /></label>
      <label>Rating<input value={draft.rating ?? ""} onChange={(event) => setDraft({ ...draft, rating: event.target.value })} /></label>
      <label>Notas<textarea value={draft.notes ?? ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
      <label className="checkbox-row">
        <input type="checkbox" checked={draft.owned_physical} onChange={(event) => setDraft({ ...draft, owned_physical: event.target.checked })} />
        Tenho fisico
      </label>
      {draft.owned_physical && (
        <label>Condicao
          <select value={draft.physical_condition ?? PhysicalCondition.Good} onChange={(event) => setDraft({ ...draft, physical_condition: event.target.value as PhysicalCondition })}>
            {Object.values(PhysicalCondition).map((condition) => <option key={condition} value={condition}>{condition}</option>)}
          </select>
        </label>
      )}
      <div className="detail-actions">
        <button type="button" className="text-button" onClick={associateRom}>Associar ROM</button>
        <button type="button" className="text-button" onClick={() => setDraft({ ...draft, rom_path: null })}>Remover ROM</button>
        <button type="button" className="text-button" onClick={importBoxArt}>Importar Box Art</button>
        <button type="submit" className="text-button active">Salvar</button>
      </div>
    </form>
  );
}
