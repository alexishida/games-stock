/**
 * ManualGameModal.tsx
 *
 * Modal para cadastro manual de um jogo na biblioteca.
 * Exibe um formulário arrastável com os campos principais do jogo
 * (título, plataforma, publisher, ano, gênero, rating, notas, favorito e status).
 * Persiste o novo registro via IPC e atualiza o store ao salvar.
 */

import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import { GameCreateInput } from "../../../shared/types";
import { useDraggableDialog } from "../../hooks/useDraggableDialog";
import { useGameStockStore } from "../../store";

/** Rascunho vazio usado para resetar o formulário ao abrir o modal */
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

/**
 * Modal de criação manual de jogo.
 * Lê o estado `createGameOpen` do store para decidir se é renderizado.
 * Ao salvar com sucesso, seleciona o jogo recém-criado e fecha o modal.
 */
export function ManualGameModal() {
  // Controla se o modal está aberto
  const open = useGameStockStore((state) => state.createGameOpen);
  // Lista de plataformas disponíveis para o select
  const platforms = useGameStockStore((state) => state.platforms);
  // Abre/fecha o modal
  const setOpen = useGameStockStore((state) => state.setCreateGameOpen);
  // Seleciona o jogo recém-criado na interface após salvar
  const setSelectedGame = useGameStockStore((state) => state.setSelectedGame);
  // Recarrega a lista de jogos após criação
  const reloadGames = useGameStockStore((state) => state.reloadGames);

  // Estado local do rascunho do formulário
  const [draft, setDraft] = useState<Partial<GameCreateInput>>(emptyDraft);
  // Mensagem de erro de validação ou de API
  const [error, setError] = useState("");
  // Indica que a requisição de criação está em andamento
  const [saving, setSaving] = useState(false);

  // Hook que fornece refs e handlers para tornar o dialog arrastável
  const draggable = useDraggableDialog<HTMLElement>();

  // Reseta o formulário sempre que o modal for aberto
  useEffect(() => {
    if (open) {
      setDraft(emptyDraft);
      setError("");
    }
  }, [open]);

  // Não renderiza nada quando o modal está fechado
  if (!open) return null;

  /**
   * Valida os campos obrigatórios e envia a criação via IPC.
   * Em caso de sucesso, seleciona o jogo criado e fecha o modal.
   */
  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError("");

    // Validação: título obrigatório
    if (!draft.title?.trim()) {
      setError("Título é obrigatório");
      return;
    }
    // Validação: plataforma obrigatória
    if (!draft.platform_id) {
      setError("Plataforma é obrigatória");
      return;
    }

    setSaving(true);
    try {
      // Chama o IPC para criar o jogo no banco
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
      {/* Seção arrastável do modal — recebe os handlers de drag do hook */}
      <section
        ref={draggable.dialogRef}
        className="management-modal draggable-modal"
        style={draggable.style}
        onPointerDown={draggable.startDialogDrag}
        onPointerMove={draggable.dragDialog}
        onPointerUp={draggable.stopDialogDrag}
        onPointerCancel={draggable.stopDialogDrag}
      >
        <header>
          <h2>Novo jogo</h2>
          <button type="button" className="icon-button modal-close-button" onClick={() => setOpen(false)} aria-label="Fechar">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        {/* Formulário principal — onSubmit chama `save` */}
        <form className="management-form" onSubmit={save}>
          {/* Campo: título do jogo */}
          <label>Título<input value={draft.title ?? ""} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>

          {/* Campo: seleção de plataforma (ordenada alfabeticamente) */}
          <label>Plataforma
            <select value={draft.platform_id ?? ""} onChange={(event) => setDraft({ ...draft, platform_id: Number(event.target.value) || undefined })}>
              <option value="">Selecione</option>
              {[...platforms].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })).map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
            </select>
          </label>

          {/* Grade de dois campos por linha: publisher, ano, gênero e rating */}
          <div className="form-grid-two">
            <label>Publisher<input value={draft.publisher ?? ""} onChange={(event) => setDraft({ ...draft, publisher: event.target.value })} /></label>
            <label>Ano<input type="number" value={draft.year ?? ""} onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) || null })} /></label>
            <label>Gênero<input value={draft.genre ?? ""} onChange={(event) => setDraft({ ...draft, genre: event.target.value })} /></label>
            <label>Rating<input value={draft.rating ?? ""} onChange={(event) => setDraft({ ...draft, rating: event.target.value })} /></label>
          </div>

          {/* Campo: notas livres sobre o jogo */}
          <label>Notas<textarea value={draft.notes ?? ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>

          {/* Linha com checkbox de favorito e select de status de jogo */}
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

          {/* Exibe mensagem de erro de validação ou de API quando presente */}
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
