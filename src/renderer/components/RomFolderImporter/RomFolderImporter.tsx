import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ChevronDown, CircleX, FolderCheck, FolderOpen, FolderPlus, Save, Trash2, X } from "lucide-react";
import { Platform, RomFolderScanResult } from "../../../shared/types";
import { useDraggableDialog } from "../../hooks/useDraggableDialog";
import { useGameStockStore } from "../../store";
import "./RomFolderImporter.css";
import { SectionIntro } from "../SectionIntro/SectionIntro";
interface FolderEntry {
  folderPath: string;
  platformId: number;
  platformName: string;
  indexedCount: number;
  totalCount?: number;
  includeSubfolders?: boolean;
}

type PlatformSelection = number | "" | "automatic";

const AUTO_PLATFORM_VALUE = "automatic";

export function RomFolderImporter({ onImportStarted }: { onImportStarted(): void }) {
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const reloadPlatforms = useGameStockStore((state) => state.reloadPlatforms);
  const selectedPlatformId = useGameStockStore((state) => state.selectedPlatformId);
  const setSelectedGameId = useGameStockStore((state) => state.setSelectedGameId);
  const setSelectedPlatformId = useGameStockStore((state) => state.setSelectedPlatformId);
  const platforms = useGameStockStore((state) => state.platforms);
  const folderEntries = useGameStockStore((state) => state.romFolderEntries as FolderEntry[]);
  const setFolderEntries = useGameStockStore((state) => state.setRomFolderEntries as (value: FolderEntry[] | ((current: FolderEntry[]) => FolderEntry[])) => void);
  const [selectedFolderKey, setSelectedFolderKey] = useState<string | null>(null);
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteDialogDraggable = useDraggableDialog<HTMLDivElement>();

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

  function handleFolderAdded(entries: FolderEntry[]): void {
    const nextEntries = upsertFolderEntries(folderEntries, entries);
    setFolderEntries(nextEntries);
    setAddFolderOpen(false);
    onImportStarted();
  }

  function requestDeleteFolder(entry: FolderEntry): void {
    setSelectedFolderKey(folderEntryKey(entry));
    setConfirmDelete(true);
  }

  async function confirmDeleteSelectedFolder(): Promise<void> {
    if (!selectedFolderKey) return;
    const entry = folderEntries.find((item) => folderEntryKey(item) === selectedFolderKey);
    if (!entry) return;
    setConfirmDelete(false);
    setBusy(true);
    setError(null);
    try {
      await window.gameStockAPI.romFolderImport.deleteFolderRecords({ folderPath: entry.folderPath, platformId: entry.platformId });
      const nextEntries = folderEntries.filter((item) => folderEntryKey(item) !== selectedFolderKey);
      setFolderEntries(nextEntries);
      setSelectedFolderKey(null);
      setSelectedGameId(null);
      if (entry.platformId === selectedPlatformId) setSelectedPlatformId(null);
      reloadGames();
      reloadPlatforms();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const selectedFolderEntry = selectedFolderKey
    ? folderEntries.find((item) => folderEntryKey(item) === selectedFolderKey) ?? null
    : null;

  return (
    <div className="rom-folder-panel">
      {error ? <div className="import-alert">{error}</div> : null}

      <SummaryStep
        entries={folderEntries}
        selectedFolderKey={selectedFolderKey}
        busy={busy}
        onSelectFolder={(entry) => setSelectedFolderKey(folderEntryKey(entry))}
        onAddFolder={() => setAddFolderOpen(true)}
        onDeleteFolder={requestDeleteFolder}
      />

      {addFolderOpen ? (
        <div className="panel-confirm-overlay draggable-overlay">
          <AddFolderPanel
            platforms={platforms}
            onCancel={() => setAddFolderOpen(false)}
            onAdded={handleFolderAdded}
          />
        </div>
      ) : null}

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
            <p className="confirm-message">Esta ação remove apenas os registros desta pasta no GameStock. As ROMs originais continuam na pasta, e as imagens baixadas ficam guardadas como cache.</p>
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

function AddFolderPanel({ platforms, onCancel, onAdded }: {
  platforms: Platform[];
  onCancel(): void;
  onAdded(entries: FolderEntry[]): void;
}) {
  const setRomImportJob = useGameStockStore((state) => state.setLastRomImportJob);
  const [step, setStep] = useState<"configure" | "review">("configure");
  const [folderPath, setFolderPath] = useState("");
  const [platformId, setPlatformId] = useState<PlatformSelection>(AUTO_PLATFORM_VALUE);
  const [includeSubfolders, setIncludeSubfolders] = useState(false);
  const [scan, setScan] = useState<RomFolderScanResult | null>(null);
  const [reviewView, setReviewView] = useState<"candidates" | "ignored">("candidates");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platformPickerOpen, setPlatformPickerOpen] = useState(false);
  const platformPickerRef = useRef<HTMLDivElement | null>(null);
  const draggable = useDraggableDialog<HTMLDivElement>();
  const sortedPlatforms = [...platforms].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  const selectedPlatform = typeof platformId === "number" ? sortedPlatforms.find((platform) => platform.id === platformId) ?? null : null;
  const selectedPlatformLabel = platformId === AUTO_PLATFORM_VALUE
    ? "Detecção automática"
    : selectedPlatform?.name ?? "Selecione uma plataforma";

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

  async function chooseFolder(): Promise<void> {
    const selected = await window.gameStockAPI.dialogs.openRomFolder();
    if (selected) setFolderPath(selected);
  }

  function choosePlatform(nextPlatformId: PlatformSelection): void {
    setPlatformId(nextPlatformId);
    setPlatformPickerOpen(false);
  }

  async function scanFolder(): Promise<void> {
    if (!folderPath || !platformId) return;
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
      setReviewView("candidates");
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

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
      setRomImportJob(job);
      onAdded(buildFolderEntriesFromScan(scan));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div
      ref={draggable.dialogRef}
      className={`add-folder-dialog draggable-modal ${step === "review" ? "review" : ""}`}
      style={draggable.style}
      onPointerDown={draggable.startDialogDrag}
      onPointerMove={draggable.dragDialog}
      onPointerUp={draggable.stopDialogDrag}
      onPointerCancel={draggable.stopDialogDrag}
    >
      <div className="add-folder-dialog-header">
        <strong>{step === "configure" ? "Adicionar pasta" : "Revisar ROMs"}</strong>
        <button type="button" className="icon-button modal-close-button" onClick={onCancel} disabled={busy} aria-label="Fechar">
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      {error ? <div className="import-alert">{error}</div> : null}

      {step === "configure" ? (
        <div className="add-folder-dialog-body">
          <p>Selecione a pasta onde estão os ROMs e escolha a plataforma correspondente.</p>

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
              {platformPickerOpen ? (
                <div className="platform-picker-menu" role="listbox" aria-label="Plataformas">
                  <button
                    type="button"
                    className={`platform-picker-option ${platformId === AUTO_PLATFORM_VALUE ? "selected" : ""}`}
                    onClick={() => choosePlatform(AUTO_PLATFORM_VALUE)}
                  >
                    Detecção automática
                  </button>
                  <button
                    type="button"
                    className={`platform-picker-option ${platformId === "" ? "selected" : ""}`}
                    onClick={() => choosePlatform("")}
                  >
                    Selecionar manualmente
                  </button>
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

      {step === "review" && scan ? (
        <div className="add-folder-dialog-body">
          <div className="review-header">
            <p className="eyebrow">{scan.platformName}</p>
            <p>{scan.detectionMode === "automatic"
              ? `${scan.detectedPlatforms.length} plataforma(s) detectada(s). Extensões genéricas ficam em ignorados.`
              : scan.includeSubfolders ? "Busca inclui subpastas desta pasta." : "Busca apenas arquivos da pasta selecionada."}</p>
            {scan.detectionMode === "automatic" && scan.detectedPlatforms.length ? (
              <div className="detected-platforms" aria-label="Plataformas detectadas">
                {scan.detectedPlatforms.map((platform) => (
                  <span key={platform.platformId}>{platform.platformName} ({platform.count})</span>
                ))}
              </div>
            ) : null}
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
                disabled={!scan.ignoredItems.length}
              >
                <strong>{scan.ignored}</strong>
                <span>Ignorados</span>
              </button>
            </div>
          </div>
          {reviewView === "candidates" && !scan.candidates.length ? <div className="folder-table-empty">Nenhuma ROM suportada encontrada nessa pasta.</div> : null}
          {reviewView === "ignored" && !scan.ignoredItems.length ? <div className="folder-table-empty">Nenhum arquivo ignorado nessa pasta.</div> : null}
          <div className="candidate-list">
            {reviewView === "candidates"
              ? scan.candidates.map((candidate) => (
                <div key={candidate.romPath} className="candidate-row">
                  <strong>{candidate.titleCandidate}</strong>
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

      <footer className="add-folder-dialog-footer">
        {step === "configure" ? (
          <>
            <button type="button" className="text-button danger import-action-button" onClick={onCancel} disabled={busy}>
              <CircleX aria-hidden="true" size={18} />
              Cancelar
            </button>
            <button type="button" className="text-button active import-action-button" onClick={scanFolder} disabled={busy || !folderPath || !platformId}>
              <FolderCheck aria-hidden="true" size={18} />
              Selecionar pasta
            </button>
          </>
        ) : (
          <>
            <button type="button" className="text-button import-action-button" onClick={() => setStep("configure")} disabled={busy}>
              <ArrowLeft aria-hidden="true" size={18} />
              Voltar
            </button>
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
        <div className="folder-table" role="table" aria-label="Pastas em uso">
          <div className="folder-table-row header" role="row">
            <span role="columnheader">Pasta</span>
            <span role="columnheader">Plataforma</span>
            <span role="columnheader">Jogos</span>
            <span className="folder-table-action-header" role="columnheader" aria-label="Ação" />
          </div>
          {entries.length ? entries.map((entry) => (
            <div
              key={folderEntryKey(entry)}
              className={`folder-table-row ${folderEntryKey(entry) === selectedFolderKey ? "selected" : ""}`}
              onClick={() => onSelectFolder(entry)}
              role="row"
            >
              <span role="cell" title={entry.folderPath}>{entry.folderPath}</span>
              <span role="cell" title={formatFolderPlatformLabel(entry)}>{formatFolderPlatformLabel(entry)}</span>
              <span role="cell">{entry.totalCount ?? entry.indexedCount}</span>
              <div className="folder-table-action-cell" role="cell">
                <button
                  type="button"
                  className="folder-table-delete"
                  aria-label={`Remover pasta ${entry.folderPath} do GameStock`}
                  disabled={busy}
                  onClick={(event) => {
                    event.stopPropagation();
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

function upsertFolderEntries(entries: FolderEntry[], nextEntries: FolderEntry[]): FolderEntry[] {
  const merged = new Map(entries.map((entry) => [folderEntryKey(entry), entry]));
  for (const entry of nextEntries) {
    merged.set(folderEntryKey(entry), entry);
  }
  return [...merged.values()];
}

function folderEntryKey(entry: FolderEntry): string {
  return `${entry.platformId}:${entry.folderPath}`;
}

function formatFolderPlatformLabel(entry: FolderEntry): string {
  return `${entry.platformName}${entry.includeSubfolders ? " + subpastas" : ""}`;
}

function buildFolderEntriesFromScan(scan: RomFolderScanResult): FolderEntry[] {
  const folderPath = scan.folderPaths[0] ?? scan.candidates[0]?.folderPath ?? "";
  return scan.detectedPlatforms.map((platform) => ({
    folderPath,
    platformId: platform.platformId,
    platformName: platform.platformName,
    indexedCount: 0,
    totalCount: platform.count,
    includeSubfolders: scan.includeSubfolders
  }));
}

async function refreshFolderCounts(entries: FolderEntry[], platforms: Platform[]): Promise<FolderEntry[]> {
  const existingByKey = new Map(entries.map((entry) => [folderEntryKey(entry), entry]));
  const folderPaths = Array.from(new Set(entries.map((entry) => entry.folderPath)));
  const knownPlatforms = platforms.length
    ? platforms
    : entries.map((entry) => ({ id: entry.platformId, name: entry.platformName } as Platform));
  const requests = folderPaths.flatMap((folderPath) =>
    knownPlatforms.map((platform) => ({ folderPath, platformId: platform.id }))
  );
  const counts = await window.gameStockAPI.romFolderImport.countFolderRecords(requests);
  const refreshed = new Map<string, FolderEntry>();

  for (let index = 0; index < requests.length; index += 1) {
    const request = requests[index];
    const platform = knownPlatforms.find((item) => item.id === request.platformId);
    const key = `${request.platformId}:${request.folderPath}`;
    const existing = existingByKey.get(key);
    const dbCount = counts[index]?.count ?? existing?.indexedCount ?? 0;
    if (!existing && dbCount <= 0) continue;

    refreshed.set(key, {
      folderPath: request.folderPath,
      platformId: request.platformId!,
      platformName: existing?.platformName ?? platform?.name ?? "Plataforma",
      indexedCount: dbCount,
      totalCount: existing?.totalCount ?? dbCount,
      includeSubfolders: existing?.includeSubfolders ?? entries.find((entry) => entry.folderPath === request.folderPath)?.includeSubfolders ?? false
    });
  }

  for (const entry of entries) {
    const key = folderEntryKey(entry);
    if (!refreshed.has(key)) refreshed.set(key, entry);
  }

  return Array.from(refreshed.values());
}
