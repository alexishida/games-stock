/**
 * GameForm.tsx
 *
 * Formulário de edição de um jogo dentro do modal de detalhe.
 * Agrupa três fluxos principais:
 *   1. Edição de metadados via busca na base LaunchBox (MetadataPickerModal)
 *   2. Edição manual dos campos de metadados (MetadataEditorModal)
 *   3. Associação de arquivos locais: ROM e box art
 *
 * Todos os sub-modais são arrastáveis e empilhados sobre o modal pai (detail-edit-modal).
 */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Database, FolderOpen, ImagePlus, LoaderCircle, Pencil, Save, Search, Sparkles, Unlink, X } from "lucide-react";
import { Game, GameUpdateInput, LaunchBoxGame, LaunchBoxImageType } from "../../../shared/types";
import { useDraggableDialog } from "../../hooks/useDraggableDialog";
import { useGameStockStore } from "../../store";

/**
 * Tipos de imagem importados automaticamente ao aplicar metadados LaunchBox.
 * Inclui capa frontal, fanart de fundo e screenshot de gameplay.
 */
const metadataImportTypes: LaunchBoxImageType[] = ["Box - Front", "Fanart - Background", "Screenshot - Gameplay"];

/**
 * Formulário principal de edição de jogo.
 * Exibe seções de metadados e arquivos, e abre sub-modais de busca e edição manual.
 *
 * @param game      Dados atuais do jogo sendo editado.
 * @param onCancel  Callback chamado ao cancelar a edição (exibe botão cancelar se fornecido).
 * @param onSaved   Callback chamado após salvar os dados com sucesso.
 */
