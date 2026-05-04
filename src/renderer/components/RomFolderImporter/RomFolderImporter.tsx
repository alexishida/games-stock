import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { AlertTriangle, ArrowLeft, ChevronDown, CircleX, FolderCheck, FolderOpen, FolderPlus, Save, Trash2, X } from "lucide-react";
import { Platform, RomFolderScanResult } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import "./RomFolderImporter.css";
import { SectionIntro } from "../SectionIntro/SectionIntro";

type ImportSource = { path: string; type: "folder" | "file" };
interface FolderEntry {
  folderPath: string;
  platformId: number;
  platformName: string;
  indexedCount: number;
}

const SOURCE_HISTORY_KEY = "gamestock.romImport.sources";
const PLATFORM_HISTORY_KEY = "gamestock.romImport.platformId";
const FOLDER_ENTRIES_KEY = "gamestock.romImport.folderEntries";

export function RomFolderImporter({ onImportStarted }: { onImportStarted(): void }) {
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const reloadPlatforms = useGameStockStore((state) => state.reloadPlatforms);
  const selectedPlatformId = useGameStockStore((state) => state.selectedPlatformId);
  const setSelectedGameId = useGameStockStore((state) => state.setSelectedGameId);
  const setSelectedPlatformId = useGameStockStore((state) => state.setSelectedPlatformId);
  const platforms = useGameStockStore((state) => state.platforms);
  const [folderEntries, setFolderEntries] = useState<FolderEntry[]>(() => loadSavedFolderEntries(platforms));
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let canceled = false;
    const entries = folderEntries.length ? folderEntries : loadSavedFolderEntries(platforms);
    if (!entries.length) return undefined;

    void refreshFolderCounts(entries)
      .then((nextEntries) => {
        if (canceled) return;
        setFolderEntries(nextEntries);
        saveFolderEntries(nextEntries);
      })
      .catch(() => undefined);

    return () => {
      canceled = true;
    };
  }, [platforms]);

  function handleFolderAdded(entry: FolderEntry): void {
    const nextEntries = upsertFolderEntry(folderEntries, entry);
    setFolderEntries(nextEntries);
    saveFolderEntries(nextEntries);
    setAddFolderOpen(false);
    onImportStarted();
  }

  function requestDeleteFolder(folderPath: string): void {
    setSelectedFolderPath(folderPath);
    setConfirmDelete(true);
  }

  async function confirmDeleteSelectedFolder(): Promise<void> {
    if (!selectedFolderPath) return;
    const entry = folderEntries.find((item) => item.folderPath === selectedFolderPath);
    setConfirmDelete(false);
    setBusy(true);
    setError(null);
    try {
      await window.gameStockAPI.romFolderImport.deleteFolderRecords({ folderPath: selectedFolderPath, platformId: entry?.platformId });
      const nextEntries = folderEntries.filter((e) => e.folderPath !== selectedFolderPath);
      setFolderEntries(nextEntries);
      saveFolderEntries(nextEntries);
      setSelectedFolderPath(null);
      setSelectedGameId(null);
      if (entry?.platformId === selectedPlatformId) setSelectedPlatformId(null);
      reloadGames();
      reloadPlatforms();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rom-folder-panel">
      {error ? <div className="import-alert">{error}</div> : null}

      <SummaryStep
        entries={folderEntries}
        selectedFolderPath={selectedFolderPath}
        busy={busy}
        onSelectFolder={setSelectedFolderPath}
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
          <div className="confirm-dialog">
            <div className="confirm-dialog-title">
              <AlertTriangle aria-hidden="true" size={22} />
              <p>Remover pasta do GameStock?</p>
            </div>
            <p className="confirm-message">Esta acao remove apenas os registros desta pasta no GameStock. As ROMs originais continuam na pasta, e as imagens baixadas ficam guardadas como cache.</p>
            <p className="confirm-path">{selectedFolderPath}</p>
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
  onAdded(entry: FolderEntry): void;
}) {
  const setRomImportJob = useGameStockStore((state) => state.setLastRomImportJob);
  const [step, setStep] = useState<"configure" | "review">("configure");
  const [folderPath, setFolderPath] = useState("");
  const [platformId, setPlatformId] = useState<number | "">(loadSavedPlatformId);
  const [scan, setScan] = useState<RomFolderScanResult | null>(null);
  const [reviewView, setReviewView] = useState<"candidates" | "ignored">("candidates");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platformPickerOpen, setPlatformPickerOpen] = useState(false);
  const [dialogOffset, setDialogOffset] = useState({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const platformPickerRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const interactiveSelector = "button, input, select, textarea, label, option, [role='button'], a";
  const sortedPlatforms = [...platforms].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  const selectedPlatform = typeof platformId === "number" ? sortedPlatforms.find((platform) => platform.id === platformId) ?? null : null;

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

  function startDialogDrag(event: ReactPointerEvent<HTMLDivElement>): void {
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

  function dragDialog(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDialogOffset(clampDialogOffset(
      drag.originX + event.clientX - drag.startX,
      drag.originY + event.clientY - drag.startY
    ));
  }

  function stopDialogDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    if (dragState.current?.pointerId !== event.pointerId) return;
    dragState.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  async function chooseFolder(): Promise<void> {
    const selected = await window.gameStockAPI.dialogs.openRomFolder();
    if (selected) setFolderPath(selected);
  }

  function choosePlatform(nextPlatformId: number | ""): void {
    setPlatformId(nextPlatformId);
    setPlatformPickerOpen(false);
  }

  async function scanFolder(): Promise<void> {
    if (!folderPath || !platformId) return;
    setBusy(true);
    setError(null);
    try {
      const nextScan = await window.gameStockAPI.romFolderImport.scan({ folderPaths: [folderPath], platformId });
      setScan(nextScan);
      setReviewView("candidates");
      savePlatformId(platformId);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function startImport(): Promise<void> {
    if (!scan || !platformId || !scan.candidates.length) return;
    setBusy(true);
    setError(null);
    try {
      const job = await window.gameStockAPI.romFolderImport.import({ folderPaths: scan.folderPaths, romFilePaths: scan.romFilePaths, platformId });
      setRomImportJob(job);
      const platform = platforms.find((p) => p.id === platformId);
      onAdded({
        folderPath: scan.folderPaths[0],
        platformId,
        platformName: platform?.name ?? scan.platformName,
        indexedCount: 0
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div
      ref={dialogRef}
      className={`add-folder-dialog ${step === "review" ? "review" : ""}`}
      style={{ "--dialog-x": `${dialogOffset.x}px`, "--dialog-y": `${dialogOffset.y}px` } as CSSProperties}
      onPointerDown={startDialogDrag}
      onPointerMove={dragDialog}
      onPointerUp={stopDialogDrag}
      onPointerCancel={stopDialogDrag}
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
          <p>Selecione a pasta onde estao os ROMs e escolha a plataforma correspondente.</p>

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
                <span>{selectedPlatform?.name ?? "Selecione uma plataforma"}</span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              {platformPickerOpen ? (
                <div className="platform-picker-menu" role="listbox" aria-label="Plataformas">
                  <button
                    type="button"
                    className={`platform-picker-option ${!selectedPlatform ? "selected" : ""}`}
                    onClick={() => choosePlatform("")}
                  >
                    Selecione uma plataforma
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
        </div>
      ) : null}

      {step === "review" && scan ? (
        <div className="add-folder-dialog-body">
          <div className="review-header">
            <p className="eyebrow">{scan.platformName}</p>
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
  selectedFolderPath,
  busy,
  onSelectFolder,
  onAddFolder,
  onDeleteFolder
}: {
  entries: FolderEntry[];
  selectedFolderPath: string | null;
  busy: boolean;
  onSelectFolder(folderPath: string): void;
  onAddFolder(): void;
  onDeleteFolder(folderPath: string): void;
}) {
  return (
    <div className="rom-folder-step">
      <section className="import-assistant-panel summary">
        <SectionIntro title="Pastas em uso" description="Pastas ja configuradas para importacao, com a plataforma associada e o total de jogos indexados." />
        <div className="folder-table" role="table" aria-label="Pastas em uso">
          <div className="folder-table-row header" role="row">
            <span role="columnheader">Pasta</span>
            <span role="columnheader">Plataforma</span>
            <span role="columnheader">Jogos</span>
            <span className="folder-table-action-header" role="columnheader" aria-label="Acao" />
          </div>
          {entries.length ? entries.map((entry) => (
            <div
              key={entry.folderPath}
              className={`folder-table-row ${entry.folderPath === selectedFolderPath ? "selected" : ""}`}
              onClick={() => onSelectFolder(entry.folderPath)}
              role="row"
            >
              <span role="cell">{entry.folderPath}</span>
              <span role="cell">{entry.platformName}</span>
              <span role="cell">{entry.indexedCount}</span>
              <div className="folder-table-action-cell" role="cell">
                <button
                  type="button"
                  className="folder-table-delete"
                  aria-label={`Remover pasta ${entry.folderPath} do GameStock`}
                  disabled={busy}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteFolder(entry.folderPath);
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

function loadSavedSources(): ImportSource[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SOURCE_HISTORY_KEY) ?? "[]") as ImportSource[];
    return parsed.filter((source) => source?.path && source.type === "folder");
  } catch {
    return [];
  }
}

function loadSavedPlatformId(): number | "" {
  const value = Number(window.localStorage.getItem(PLATFORM_HISTORY_KEY));
  return Number.isFinite(value) && value > 0 ? value : "";
}

function savePlatformId(platformId: number | ""): void {
  if (!platformId) window.localStorage.removeItem(PLATFORM_HISTORY_KEY);
  else window.localStorage.setItem(PLATFORM_HISTORY_KEY, String(platformId));
}

function loadSavedFolderEntries(platforms: Platform[]): FolderEntry[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FOLDER_ENTRIES_KEY) ?? "[]") as FolderEntry[];
    if (Array.isArray(parsed) && parsed.length) return parsed.filter((entry) => entry.folderPath && entry.platformId);
  } catch {
    // Fall through to migration from the previous simple history.
  }

  const sources = loadSavedSources();
  const platformId = loadSavedPlatformId();
  const platform = platforms.find((item) => item.id === platformId);
  return platformId
    ? sources.map((source) => ({ folderPath: source.path, platformId, platformName: platform?.name ?? "Plataforma", indexedCount: 0 }))
    : [];
}

function saveFolderEntries(entries: FolderEntry[]): void {
  window.localStorage.setItem(FOLDER_ENTRIES_KEY, JSON.stringify(entries));
}

function upsertFolderEntry(entries: FolderEntry[], nextEntry: FolderEntry): FolderEntry[] {
  return [...entries.filter((entry) => entry.folderPath !== nextEntry.folderPath), nextEntry];
}

async function refreshFolderCounts(entries: FolderEntry[]): Promise<FolderEntry[]> {
  const counts = await window.gameStockAPI.romFolderImport.countFolderRecords(
    entries.map((entry) => ({ folderPath: entry.folderPath, platformId: entry.platformId }))
  );
  return entries.map((entry, index) => ({
    ...entry,
    indexedCount: counts[index]?.count ?? entry.indexedCount
  }));
}
