import { FormEvent, useEffect, useState } from "react";
import { FolderOpen, ImagePlus, Save, Unlink, X } from "lucide-react";
import { Game } from "../../../shared/types";
import { useGameStockStore } from "../../store";

export function GameForm({ game, onCancel, onSaved }: { game: Game; onCancel?: () => void; onSaved?: () => void }) {
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const upsertGame = useGameStockStore((state) => state.upsertGame);
  const [draft, setDraft] = useState(game);

  useEffect(() => setDraft(game), [game]);

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    const updated = await window.gameStockAPI.games.update(game.id, draft);
    upsertGame(updated);
    reloadGames();
    onSaved?.();
  }

  async function associateRom(): Promise<void> {
    const romPath = await window.gameStockAPI.dialogs.openRomFile();
    if (!romPath) return;
    setDraft((current) => ({ ...current, rom_path: romPath }));
    const updated = await window.gameStockAPI.games.update(game.id, { rom_path: romPath });
    upsertGame(updated);
    reloadGames();
  }

  async function importBoxArt(): Promise<void> {
    const boxArtPath = await window.gameStockAPI.dialogs.openImageFile();
    if (!boxArtPath) return;
    setDraft((current) => ({ ...current, box_art_path: boxArtPath }));
    const updated = await window.gameStockAPI.games.update(game.id, { box_art_path: boxArtPath });
    upsertGame(updated);
    reloadGames();
  }

  async function removeRom(): Promise<void> {
    if (!draft.rom_path) return;
    if (!window.confirm("Remover a ROM associada deste jogo?")) return;
    setDraft((current) => ({ ...current, rom_path: null }));
    const updated = await window.gameStockAPI.games.update(game.id, { rom_path: null });
    upsertGame(updated);
    reloadGames();
  }

  return (
    <form className="management-form detail-edit-form" onSubmit={save}>
      <label>Titulo<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <label className="checkbox-row">
        <input type="checkbox" checked={draft.favorite} onChange={(event) => setDraft({ ...draft, favorite: event.target.checked })} />
        Favorito
      </label>
      <label>Status
        <select value={draft.play_status} onChange={(event) => setDraft({ ...draft, play_status: event.target.value as Game["play_status"] })}>
          <option value="unplayed">Nao jogado</option>
          <option value="playing">Jogando</option>
          <option value="completed">Concluido</option>
        </select>
      </label>
      <label>Publisher<input value={draft.publisher ?? ""} onChange={(event) => setDraft({ ...draft, publisher: event.target.value })} /></label>
      <label>Ano<input type="number" value={draft.year ?? ""} onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) || null })} /></label>
      <label>Genero<input value={draft.genre ?? ""} onChange={(event) => setDraft({ ...draft, genre: event.target.value })} /></label>
      <label>Rating<input value={draft.rating ?? ""} onChange={(event) => setDraft({ ...draft, rating: event.target.value })} /></label>
      <label>Notas<textarea value={draft.notes ?? ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
      <footer>
        <button type="button" className="text-button" onClick={associateRom}>
          <FolderOpen size={14} aria-hidden="true" />
          Associar ROM
        </button>
        <button type="button" className="text-button danger" onClick={removeRom} disabled={!draft.rom_path}>
          <Unlink size={14} aria-hidden="true" />
          Remover ROM
        </button>
        <button type="button" className="text-button" onClick={importBoxArt}>
          <ImagePlus size={14} aria-hidden="true" />
          Box Art
        </button>
        {onCancel && (
          <button type="button" className="text-button danger form-action-button" onClick={onCancel}>
            <X size={14} aria-hidden="true" />
            Cancelar
          </button>
        )}
        <button type="submit" className="text-button active form-action-button">
          <Save size={14} aria-hidden="true" />
          Salvar
        </button>
      </footer>
    </form>
  );
}
