import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { AlertCircle, CheckCircle2, Database, FolderOpen, ImagePlus, LoaderCircle, Pencil, Save, Search, Sparkles, Unlink, X } from "lucide-react";
import { Game, GameUpdateInput, LaunchBoxGame, LaunchBoxImageType } from "../../../shared/types";
import { useGameStockStore } from "../../store";

const metadataImportTypes: LaunchBoxImageType[] = ["Box - Front", "Fanart - Background", "Screenshot - Gameplay"];

export function GameForm({ game, onCancel, onSaved }: { game: Game; onCancel?: () => void; onSaved?: () => void }) {
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const upsertGame = useGameStockStore((state) => state.upsertGame);
  const [draft, setDraft] = useState(game);
  const [metadataQuery, setMetadataQuery] = useState(game.title);
  const [metadataSuggestions, setMetadataSuggestions] = useState<LaunchBoxGame[]>([]);
  const [metadataError, setMetadataError] = useState("");
  const [searchingMetadata, setSearchingMetadata] = useState(false);
  const [importingMetadataId, setImportingMetadataId] = useState<string | null>(null);
  const [metadataImportStatus, setMetadataImportStatus] = useState("");
  const [metadataPickerOpen, setMetadataPickerOpen] = useState(false);
  const [metadataEditorOpen, setMetadataEditorOpen] = useState(false);

  useEffect(() => {
    setDraft(game);
    setMetadataQuery(game.title);
    setMetadataSuggestions([]);
    setMetadataError("");
    setMetadataImportStatus("");
    setMetadataPickerOpen(false);
    setMetadataEditorOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id]);

  const hasMetadata = useMemo(() => hasGameMetadata(draft), [draft]);
  const metadataSummary = useMemo(() => buildMetadataSummary(draft), [draft]);

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

  async function searchMetadata(): Promise<void> {
    const query = metadataQuery.trim() || draft.title.trim();
    if (!query) {
      setMetadataError("Digite um título para buscar");
      return;
    }

    setSearchingMetadata(true);
    setMetadataError("");
    try {
      const metadataExists = await window.gameStockAPI.launchbox.metadataExists();
      if (!metadataExists) await window.gameStockAPI.launchbox.ensureMetadata();
      const results = await window.gameStockAPI.launchbox.searchGames({
        query,
        platformName: draft.platform_name ?? null
      });
      setMetadataSuggestions(results.slice(0, 8));
      if (!results.length) setMetadataError("Nenhum título encontrado na base de metadados");
    } catch (err) {
      setMetadataError(err instanceof Error ? err.message : "Falha ao buscar metadados");
    } finally {
      setSearchingMetadata(false);
    }
  }

  async function applyMetadataSuggestion(suggestion: LaunchBoxGame): Promise<void> {
    setImportingMetadataId(suggestion.id);
    setMetadataError("");
    setMetadataImportStatus(`Importando "${suggestion.name}"...`);
    try {
      const result = await window.gameStockAPI.launchbox.importGame({
        launchboxGameId: suggestion.id,
        targetGameId: game.id,
        imageTypes: metadataImportTypes
      });
      const updated = await window.gameStockAPI.games.get(result.gameId);
      if (!updated) throw new Error("Jogo atualizado não encontrado");
      setDraft(updated);
      upsertGame(updated);
      reloadGames();
      setMetadataImportStatus("Metadados importados");
      setMetadataPickerOpen(false);
    } catch (err) {
      setMetadataError(err instanceof Error ? err.message : "Falha ao importar metadados");
      setMetadataImportStatus("");
    } finally {
      setImportingMetadataId(null);
    }
  }

  function openMetadataPicker(): void {
    setMetadataPickerOpen(true);
    if (!searchingMetadata) void searchMetadata();
  }

  async function saveMetadataFields(data: GameUpdateInput): Promise<void> {
    const updated = await window.gameStockAPI.games.update(game.id, data);
    setDraft(updated);
    upsertGame(updated);
    reloadGames();
    setMetadataEditorOpen(false);
  }

  return (
    <>
      <form className="management-form detail-edit-form" onSubmit={save}>
        <div className="detail-edit-title-card">
          <h3 style={{ color: "#00f2ff", fontSize: "21px" }}>{draft.title || "Jogo sem título"}</h3>
          <span style={{ color: "rgba(229, 226, 225, 0.82)", fontSize: "14px" }}>{draft.platform_name ?? "Sem plataforma definida"}</span>
        </div>

        <section className={"detail-edit-section detail-metadata-hub" + (hasMetadata ? " has-data" : " is-empty")}>
          <div className="detail-edit-section-heading">
            <div>
              <span className="detail-edit-kicker">Metadados</span>
              <h3>{hasMetadata ? "Dados vinculados" : "Buscar na base"}</h3>
            </div>
            <div className={"detail-metadata-badge" + (hasMetadata ? " has-data" : " is-empty")}>
              {hasMetadata ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}
              {hasMetadata ? "Metadados ativos" : "Sem metadados"}
            </div>
          </div>

          {hasMetadata ? (
            <>
              <div className="detail-metadata-summary-grid">
                {metadataSummary.map((item) => (
                  <div key={item.label} className={item.value ? "" : "is-empty"}>
                    <span>{item.label}</span>
                    <strong>{item.value || item.fallback}</strong>
                  </div>
                ))}
              </div>
              <div className="detail-metadata-actions">
                <button type="button" className="text-button active" onClick={() => setMetadataEditorOpen(true)}>
                  <Database size={14} aria-hidden="true" />
                  Ver metadados
                </button>
                <button type="button" className="text-button" onClick={openMetadataPicker} disabled={searchingMetadata || Boolean(importingMetadataId)}>
                  <Search size={14} aria-hidden="true" />
                  Buscar outro título
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="detail-metadata-empty-copy">
                <Sparkles size={16} aria-hidden="true" />
                <div>
                  <strong>Complete o cadastro com a base de metadados</strong>
                  <p>Capa, publisher, gênero, rating e descrição entram automaticamente após selecionar um título.</p>
                </div>
              </div>
              <div className="detail-metadata-searchbar compact">
                <input
                  value={metadataQuery}
                  onChange={(event) => setMetadataQuery(event.target.value)}
                  placeholder="Título para busca"
                />
                <button type="button" className="text-button active" onClick={openMetadataPicker} disabled={searchingMetadata || Boolean(importingMetadataId)}>
                  <Search size={14} aria-hidden="true" />
                  Buscar
                </button>
                <button type="button" className="text-button" onClick={() => setMetadataEditorOpen(true)}>
                  <Pencil size={14} aria-hidden="true" />
                  Manual
                </button>
              </div>
            </>
          )}
          {metadataError && <p className="form-error">{metadataError}</p>}
        </section>

        <section className="detail-edit-section detail-file-section">
          <div className="detail-edit-section-heading">
            <div>
              <span className="detail-edit-kicker">Arquivos</span>
              <h3>ROM e mídia local</h3>
            </div>
          </div>
          <div className="detail-file-action-grid">
            <button type="button" className="detail-file-action-card" onClick={associateRom}>
              <FolderOpen size={18} aria-hidden="true" />
              <strong>Associar ROM</strong>
              <span>{draft.rom_path ? getFileName(draft.rom_path) : "Nenhuma ROM associada"}</span>
            </button>
            <button type="button" className="detail-file-action-card danger" onClick={removeRom} disabled={!draft.rom_path}>
              <Unlink size={18} aria-hidden="true" />
              <strong>Remover ROM</strong>
              <span>{draft.rom_path ? "Desvincular arquivo atual" : "Sem ROM para remover"}</span>
            </button>
            <button type="button" className="detail-file-action-card" onClick={importBoxArt}>
              <ImagePlus size={18} aria-hidden="true" />
              <strong>Box art</strong>
              <span>{draft.box_art_path ? "Capa associada" : "Adicionar capa local"}</span>
            </button>
          </div>
        </section>

        <footer>
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

      {metadataPickerOpen && (
        <MetadataPickerModal
          query={metadataQuery}
          suggestions={metadataSuggestions}
          searching={searchingMetadata}
          importingMetadataId={importingMetadataId}
          importStatus={metadataImportStatus}
          error={metadataError}
          onQueryChange={setMetadataQuery}
          onClose={() => setMetadataPickerOpen(false)}
          onSearch={() => void searchMetadata()}
          onSelect={(suggestion) => void applyMetadataSuggestion(suggestion)}
        />
      )}

      {metadataEditorOpen && (
        <MetadataEditorModal
          game={draft}
          onClose={() => setMetadataEditorOpen(false)}
          onSave={saveMetadataFields}
        />
      )}
    </>
  );
}