export function GameForm({ game, onCancel, onSaved }: { game: Game; onCancel?: () => void; onSaved?: () => void }) {
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const upsertGame = useGameStockStore((state) => state.upsertGame);

  // Cópia mutável dos dados do jogo para edição local (draft)
  const [draft, setDraft] = useState(game);

  // Query da barra de busca de metadados (inicializada com o título do jogo)
  const [metadataQuery, setMetadataQuery] = useState(game.title);

  // Sugestões retornadas pela busca na base LaunchBox
  const [metadataSuggestions, setMetadataSuggestions] = useState<LaunchBoxGame[]>([]);

  // Mensagem de erro da busca ou importação de metadados
  const [metadataError, setMetadataError] = useState("");

  // true enquanto a busca de metadados está em andamento
  const [searchingMetadata, setSearchingMetadata] = useState(false);

  // ID da sugestão sendo importada (null quando nenhuma importação ativa)
  const [importingMetadataId, setImportingMetadataId] = useState<string | null>(null);

  // Mensagem de status da importação exibida durante o processo
  const [metadataImportStatus, setMetadataImportStatus] = useState("");

  // Controla a abertura do modal de busca de metadados (MetadataPickerModal)
  const [metadataPickerOpen, setMetadataPickerOpen] = useState(false);

  // Controla a abertura do modal de edição manual de metadados (MetadataEditorModal)
  const [metadataEditorOpen, setMetadataEditorOpen] = useState(false);

  /**
   * Reseta todos os estados do formulário quando o ID do jogo muda.
   * Evita que dados de um jogo anterior contaminem o formulário do novo jogo.
   */
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

  /** true se o draft possui ao menos um campo de metadados preenchido. */
  const hasMetadata = useMemo(() => hasGameMetadata(draft), [draft]);

  /** Array de campos de metadados para exibição no resumo (quando há dados). */
  const metadataSummary = useMemo(() => buildMetadataSummary(draft), [draft]);

  /**
   * Salva o draft atual via IPC, atualiza o store e chama onSaved.
   * Usado pelo botão "Salvar" do formulário principal.
   */
  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    const updated = await window.gameStockAPI.games.update(game.id, draft);
    upsertGame(updated);
    reloadGames();
    onSaved?.();
  }

  /**
   * Abre diálogo nativo para selecionar a ROM e associa ao jogo imediatamente.
   * Atualiza o draft local e persiste via IPC sem precisar clicar em "Salvar".
   */
  async function associateRom(): Promise<void> {
    const romPath = await window.gameStockAPI.dialogs.openRomFile();
    if (!romPath) return;
    setDraft((current) => ({ ...current, rom_path: romPath }));
    const updated = await window.gameStockAPI.games.update(game.id, { rom_path: romPath });
    upsertGame(updated);
    reloadGames();
  }

  /**
   * Abre diálogo nativo para selecionar uma imagem de capa local e associa ao jogo.
   * Atualiza o draft local e persiste via IPC sem precisar clicar em "Salvar".
   */
  async function importBoxArt(): Promise<void> {
    const boxArtPath = await window.gameStockAPI.dialogs.openImageFile();
    if (!boxArtPath) return;
    setDraft((current) => ({ ...current, box_art_path: boxArtPath }));
    const updated = await window.gameStockAPI.games.update(game.id, { box_art_path: boxArtPath });
    upsertGame(updated);
    reloadGames();
  }

  /**
   * Remove a ROM associada ao jogo após confirmação.
   * Atualiza o draft local e persiste a remoção via IPC.
   */
  async function removeRom(): Promise<void> {
    if (!draft.rom_path) return;
    if (!window.confirm("Remover a ROM associada deste jogo?")) return;
    setDraft((current) => ({ ...current, rom_path: null }));
    const updated = await window.gameStockAPI.games.update(game.id, { rom_path: null });
    upsertGame(updated);
    reloadGames();
  }

  /**
   * Busca títulos na base de metadados LaunchBox pelo nome do jogo.
   * Garante que o Metadata.zip existe antes de pesquisar.
   * Exibe até 8 resultados no MetadataPickerModal.
   */
  async function searchMetadata(): Promise<void> {
    const query = metadataQuery.trim() || draft.title.trim();
    if (!query) {
      setMetadataError("Digite um título para buscar");
      return;
    }

    setSearchingMetadata(true);
    setMetadataError("");
    try {
      // Verifica se o banco de metadados local existe; faz download se necessário
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

  /**
   * Aplica os metadados de uma sugestão LaunchBox ao jogo atual.
   * Importa capa frontal, fanart e screenshot automaticamente.
   * Atualiza o draft e o store após a importação.
   */
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

  /**
   * Abre o MetadataPickerModal e inicia a busca imediatamente se não estiver em andamento.
   */
  function openMetadataPicker(): void {
    setMetadataPickerOpen(true);
    if (!searchingMetadata) void searchMetadata();
  }

  /**
   * Salva os campos editados manualmente no MetadataEditorModal via IPC.
   * Atualiza o draft e fecha o editor após sucesso.
   */
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
        {/* Card com título e plataforma do jogo — apenas informativo, não editável aqui */}
        <div className="detail-edit-title-card">
          <h3 style={{ color: "#00f2ff", fontSize: "21px" }}>{draft.title || "Jogo sem título"}</h3>
          <span style={{ color: "rgba(229, 226, 225, 0.82)", fontSize: "14px" }}>{draft.platform_name ?? "Sem plataforma definida"}</span>
        </div>

        {/* Seção de metadados: exibe resumo quando há dados ou campo de busca quando vazio */}
        <section className={"detail-edit-section detail-metadata-hub" + (hasMetadata ? " has-data" : " is-empty")}>
          <div className="detail-edit-section-heading">
            <div>
              <span className="detail-edit-kicker">Metadados</span>
              <h3>{hasMetadata ? "Dados vinculados" : "Buscar na base"}</h3>
            </div>
            {/* Badge visual indicando presença ou ausência de metadados */}
            <div className={"detail-metadata-badge" + (hasMetadata ? " has-data" : " is-empty")}>
              {hasMetadata ? <CheckCircle2 size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}
              {hasMetadata ? "Metadados ativos" : "Sem metadados"}
            </div>
          </div>

          {hasMetadata ? (
            <>
              {/* Grade com resumo dos principais campos de metadados */}
              <div className="detail-metadata-summary-grid">
                {metadataSummary.map((item) => (
                  <div key={item.label} className={item.value ? "" : "is-empty"}>
                    <span>{item.label}</span>
                    <strong>{item.value || item.fallback}</strong>
                  </div>
                ))}
              </div>
              {/* Ações disponíveis quando há metadados: ver/editar ou buscar outro título */}
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
              {/* Estado vazio: incentiva o usuário a buscar metadados na base */}
              <div className="detail-metadata-empty-copy">
                <Sparkles size={16} aria-hidden="true" />
                <div>
                  <strong>Complete o cadastro com a base de metadados</strong>
                  <p>Capa, publisher, gênero, rating e descrição entram automaticamente após selecionar um título.</p>
                </div>
              </div>
              {/* Barra de busca compacta exibida quando não há metadados */}
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
                {/* Botão de edição manual para casos onde a busca não é necessária */}
                <button type="button" className="text-button" onClick={() => setMetadataEditorOpen(true)}>
                  <Pencil size={14} aria-hidden="true" />
                  Manual
                </button>
              </div>
            </>
          )}
          {metadataError && <p className="form-error">{metadataError}</p>}
        </section>

        {/* Seção de arquivos: associar/remover ROM e importar box art local */}
        <section className="detail-edit-section detail-file-section">
          <div className="detail-edit-section-heading">
            <div>
              <span className="detail-edit-kicker">Arquivos</span>
              <h3>ROM e mídia local</h3>
            </div>
          </div>
          <div className="detail-file-action-grid">
            {/* Card para selecionar e associar o arquivo de ROM ao jogo */}
            <button type="button" className="detail-file-action-card" onClick={associateRom}>
              <FolderOpen size={18} aria-hidden="true" />
              <strong>Associar ROM</strong>
              <span>{draft.rom_path ? getFileName(draft.rom_path) : "Nenhuma ROM associada"}</span>
            </button>
            {/* Card para remover a ROM associada (desabilitado quando não há ROM) */}
            <button type="button" className="detail-file-action-card danger" onClick={removeRom} disabled={!draft.rom_path}>
              <Unlink size={18} aria-hidden="true" />
              <strong>Remover ROM</strong>
              <span>{draft.rom_path ? "Desvincular arquivo atual" : "Sem ROM para remover"}</span>
            </button>
            {/* Card para importar uma imagem de capa local (sobrescreve a capa atual) */}
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

      {/* Modal de busca de metadados na base LaunchBox */}
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

      {/* Modal de edição manual dos campos de metadados */}
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

/**
 * Modal arrastável para editar manualmente os campos de metadados do jogo.
 * Exibe os dados já vinculados (LaunchBox ID, imagens) e permite alterar
 * título, publisher, gênero, ano, rating e descrição.
 *
 * @param game    Dados atuais do jogo (draft do GameForm).
 * @param onClose Callback para fechar o modal sem salvar.
 * @param onSave  Callback assíncrono para persistir os dados editados.
 */
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

  // Estados dos campos do formulário de edição manual
  const [title, setTitle] = useState(game.title ?? "");
  const [publisher, setPublisher] = useState(game.publisher ?? "");
  const [genre, setGenre] = useState(game.genre ?? "");
  const [rating, setRating] = useState(game.rating ?? "");
  const [year, setYear] = useState(game.year?.toString() ?? "");
  const [notes, setNotes] = useState(game.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  /**
   * Monta o payload de atualização normalizando valores opcionais
   * e chama onSave. Em caso de erro, exibe a mensagem sem fechar o modal.
   */
  async function save(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({
        // Preserva o título original se o campo for deixado vazio
        title: title.trim() || game.title,
        publisher: normalizeOptionalText(publisher),
        genre: normalizeOptionalText(genre),
        rating: normalizeOptionalText(rating),
        // Converte para número ou null se não informado
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
        className="management-modal detail-metadata-modal detail-metadata-editor-modal draggable-modal"
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

        {/* Grade de leitura: exibe os dados já vinculados (somente leitura) */}
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

        {/* Formulário de edição dos campos editáveis de metadados */}
        <form className="management-form detail-metadata-editor-form" onSubmit={save}>
          <div className="form-grid-two detail-edit-grid detail-metadata-editor-grid">
            <label className="detail-metadata-editor-title-field">Título<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label>Publisher<input value={publisher} onChange={(event) => setPublisher(event.target.value)} /></label>
            <label>Gênero<input value={genre} onChange={(event) => setGenre(event.target.value)} /></label>
            <label>Ano<input type="number" value={year} onChange={(event) => setYear(event.target.value)} /></label>
            <label>Rating<input value={rating} onChange={(event) => setRating(event.target.value)} /></label>
          </div>
          {/* Textarea de descrição (notas) do jogo */}
          <label>Descrição<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          {error && <p className="form-error">{error}</p>}
          <footer className="detail-metadata-modal-footer">
            <button type="button" className="text-button danger form-action-button" onClick={onClose} disabled={saving}>
              <X size={14} aria-hidden="true" />
              Fechar
            </button>
            <button type="submit" className="text-button active form-action-button" disabled={saving}>
              {/* Spinner durante o salvamento */}
              {saving ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
              {saving ? "Salvando" : "Salvar"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

/**
 * Modal arrastável de busca de metadados na base LaunchBox.
 * Exibe campo de busca, lista de sugestões e status de importação.
 *
 * @param query               Texto atual da busca.
 * @param suggestions         Lista de sugestões retornadas pela busca.
 * @param searching           true enquanto a busca está em andamento.
 * @param importingMetadataId ID da sugestão sendo importada (null = nenhuma).
 * @param importStatus        Mensagem de status da importação em andamento.
 * @param error               Mensagem de erro da busca ou importação.
 * @param onQueryChange       Callback para atualizar o texto da busca no estado pai.
 * @param onClose             Callback para fechar o modal.
 * @param onSearch            Callback para disparar a busca.
 * @param onSelect            Callback chamado com a sugestão selecionada para importar.
 */
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
        className="management-modal detail-metadata-modal draggable-modal"
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

        {/* Toolbar de busca: campo de texto + botão de buscar */}
        <div className="detail-metadata-modal-toolbar">
          <input
            autoFocus
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar título na base de metadados"
          />
          {/* Botão desabilitado enquanto busca ou importação estão em andamento */}
          <button type="button" className="text-button active" onClick={onSearch} disabled={searching || Boolean(importingMetadataId)}>
            {searching ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : <Search size={14} aria-hidden="true" />}
            Buscar
          </button>
        </div>

        {/* Área de resultados: status de importação e lista de sugestões */}
        <div className="detail-metadata-modal-results">
          {/* Status da importação em andamento (ex: "Importando Super Mario Bros...") */}
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
                  {/* Resumo gerado a partir de ano, publisher e gêneros da sugestão */}
                  <p>{buildSuggestionSummary(suggestion)}</p>
                </div>
                {/* Botão de importar — desabilitado durante qualquer importação ativa */}
                <button type="button" className="text-button active" onClick={() => onSelect(suggestion)} disabled={Boolean(importingMetadataId)}>
                  {importing ? <LoaderCircle size={14} className="spin" aria-hidden="true" /> : <Sparkles size={14} aria-hidden="true" />}
                  {importing ? "Importando" : "Importar"}
                </button>
              </article>
            );
          }) : (
            // Estado vazio: exibe mensagem diferente dependendo se está buscando ou não
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

/**
 * Verifica se o jogo possui ao menos um campo de metadados preenchido.
 * Usado para determinar o estado visual da seção de metadados no formulário.
 */
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

/**
 * Monta uma string de resumo para exibição no card de sugestão de metadados.
 * Concatena ano de lançamento, publisher e gêneros disponíveis separados por " / ".
 */
function buildSuggestionSummary(game: LaunchBoxGame): string {
  const parts = [game.release?.slice(0, 4), game.publisher, game.genres]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.join(" / ") || "Sem resumo adicional";
}

/**
 * Monta o array de itens do resumo de metadados exibido quando o jogo já tem dados.
 * Cada item contém rótulo, valor atual e fallback para quando o valor está vazio.
 */
function buildMetadataSummary(game: Game): Array<{ label: string; value: string; fallback: string }> {
  return [
    { label: "Publisher", value: game.publisher?.trim() ?? "", fallback: "Não informado" },
    { label: "Gênero", value: game.genre?.trim() ?? "", fallback: "Não informado" },
    { label: "Rating", value: game.rating?.trim() ?? "", fallback: "Não informado" },
    { label: "Metadata ID", value: game.launchbox_id?.trim() ?? "", fallback: "Não vinculado" }
  ];
}

/**
 * Converte string de texto opcional para null quando vazia após trim.
 * Usado para normalizar campos opcionais antes de enviar para o IPC.
 */
function normalizeOptionalText(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}

/**
 * Extrai o nome do arquivo de um caminho completo (parte após o último separador).
 * Retorna o caminho original se não houver separadores.
 */
function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}
