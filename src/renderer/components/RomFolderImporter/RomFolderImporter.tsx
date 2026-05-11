/**
 * RomFolderImporter.tsx
 *
 * Painel de gerenciamento de pastas de ROMs na aba "Biblioteca" das configurações.
 *
 * Responsabilidades:
 *  - Exibir a lista de pastas já configuradas com plataforma e contagem de jogos (SummaryStep)
 *  - Adicionar novas pastas via diálogo de configuração e revisão de ROMs (AddFolderPanel)
 *  - Remover pastas com confirmação (dialog arrastável)
 *  - Disparar importação de ROMs via IPC e registrar o job no store
 *
 * O estado das entradas de pasta é persistido no store (Zustand + SQLite),
 * nunca em localStorage.
 */

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ChevronDown, CircleX, FolderCheck, FolderOpen, FolderPlus, Save, Trash2, X } from "lucide-react";
import { Platform, RomFolderScanResult } from "../../../shared/types";
import { useDraggableDialog } from "../../hooks/useDraggableDialog";
import { useGameStockStore } from "../../store";
import "./RomFolderImporter.css";
import { SectionIntro } from "../SectionIntro/SectionIntro";

/** Representa uma pasta de ROMs configurada, com plataforma e contagem de jogos */
interface FolderEntry {
  folderPath: string;      // Caminho absoluto da pasta no sistema de arquivos
  platformId: number;      // ID da plataforma associada
  platformName: string;    // Nome legível da plataforma
  indexedCount: number;    // Quantidade de jogos indexados no banco para esta pasta
  totalCount?: number;     // Total de ROMs detectadas (incluindo não-indexadas ainda)
  includeSubfolders?: boolean; // Se subpastas também são escaneadas
}

/**
 * Possíveis valores para a seleção de plataforma no painel de adição:
 *  - number: ID de plataforma específica
 *  - "": seleção manual (sem plataforma ainda escolhida)
 *  - "automatic": detecção automática por extensão de arquivo
 */
type PlatformSelection = number | "" | "automatic";

/** Valor sentinel para a opção de detecção automática de plataforma */
const AUTO_PLATFORM_VALUE = "automatic";

/**
 * Componente principal do importador de pastas de ROMs.
 * Gerencia o estado das entradas de pasta, o overlay de adição e o diálogo de confirmação de remoção.
 *
 * @param onImportStarted - Callback chamado quando uma importação é iniciada,
 *   usado pelo SettingsModal para navegar para a aba de mídia.
 */