function MetadataEditorModal({
  game,
  onClose,
  onSave
}: {
  game: Game;
  onClose: () => void;
  onSave: (data: GameUpdateInput) => Promise<void>;
}) {
  const draggable = useDraggableDialog();
  const [title, setTitle] = useState(game.title ?? "");
  const [publisher, setPublisher] = useState(game.publisher ?? "");
  const [genre, setGenre] = useState(game.genre ?? "");
  const [rating, setRating] = useState(game.rating ?? "");
  const [year, setYear] = useState(game.year?.toString() ?? "");
  const [notes, setNotes] = useState(game.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({
        title: title.trim() || game.title,
        publisher: normalizeOptionalText(publisher),
        genre: normalizeOptionalText(genre),
        rating: normalizeOptionalText(rating),
        year: Number(year) || null,
        notes: normalizeOptionalText(notes)
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar metadados");
      setSaving(false);
    }
  }

  return (
    <div className="detail-secondary-overlay">
      <section
        ref={draggable.dialogRef}
        className="management-modal detail-metadata-modal detail-metadata-editor-modal draggable-detail-modal"
        style={draggable.style}
        onPointerDown={draggable.startDialogDrag}
        onPointerMove={draggable.dragDialog}
        onPointerUp={draggable.stopDialogDrag}
        onPointerCancel={draggable.stopDialogDrag}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-metadata-editor-title"
      >
        <header>
          <div>
            <h2 id="detail-metadata-editor-title">Metadados existentes</h2>
            <p className="detail-metadata-modal-subtitle">Dados usados no detalhe do jogo.</p>
          </div>
          <button type="button" className="icon-button modal-close-button" onClick={onClose} aria-label="Fechar">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <div className="detail-metadata-existing-grid">
          <div>
            <span>Metadata ID</span>
            <strong>{game.launchbox_id || "Não vinculado"}</strong>
          </div>
          <div>
            <span>Capa</span>
            <strong>{game.box_art_path ? "Associada" : "Não associada"}</strong>
          </div>
          <div>
            <span>Background</span>
            <strong>{game.background_path ? "Associado" : "Não associado"}</strong>
          </div>
          <div>
            <span>Screenshot</span>
            <strong>{game.screenshot_path ? "Associado" : "Não associado"}</strong>
          </div>
        </div>

        <form className="management-form detail-metadata-editor-form" onSubmit={save}>
          <div className="form-grid-two detail-edit-grid detail-metadata-editor-grid">
            <label className="detail-metadata-editor-title-field">Título<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label>Publisher<input value={publisher} onChange={(event) => setPublisher(event.target.value)} /></label>
            <label>Gênero<input value={genre} onChange={(event) => setGenre(event.target.value)} /></label>
            <label>Ano<input type="number" value={year} onChange={(event) => setYear(event.target.value)} /></label>
            <label>Rating<input value={rating} onChange={(event) => setRating(event.target.value)} /></label>
          </div>
          <label>Descrição<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          {error && <p className="form-error">{error}</p>}
          <footer className="detail-metadata-modal-footer">
            <button type="button" className="text-button danger form-action-button" onClick={onClose} disabled={saving}>
              <X size={14} aria-hidden="true" />
              Fechar
            </button>
            <button type="submit" className="text-button active form-action-button" disabled={saving}>
              {saving ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
              {saving ? "Salvando" : "Salvar"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function MetadataPickerModal({
  query,
  suggestions,
  searching,
  importingMetadataId,
  importStatus,
  error,
  onQueryChange,
  onClose,
  onSearch,
  onSelect
}: {
  query: string;
  suggestions: LaunchBoxGame[];
  searching: boolean;
  importingMetadataId: string | null;
  importStatus: string;
  error: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onSearch: () => void;
  onSelect: (suggestion: LaunchBoxGame) => void;
}) {
  const draggable = useDraggableDialog();

  return (
    <div className="detail-secondary-overlay">
      <section
        ref={draggable.dialogRef}
        className="management-modal detail-metadata-modal draggable-detail-modal"
        style={draggable.style}
        onPointerDown={draggable.startDialogDrag}
        onPointerMove={draggable.dragDialog}
        onPointerUp={draggable.stopDialogDrag}
        onPointerCancel={draggable.stopDialogDrag}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-metadata-modal-title"
      >
        <header>
          <div>
            <h2 id="detail-metadata-modal-title">Buscar metadados</h2>
            <p className="detail-metadata-modal-subtitle">Selecione um título da base para aplicar no jogo atual.</p>
          </div>
          <button type="button" className="icon-button modal-close-button" onClick={onClose} aria-label="Fechar">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <div className="detail-metadata-modal-toolbar">
          <input
            autoFocus
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar título na base de metadados"
          />
          <button type="button" className="text-button active" onClick={onSearch} disabled={searching || Boolean(importingMetadataId)}>
            {searching ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : <Search size={14} aria-hidden="true" />}
            Buscar
          </button>
        </div>

        <div className="detail-metadata-modal-results">
          {importStatus && (
            <div className="detail-metadata-import-status" role="status">
              <LoaderCircle size={14} className="spin" aria-hidden="true" />
              {importStatus}
            </div>
          )}
          {suggestions.length > 0 ? suggestions.map((suggestion) => {
            const importing = importingMetadataId === suggestion.id;
            return (
              <article key={suggestion.id} className="detail-metadata-card">
                <div className="detail-metadata-card-copy">
                  <strong>{suggestion.name}</strong>
                  <span>{suggestion.platform}</span>
                  <p>{buildSuggestionSummary(suggestion)}</p>
                </div>
                <button type="button" className="text-button active" onClick={() => onSelect(suggestion)} disabled={Boolean(importingMetadataId)}>
                  {importing ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
                  {importing ? "Importando" : "Importar"}
                </button>
              </article>
            );
          }) : (
            <div className="detail-metadata-modal-empty">
              {searching ? "Buscando títulos..." : "Nenhum título carregado. Faça uma busca para selecionar."}
            </div>
          )}
        </div>

        <footer className="detail-metadata-modal-footer">
          {error && <p className="form-error">{error}</p>}
          <button type="button" className="text-button danger form-action-button" onClick={onClose}>
            <X size={14} aria-hidden="true" />
            Fechar
          </button>
        </footer>
      </section>
    </div>
  );
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

function hasGameMetadata(game: Game): boolean {
  return Boolean(
    game.launchbox_id
    || game.publisher?.trim()
    || game.genre?.trim()
    || game.rating?.trim()
    || game.notes?.trim()
    || game.box_art_path
    || game.background_path
    || game.screenshot_path
  );
}

function buildSuggestionSummary(game: LaunchBoxGame): string {
  const parts = [game.release?.slice(0, 4), game.publisher, game.genres]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.join(" / ") || "Sem resumo adicional";
}

function buildMetadataSummary(game: Game): Array<{ label: string; value: string; fallback: string }> {
  return [
    { label: "Publisher", value: game.publisher?.trim() ?? "", fallback: "Não informado" },
    { label: "Gênero", value: game.genre?.trim() ?? "", fallback: "Não informado" },
    { label: "Rating", value: game.rating?.trim() ?? "", fallback: "Não informado" },
    { label: "Metadata ID", value: game.launchbox_id?.trim() ?? "", fallback: "Não vinculado" }
  ];
}

function normalizeOptionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}

function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}