export function RomFolderImporter({ onImportStarted }: { onImportStarted(): void }) {
  // Recarrega a lista de jogos após adicionar/remover pasta
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  // Recarrega a lista de plataformas (pode mudar contagens)
  const reloadPlatforms = useGameStockStore((state) => state.reloadPlatforms);
  // ID da plataforma atualmente selecionada na sidebar (para limpar ao remover)
  const selectedPlatformId = useGameStockStore((state) => state.selectedPlatformId);
  // Limpa o jogo selecionado ao remover a pasta que o continha
  const setSelectedGameId = useGameStockStore((state) => state.setSelectedGameId);
  // Atualiza a plataforma selecionada na sidebar
  const setSelectedPlatformId = useGameStockStore((state) => state.setSelectedPlatformId);
  // Lista de plataformas disponíveis para associação de pasta
  const platforms = useGameStockStore((state) => state.platforms);
  // Entradas de pasta persistidas no store (Zustand + SQLite)
  const folderEntries = useGameStockStore((state) => state.romFolderEntries as FolderEntry[]);
  // Atualiza as entradas de pasta no store
  const setFolderEntries = useGameStockStore((state) => state.setRomFolderEntries as (value: FolderEntry[] | ((current: FolderEntry[]) => FolderEntry[])) => void);

  // Chave da entrada de pasta selecionada para ações contextuais
  const [selectedFolderKey, setSelectedFolderKey] = useState<string | null>(null);
  // Controla a visibilidade do overlay de adição de pasta
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  // Indica que uma operação assíncrona (remoção) está em andamento
  const [busy, setBusy] = useState(false);
  // Mensagem de erro de remoção
  const [error, setError] = useState<string | null>(null);
  // Controla a visibilidade do diálogo de confirmação de remoção
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Hook para tornar o diálogo de confirmação de remoção arrastável
  const deleteDialogDraggable = useDraggableDialog<HTMLDivElement>();

  /**
   * Atualiza as contagens de jogos por pasta sempre que as entradas ou
   * plataformas mudarem. Usa flag `canceled` para ignorar respostas tardias.
   */
  useEffect(() => {
    let canceled = false;
    if (!folderEntries.length) return undefined;

    void refreshFolderCounts(folderEntries, platforms)
      .then((nextEntries) => {
        if (canceled) return;
        setFolderEntries(nextEntries);
      })
      .catch(() => undefined);

    return () => {
      canceled = true;
    };
  }, [folderEntries.length, platforms]);

  /**
   * Chamado pelo AddFolderPanel quando novas entradas são adicionadas.
   * Faz upsert na lista existente e fecha o overlay de adição.
   */
  function handleFolderAdded(entries: FolderEntry[]): void {
    const nextEntries = upsertFolderEntries(folderEntries, entries);
    setFolderEntries(nextEntries);
    setAddFolderOpen(false);
    onImportStarted(); // Navega para a aba de mídia no SettingsModal
  }

  /** Abre o diálogo de confirmação de remoção para a entrada selecionada */
  function requestDeleteFolder(entry: FolderEntry): void {
    setSelectedFolderKey(folderEntryKey(entry));
    setConfirmDelete(true);
  }

  /**
   * Executa a remoção da pasta selecionada via IPC.
   * Remove os registros do banco, atualiza o store e limpa seleções relacionadas.
   */
  async function confirmDeleteSelectedFolder(): Promise<void> {
    if (!selectedFolderKey) return;
    const entry = folderEntries.find((item) => folderEntryKey(item) === selectedFolderKey);
    if (!entry) return;
    setConfirmDelete(false);
    setBusy(true);
    setError(null);
    try {
      // Remove os registros de jogos e ROM da pasta no banco via IPC
      await window.gameStockAPI.romFolderImport.deleteFolderRecords({ folderPath: entry.folderPath, platformId: entry.platformId });
      // Atualiza a lista local removendo a entrada excluída
      const nextEntries = folderEntries.filter((item) => folderEntryKey(item) !== selectedFolderKey);
      setFolderEntries(nextEntries);
      setSelectedFolderKey(null);
      setSelectedGameId(null); // Limpa jogo selecionado (pode ter sido da pasta removida)
      // Limpa seleção de plataforma se era a da pasta removida
      if (entry.platformId === selectedPlatformId) setSelectedPlatformId(null);
      reloadGames();
      reloadPlatforms();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // Entrada de pasta correspondente à chave selecionada, para exibir no diálogo
  const selectedFolderEntry = selectedFolderKey
    ? folderEntries.find((item) => folderEntryKey(item) === selectedFolderKey) ?? null
    : null;

  return (
    <div className="rom-folder-panel">
      {/* Alerta de erro de remoção exibido no topo do painel */}
      {error ? <div className="import-alert">{error}</div> : null}

      {/* Lista de pastas configuradas com ações de seleção, adição e remoção */}
      <SummaryStep
        entries={folderEntries}
        selectedFolderKey={selectedFolderKey}
        busy={busy}
        onSelectFolder={(entry) => setSelectedFolderKey(folderEntryKey(entry))}
        onAddFolder={() => setAddFolderOpen(true)}
        onDeleteFolder={requestDeleteFolder}
      />

      {/* Overlay de adição de pasta: aparece sobre o painel principal */}
      {addFolderOpen ? (
        <div className="panel-confirm-overlay draggable-overlay">
          <AddFolderPanel
            platforms={platforms}
            onCancel={() => setAddFolderOpen(false)}
            onAdded={handleFolderAdded}
          />
        </div>
      ) : null}

      {/* Diálogo de confirmação de remoção (arrastável) */}
      {confirmDelete ? (
        <div className="panel-confirm-overlay delete-confirm-overlay">
          <div
            ref={deleteDialogDraggable.dialogRef}
            className="confirm-dialog draggable-modal"
            style={deleteDialogDraggable.style}
            onPointerDown={deleteDialogDraggable.startDialogDrag}
            onPointerMove={deleteDialogDraggable.dragDialog}
            onPointerUp={deleteDialogDraggable.stopDialogDrag}
            onPointerCancel={deleteDialogDraggable.stopDialogDrag}
          >
            <div className="confirm-dialog-title">
              <AlertTriangle aria-hidden="true" size={22} />
              <p>Remover pasta do GameStock?</p>
            </div>
            {/* Esclarecimento: a ação não apaga ROMs originais do disco */}
            <p className="confirm-message">Esta ação remove apenas os registros desta pasta no GameStock. As ROMs originais continuam na pasta, e as imagens baixadas ficam guardadas como cache.</p>
            {/* Exibe caminho e plataforma da pasta a ser removida */}
            <p className="confirm-path">{selectedFolderEntry ? `${selectedFolderEntry.platformName} - ${selectedFolderEntry.folderPath}` : ""}</p>
            <div className="confirm-actions">
              <button type="button" onClick={() => setConfirmDelete(false)}>
                <X aria-hidden="true" size={16} />
                Cancelar
              </button>
              <button type="button" className="danger" onClick={confirmDeleteSelectedFolder}>
                <Trash2 aria-hidden="true" size={16} />
                Remover do GameStock
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Painel modal de adição de nova pasta de ROMs.
 * Possui dois passos:
 *  1. "configure": seleção de pasta, plataforma e opção de subpastas
 *  2. "review": revisão das ROMs detectadas antes de iniciar a importação
 *
 * Ao confirmar no passo de revisão, dispara o job de importação via IPC
 * e registra o job no store para exibição no NotificationCenter.
 */
function AddFolderPanel({ platforms, onCancel, onAdded }: {
  platforms: Platform[];
  onCancel(): void;
  onAdded(entries: FolderEntry[]): void;
}) {
  // Registra o job de importação de ROMs no store para acompanhamento
  const setRomImportJob = useGameStockStore((state) => state.setLastRomImportJob);

  // Passo atual do assistente: "configure" ou "review"
  const [step, setStep] = useState<"configure" | "review">("configure");
  // Caminho da pasta selecionada pelo usuário
  const [folderPath, setFolderPath] = useState("");
  // Plataforma selecionada: id numérico, "" (manual sem escolha) ou "automatic"
  const [platformId, setPlatformId] = useState<PlatformSelection>(AUTO_PLATFORM_VALUE);
  // Se deve incluir subpastas no scan
  const [includeSubfolders, setIncludeSubfolders] = useState(false);
  // Resultado do scan de ROMs retornado pelo IPC
  const [scan, setScan] = useState<RomFolderScanResult | null>(null);
  // Controla qual lista é exibida no passo de revisão: candidatos ou ignorados
  const [reviewView, setReviewView] = useState<"candidates" | "ignored">("candidates");
  // Indica que uma operação assíncrona (scan ou import) está em andamento
  const [busy, setBusy] = useState(false);
  // Mensagem de erro de scan ou import
  const [error, setError] = useState<string | null>(null);
  // Controla abertura do dropdown de seleção de plataforma
  const [platformPickerOpen, setPlatformPickerOpen] = useState(false);
  // Ref para detectar cliques fora do dropdown de plataforma
  const platformPickerRef = useRef<HTMLDivElement | null>(null);

  // Hook para tornar o painel de adição arrastável
  const draggable = useDraggableDialog<HTMLDivElement>();

  // Plataformas ordenadas alfabeticamente para exibição no dropdown
  const sortedPlatforms = [...platforms].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  // Objeto da plataforma selecionada quando é um id numérico
  const selectedPlatform = typeof platformId === "number" ? sortedPlatforms.find((platform) => platform.id === platformId) ?? null : null;
  // Label exibido no botão do dropdown conforme a seleção atual
  const selectedPlatformLabel = platformId === AUTO_PLATFORM_VALUE
    ? "Detecção automática"
    : selectedPlatform?.name ?? "Selecione uma plataforma";

  /**
   * Registra listeners globais para fechar o dropdown de plataforma
   * ao clicar fora dele ou pressionar Escape.
   * Limpa os listeners ao fechar o dropdown.
   */
  useEffect(() => {
    if (!platformPickerOpen) return undefined;

    function handlePointerDown(event: PointerEvent): void {
      if (platformPickerRef.current?.contains(event.target as Node)) return;
      setPlatformPickerOpen(false);
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") setPlatformPickerOpen(false);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [platformPickerOpen]);

  /** Abre o diálogo nativo de seleção de pasta via IPC */
  async function chooseFolder(): Promise<void> {
    const selected = await window.gameStockAPI.dialogs.openRomFolder();
    if (selected) setFolderPath(selected);
  }

  /** Seleciona uma plataforma no dropdown e fecha-o */
  function choosePlatform(nextPlatformId: PlatformSelection): void {
    setPlatformId(nextPlatformId);
    setPlatformPickerOpen(false);
  }

  /**
   * Realiza o scan da pasta selecionada via IPC.
   * Determina o modo de detecção (automático ou manual) com base na seleção de plataforma.
   * Avança para o passo de revisão em caso de sucesso.
   */
  async function scanFolder(): Promise<void> {
    if (!folderPath || !platformId) return;
    // Usa detecção automática quando o usuário escolheu a opção sentinel
    const detectionMode = platformId === AUTO_PLATFORM_VALUE ? "automatic" : "manual";
    const selectedPlatformId = typeof platformId === "number" ? platformId : null;
    setBusy(true);
    setError(null);
    try {
      const nextScan = await window.gameStockAPI.romFolderImport.scan({
        folderPaths: [folderPath],
        platformId: selectedPlatformId,
        detectionMode,
        includeSubfolders
      });
      setScan(nextScan);
      setReviewView("candidates"); // Sempre inicia no tab de candidatos
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Inicia o job de importação de ROMs via IPC usando os dados do scan.
   * Registra o job no store e notifica o componente pai das entradas criadas.
   * Mantém o painel aberto em caso de erro para exibir a mensagem.
   */
  async function startImport(): Promise<void> {
    if (!scan || !scan.candidates.length) return;
    setBusy(true);
    setError(null);
    try {
      const job = await window.gameStockAPI.romFolderImport.import({
        folderPaths: scan.folderPaths,
        romFilePaths: scan.romFilePaths,
        platformId: scan.platformId,
        detectionMode: scan.detectionMode,
        includeSubfolders: scan.includeSubfolders
      });
      setRomImportJob(job); // Registra no store para exibição no NotificationCenter
      onAdded(buildFolderEntriesFromScan(scan)); // Notifica o pai para atualizar a lista
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div
      ref={draggable.dialogRef}
      // Classe "review" no passo de revisão aumenta a largura do painel
      className={`add-folder-dialog draggable-modal ${step === "review" ? "review" : ""}`}
      style={draggable.style}
      onPointerDown={draggable.startDialogDrag}
      onPointerMove={draggable.dragDialog}
      onPointerUp={draggable.stopDialogDrag}
      onPointerCancel={draggable.stopDialogDrag}
    >
      <div className="add-folder-dialog-header">
        {/* Título muda conforme o passo atual */}
        <strong>{step === "configure" ? "Adicionar pasta" : "Revisar ROMs"}</strong>
        <button type="button" className="icon-button modal-close-button" onClick={onCancel} disabled={busy} aria-label="Fechar">
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      {/* Alerta de erro de scan ou import */}
      {error ? <div className="import-alert">{error}</div> : null}

      {/* Passo 1: configuração de pasta e plataforma */}
      {step === "configure" ? (
        <div className="add-folder-dialog-body">
          <p>Selecione a pasta onde estão os ROMs e escolha a plataforma correspondente.</p>

          {/* Campo de seleção de pasta via diálogo nativo */}
          <label className="assistant-platform large">
            <span>Pasta</span>
            <div className="folder-field">
              <input value={folderPath} onChange={(e) => setFolderPath(e.target.value)} placeholder="Selecione a pasta dos ROMs" />
              <button type="button" onClick={chooseFolder} disabled={busy}>
                <FolderOpen aria-hidden="true" size={16} />
                Selecionar
              </button>
            </div>
          </label>

          {/* Dropdown customizado de seleção de plataforma */}
          <label className="assistant-platform large">
            <span>Plataforma</span>
            <div ref={platformPickerRef} className={`platform-picker ${platformPickerOpen ? "open" : ""}`}>
              <button
                type="button"
                className="platform-picker-trigger"
                aria-haspopup="listbox"
                aria-expanded={platformPickerOpen}
                aria-label="Selecionar plataforma"
                onClick={() => setPlatformPickerOpen((current) => !current)}
                disabled={busy}
              >
                <span>{selectedPlatformLabel}</span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              {/* Menu do dropdown: opções especiais + lista de plataformas */}
              {platformPickerOpen ? (
                <div className="platform-picker-menu" role="listbox" aria-label="Plataformas">
                  {/* Opção de detecção automática por extensão */}
                  <button
                    type="button"
                    className={`platform-picker-option ${platformId === AUTO_PLATFORM_VALUE ? "selected" : ""}`}
                    onClick={() => choosePlatform(AUTO_PLATFORM_VALUE)}
                  >
                    Detecção automática
                  </button>
                  {/* Opção para selecionar plataforma manualmente (sem pré-seleção) */}
                  <button
                    type="button"
                    className={`platform-picker-option ${platformId === "" ? "selected" : ""}`}
                    onClick={() => choosePlatform("")}
                  >
                    Selecionar manualmente
                  </button>
                  {/* Lista de plataformas cadastradas */}
                  {sortedPlatforms.map((platform) => (
                    <button
                      key={platform.id}
                      type="button"
                      className={`platform-picker-option ${platform.id === platformId ? "selected" : ""}`}
                      onClick={() => choosePlatform(platform.id)}
                    >
                      {platform.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </label>

          {/* Checkbox para incluir ROMs em subpastas durante o scan */}
          <label className="folder-option-checkbox">
            <input
              type="checkbox"
              checked={includeSubfolders}
              onChange={(event) => setIncludeSubfolders(event.target.checked)}
              disabled={busy}
            />
            <span>Buscar ROMs em subpastas</span>
          </label>
        </div>
      ) : null}

      {/* Passo 2: revisão dos resultados do scan */}
      {step === "review" && scan ? (
        <div className="add-folder-dialog-body">
          <div className="review-header">
            {/* Nome da plataforma detectada ou selecionada */}
            <p className="eyebrow">{scan.platformName}</p>
            {/* Descrição do modo de detecção usado */}
            <p>{scan.detectionMode === "automatic"
              ? `${scan.detectedPlatforms.length} plataforma(s) detectada(s). Extensões genéricas ficam em ignorados.`
              : scan.includeSubfolders ? "Busca inclui subpastas desta pasta." : "Busca apenas arquivos da pasta selecionada."}</p>
            {/* Tags das plataformas detectadas automaticamente com contagem de ROMs */}
            {scan.detectionMode === "automatic" && scan.detectedPlatforms.length ? (
              <div className="detected-platforms" aria-label="Plataformas detectadas">
                {scan.detectedPlatforms.map((platform) => (
                  <span key={platform.platformId}>{platform.platformName} ({platform.count})</span>
                ))}
              </div>
            ) : null}
            {/* Botões de alternância entre "ROMs encontradas" e "Ignorados" */}
            <div className="review-metrics">
              <button
                type="button"
                className={`review-metric ${reviewView === "candidates" ? "selected" : ""}`}
                onClick={() => setReviewView("candidates")}
              >
                <strong>{scan.candidates.length}</strong>
                <span>ROMs encontradas</span>
              </button>
              <button
                type="button"
                className={`review-metric ${reviewView === "ignored" ? "selected" : ""}`}
                onClick={() => setReviewView("ignored")}
                disabled={!scan.ignoredItems.length} // Desabilitado se não há ignorados
              >
                <strong>{scan.ignored}</strong>
                <span>Ignorados</span>
              </button>
            </div>
          </div>

          {/* Mensagens de lista vazia para cada tab */}
          {reviewView === "candidates" && !scan.candidates.length ? <div className="folder-table-empty">Nenhuma ROM suportada encontrada nessa pasta.</div> : null}
          {reviewView === "ignored" && !scan.ignoredItems.length ? <div className="folder-table-empty">Nenhum arquivo ignorado nessa pasta.</div> : null}

          {/* Lista de candidatos ou ignorados conforme o tab ativo */}
          <div className="candidate-list">
            {reviewView === "candidates"
              ? scan.candidates.map((candidate) => (
                <div key={candidate.romPath} className="candidate-row">
                  <strong>{candidate.titleCandidate}</strong>
                  {/* Plataforma detectada exibida apenas no modo automático */}
                  {scan.detectionMode === "automatic" ? <span className="candidate-platform">{candidate.platformName}</span> : null}
                  <span className="candidate-filename">{candidate.filename}</span>
                  <span className="candidate-path">{candidate.folderPath}</span>
                </div>
              ))
              : scan.ignoredItems.map((item) => (
                <div key={item.romPath} className="candidate-row ignored">
                  <strong>{item.filename}</strong>
                  <span className="candidate-filename">{item.reason}</span>
                  <span className="candidate-path">{item.folderPath}</span>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {/* Rodapé com ações contextuais por passo */}
      <footer className="add-folder-dialog-footer">
        {step === "configure" ? (
          <>
            <button type="button" className="text-button danger import-action-button" onClick={onCancel} disabled={busy}>
              <CircleX aria-hidden="true" size={18} />
              Cancelar
            </button>
            {/* Botão de scan desabilitado quando pasta ou plataforma não estão selecionadas */}
            <button type="button" className="text-button active import-action-button" onClick={scanFolder} disabled={busy || !folderPath || !platformId}>
              <FolderCheck aria-hidden="true" size={18} />
              Selecionar pasta
            </button>
          </>
        ) : (
          <>
            {/* Volta para o passo de configuração sem perder os dados */}
            <button type="button" className="text-button import-action-button" onClick={() => setStep("configure")} disabled={busy}>
              <ArrowLeft aria-hidden="true" size={18} />
              Voltar
            </button>
            {/* Salvar desabilitado quando não há candidatos para importar */}
            <button type="button" className="text-button active import-action-button" onClick={startImport} disabled={busy || !scan?.candidates.length}>
              <Save aria-hidden="true" size={18} />
              Salvar
            </button>
          </>
        )}
      </footer>
    </div>
  );
}

/**
 * Passo de resumo: exibe a tabela de pastas já configuradas com ações de
 * seleção, adição de nova pasta e remoção de pasta existente.
 */
function SummaryStep({
  entries,
  selectedFolderKey,
  busy,
  onSelectFolder,
  onAddFolder,
  onDeleteFolder
}: {
  entries: FolderEntry[];
  selectedFolderKey: string | null;
  busy: boolean;
  onSelectFolder(entry: FolderEntry): void;
  onAddFolder(): void;
  onDeleteFolder(entry: FolderEntry): void;
}) {
  return (
    <div className="rom-folder-step">
      <section className="import-assistant-panel summary">
        <SectionIntro title="Pastas em uso" description="Pastas já configuradas para importação, com a plataforma associada e o total de jogos indexados." />

        {/* Tabela de pastas configuradas */}
        <div className="folder-table" role="table" aria-label="Pastas em uso">
          {/* Cabeçalho da tabela */}
          <div className="folder-table-row header" role="row">
            <span role="columnheader">Pasta</span>
            <span role="columnheader">Plataforma</span>
            <span role="columnheader">Jogos</span>
            <span className="folder-table-action-header" role="columnheader" aria-label="Ação" />
          </div>

          {/* Linhas de dados ou mensagem de lista vazia */}
          {entries.length ? entries.map((entry) => (
            <div
              key={folderEntryKey(entry)}
              // Destaca a linha selecionada
              className={`folder-table-row ${folderEntryKey(entry) === selectedFolderKey ? "selected" : ""}`}
              onClick={() => onSelectFolder(entry)}
              role="row"
            >
              <span role="cell" title={entry.folderPath}>{entry.folderPath}</span>
              <span role="cell" title={formatFolderPlatformLabel(entry)}>{formatFolderPlatformLabel(entry)}</span>
              {/* Exibe totalCount quando disponível (mais preciso que indexedCount) */}
              <span role="cell">{entry.totalCount ?? entry.indexedCount}</span>
              <div className="folder-table-action-cell" role="cell">
                <button
                  type="button"
                  className="folder-table-delete"
                  aria-label={`Remover pasta ${entry.folderPath} do GameStock`}
                  disabled={busy}
                  onClick={(event) => {
                    event.stopPropagation(); // Evita selecionar a linha ao clicar no botão
                    onDeleteFolder(entry);
                  }}
                >
                  <Trash2 aria-hidden="true" size={16} />
                </button>
              </div>
            </div>
          )) : <div className="folder-table-empty">Nenhuma pasta configurada.</div>}
        </div>
      </section>

      {/* Rodapé com botão de adição de nova pasta */}
      <footer>
        <div className="footer-actions">
          <div className="footer-actions-left">
            <button type="button" className="text-button active import-action-button" onClick={onAddFolder} disabled={busy}>
              <FolderPlus aria-hidden="true" size={18} />
              Adicionar Pasta
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Mescla entradas novas na lista existente usando a chave composta platformId:folderPath.
 * Entradas com a mesma chave são substituídas pelas novas (upsert).
 */
function upsertFolderEntries(entries: FolderEntry[], nextEntries: FolderEntry[]): FolderEntry[] {
  const merged = new Map(entries.map((entry) => [folderEntryKey(entry), entry]));
  for (const entry of nextEntries) {
    merged.set(folderEntryKey(entry), entry);
  }
  return [...merged.values()];
}

/**
 * Retorna a chave única de uma entrada de pasta.
 * Combina platformId e folderPath para garantir unicidade mesmo com
 * a mesma pasta associada a plataformas diferentes.
 */
function folderEntryKey(entry: FolderEntry): string {
  return `${entry.platformId}:${entry.folderPath}`;
}

/**
 * Formata o label de plataforma exibido na tabela de pastas.
 * Inclui sufixo "+ subpastas" quando a opção está ativa.
 */
function formatFolderPlatformLabel(entry: FolderEntry): string {
  return `${entry.platformName}${entry.includeSubfolders ? " + subpastas" : ""}`;
}

/**
 * Constrói as entradas de pasta a partir do resultado de um scan.
 * Cria uma entrada por plataforma detectada, usando a contagem de candidatos
 * como totalCount inicial (será atualizado pelo refreshFolderCounts).
 */
function buildFolderEntriesFromScan(scan: RomFolderScanResult): FolderEntry[] {
  // Usa o primeiro folderPath do scan ou o folderPath do primeiro candidato como fallback
  const folderPath = scan.folderPaths[0] ?? scan.candidates[0]?.folderPath ?? "";
  return scan.detectedPlatforms.map((platform) => ({
    folderPath,
    platformId: platform.platformId,
    platformName: platform.platformName,
    indexedCount: 0, // Ainda não indexado; será atualizado após o job concluir
    totalCount: platform.count,
    includeSubfolders: scan.includeSubfolders
  }));
}

/**
 * Atualiza as contagens de jogos indexados para cada entrada de pasta
 * consultando o banco via IPC. Mantém entradas existentes para pastas
 * sem jogos indexados que já existiam na lista.
 *
 * @param entries - Entradas de pasta atuais
 * @param platforms - Lista de plataformas conhecidas (usada como fallback)
 * @returns Lista de entradas com contagens atualizadas
 */
async function refreshFolderCounts(entries: FolderEntry[], platforms: Platform[]): Promise<FolderEntry[]> {
  const existingByKey = new Map(entries.map((entry) => [folderEntryKey(entry), entry]));
  // Deduplica folderPaths para minimizar requisições
  const folderPaths = Array.from(new Set(entries.map((entry) => entry.folderPath)));
  // Usa as plataformas do store ou extrai das entradas como fallback
  const knownPlatforms = platforms.length
    ? platforms
    : entries.map((entry) => ({ id: entry.platformId, name: entry.platformName } as Platform));

  // Gera uma requisição por combinação de pasta × plataforma
  const requests = folderPaths.flatMap((folderPath) =>
    knownPlatforms.map((platform) => ({ folderPath, platformId: platform.id }))
  );

  // Busca contagens em lote via IPC
  const counts = await window.gameStockAPI.romFolderImport.countFolderRecords(requests);
  const refreshed = new Map<string, FolderEntry>();

  for (let index = 0; index < requests.length; index += 1) {
    const request = requests[index];
    const platform = knownPlatforms.find((item) => item.id === request.platformId);
    const key = `${request.platformId}:${request.folderPath}`;
    const existing = existingByKey.get(key);
    const dbCount = counts[index]?.count ?? existing?.indexedCount ?? 0;

    // Ignora combinações pasta × plataforma que não existem na lista e têm 0 jogos
    if (!existing && dbCount <= 0) continue;

    refreshed.set(key, {
      folderPath: request.folderPath,
      platformId: request.platformId!,
      platformName: existing?.platformName ?? platform?.name ?? "Plataforma",
      indexedCount: dbCount,
      // Preserva totalCount da entrada existente se disponível
      totalCount: existing?.totalCount ?? dbCount,
      // Preserva a configuração de subpastas da entrada existente
      includeSubfolders: existing?.includeSubfolders ?? entries.find((entry) => entry.folderPath === request.folderPath)?.includeSubfolders ?? false
    });
  }

  // Garante que entradas existentes não presentes nas requisições sejam mantidas
  for (const entry of entries) {
    const key = folderEntryKey(entry);
    if (!refreshed.has(key)) refreshed.set(key, entry);
  }

  return Array.from(refreshed.values());
}
