import { useEffect, useMemo, useState } from "react";
import { Platform, RomFolderImportJob, RomFolderScanResult } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import "./RomFolderImporter.css";

type Step = "summary" | "configure" | "review" | "started";
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

export function RomFolderImporter() {
  const open = useGameStockStore((state) => state.romFolderImporterOpen);
  const setOpen = useGameStockStore((state) => state.setRomFolderImporterOpen);
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const setSelectedGameId = useGameStockStore((state) => state.setSelectedGameId);
  const platforms = useGameStockStore((state) => state.platforms);
  const [folderEntries, setFolderEntries] = useState<FolderEntry[]>([]);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [draftFolderPath, setDraftFolderPath] = useState("");
  const [platformId, setPlatformId] = useState<number | "">("");
  const [scan, setScan] = useState<RomFolderScanResult | null>(null);
  const [job, setJob] = useState<RomFolderImportJob | null>(null);
  const [step, setStep] = useState<Step>("summary");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPlatform = useMemo(
    () => platforms.find((platform) => platform.id === platformId) ?? null,
    [platformId, platforms]
  );

  useEffect(() => {
    if (!open) return;
    setStep("summary");
    setScan(null);
    setJob(null);
    setError(null);
    setBusy(false);
    setDraftFolderPath("");
    setFolderEntries(loadSavedFolderEntries(platforms));
    setPlatformId((current) => current || loadSavedPlatformId());
  }, [open, platforms]);

  if (!open) return null;

  async function chooseFolder(): Promise<void> {
    const selected = await window.gameStockAPI.dialogs.openRomFolder();
    if (selected) setDraftFolderPath(selected);
  }

  async function scanFolder(): Promise<void> {
    if (!draftFolderPath || !platformId) return;
    setBusy(true);
    setError(null);
    try {
      const nextScan = await window.gameStockAPI.romFolderImport.scan({ folderPaths: [draftFolderPath], platformId });
      const platform = platforms.find((item) => item.id === platformId);
      const nextEntries = upsertFolderEntry(folderEntries, {
        folderPath: draftFolderPath,
        platformId,
        platformName: platform?.name ?? nextScan.platformName,
        indexedCount: nextScan.candidates.length
      });
      setFolderEntries(nextEntries);
      saveFolderEntries(nextEntries);
      saveSources([{ path: draftFolderPath, type: "folder" }]);
      savePlatformId(platformId);
      setScan(nextScan);
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
      const nextJob = await window.gameStockAPI.romFolderImport.import({ folderPaths: scan.folderPaths, romFilePaths: scan.romFilePaths, platformId });
      setJob(nextJob);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("review");
    } finally {
      setBusy(false);
    }
  }

  function close(): void {
    if (busy) return;
    setOpen(false);
  }

  function openAddFolderForm(): void {
    setError(null);
    setDraftFolderPath("");
    setStep("configure");
  }

  async function deleteSelectedFolder(): Promise<void> {
    if (!selectedFolderPath) return;
    const entry = folderEntries.find((item) => item.folderPath === selectedFolderPath);
    setBusy(true);
    setError(null);
    try {
      await window.gameStockAPI.romFolderImport.deleteFolderRecords({ folderPath: selectedFolderPath, platformId: entry?.platformId });
      const nextEntries = folderEntries.filter((entry) => entry.folderPath !== selectedFolderPath);
      setFolderEntries(nextEntries);
      saveFolderEntries(nextEntries);
      setSelectedFolderPath(null);
      setSelectedGameId(null);
      reloadGames();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function continueSelectedDownload(): Promise<void> {
    const entry = folderEntries.find((item) => item.folderPath === selectedFolderPath);
    if (!entry) return;
    setBusy(true);
    setError(null);
    try {
      const nextJob = await window.gameStockAPI.romFolderImport.import({ folderPaths: [entry.folderPath], platformId: entry.platformId });
      setJob(nextJob);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="rom-folder-modal">
        <header>
          <div>
            <p className="eyebrow">Importacao em lote</p>
            <h2>Importar pasta de ROMs</h2>
          </div>
          <button type="button" className="icon-button" onClick={close} disabled={busy}>x</button>
        </header>

        {error ? <div className="import-alert">{error}</div> : null}

        {step === "summary" ? (
          <SummaryStep
            entries={folderEntries}
            selectedFolderPath={selectedFolderPath}
            busy={busy}
            onSelectFolder={setSelectedFolderPath}
            onAddFolder={openAddFolderForm}
            onDeleteFolder={deleteSelectedFolder}
            onContinueDownload={continueSelectedDownload}
          />
        ) : null}

        {step === "configure" ? (
          <ConfigureStep
            folderPath={draftFolderPath}
            platforms={platforms}
            platformId={platformId}
            selectedPlatform={selectedPlatform}
            busy={busy}
            onChooseFolder={chooseFolder}
            onSetFolderPath={setDraftFolderPath}
            onSetPlatformId={(value) => {
              setPlatformId(value);
              savePlatformId(value);
            }}
            onBack={() => setStep("summary")}
            onNext={scanFolder}
          />
        ) : null}

        {step === "review" && scan ? (
          <ReviewStep scan={scan} busy={busy} onBack={() => setStep("configure")} onStart={startImport} />
        ) : null}

        {step === "started" && job ? <StartedStep job={job} onClose={close} onAgain={openAddFolderForm} /> : null}
      </section>
    </div>
  );
}

function SummaryStep({
  entries,
  selectedFolderPath,
  busy,
  onSelectFolder,
  onAddFolder,
  onDeleteFolder,
  onContinueDownload
}: {
  entries: FolderEntry[];
  selectedFolderPath: string | null;
  busy: boolean;
  onSelectFolder(folderPath: string): void;
  onAddFolder(): void;
  onDeleteFolder(): void;
  onContinueDownload(): void;
}) {
  return (
    <div className="rom-folder-step">
      <section className="import-assistant-panel summary">
        <h3>Pastas em uso</h3>
        <p>Pastas ja configuradas para importacao, com a plataforma associada e o total de jogos indexados.</p>

        <div className="folder-table" role="table" aria-label="Pastas em uso">
          <div className="folder-table-row header" role="row">
            <span role="columnheader">Pasta em uso</span>
            <span role="columnheader">Plataforma</span>
            <span role="columnheader">Jogos indexados</span>
          </div>
          {entries.length ? entries.map((entry) => (
            <button
              type="button"
              key={entry.folderPath}
              className={`folder-table-row ${entry.folderPath === selectedFolderPath ? "selected" : ""}`}
              onClick={() => onSelectFolder(entry.folderPath)}
              role="row"
            >
              <span role="cell">{entry.folderPath}</span>
              <span role="cell">{entry.platformName}</span>
              <span role="cell">{entry.indexedCount}</span>
            </button>
          )) : <div className="folder-table-empty">Nenhuma pasta configurada.</div>}
        </div>
      </section>

      <footer>
        <div className="footer-actions">
          <button type="button" className="text-button active" onClick={onAddFolder} disabled={busy}>Adicionar Pasta</button>
          <button type="button" className="text-button" onClick={onDeleteFolder} disabled={busy || !selectedFolderPath}>Deletar Pasta</button>
          <button type="button" className="text-button active" onClick={onContinueDownload} disabled={busy || !selectedFolderPath}>Continuar downloads</button>
        </div>
      </footer>
    </div>
  );
}

function ConfigureStep({
  folderPath,
  platforms,
  platformId,
  selectedPlatform,
  busy,
  onChooseFolder,
  onSetFolderPath,
  onSetPlatformId,
  onBack,
  onNext
}: {
  folderPath: string;
  platforms: Platform[];
  platformId: number | "";
  selectedPlatform: Platform | null;
  busy: boolean;
  onChooseFolder(): void;
  onSetFolderPath(value: string): void;
  onSetPlatformId(value: number | ""): void;
  onBack(): void;
  onNext(): void;
}) {
  return (
    <div className="rom-folder-step">
      <section className="import-assistant-panel compact">
        <h3>Adicionar pasta</h3>
        <p>Selecione a pasta onde estao os ROMs e escolha a plataforma correspondente.</p>

        <label className="assistant-platform large">
          <span>Pasta</span>
          <div className="folder-field">
            <input value={folderPath} onChange={(event) => onSetFolderPath(event.target.value)} placeholder="Selecione a pasta dos ROMs" />
            <button type="button" onClick={onChooseFolder} disabled={busy}>Selecionar</button>
          </div>
        </label>

        <label className="assistant-platform large">
          <span>Plataforma</span>
          <select value={platformId} onChange={(event) => onSetPlatformId(event.target.value ? Number(event.target.value) : "")}> 
            <option value="">Selecione uma plataforma</option>
            {platforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
          </select>
        </label>
      </section>

      <footer>
        <button type="button" className="text-button" onClick={onBack} disabled={busy}>Voltar</button>
        <span className="import-hint">{selectedPlatform ? `Tudo sera importado como ${selectedPlatform.name}.` : "Selecione a plataforma antes de continuar."}</span>
        <button type="button" className="text-button active" onClick={onNext} disabled={busy || !folderPath || !platformId}>Proximo</button>
      </footer>
    </div>
  );
}

function ReviewStep({ scan, busy, onBack, onStart }: { scan: RomFolderScanResult; busy: boolean; onBack(): void; onStart(): void }) {
  return (
    <div className="rom-folder-step">
      <div className="review-summary">
        <strong>{scan.candidates.length} ROMs encontradas</strong>
        <span>Plataforma: {scan.platformName}</span>
        <span>{scan.folderPaths.length} pasta(s) | Ignorados: {scan.ignored}</span>
      </div>
      {!scan.candidates.length ? <div className="empty-state">Nenhuma ROM suportada encontrada nessa pasta.</div> : null}
      <div className="candidate-list">
        {scan.candidates.map((candidate) => (
          <div key={candidate.romPath} className="candidate-row">
            <strong>{candidate.titleCandidate}</strong>
            <span>{candidate.filename} - {candidate.folderPath}</span>
          </div>
        ))}
      </div>
      <footer>
        <button type="button" className="text-button" onClick={onBack} disabled={busy}>Voltar</button>
        <button type="button" className="text-button active" onClick={onStart} disabled={busy || !scan.candidates.length}>Iniciar em background</button>
      </footer>
    </div>
  );
}

function StartedStep({ job, onClose, onAgain }: { job: RomFolderImportJob; onClose(): void; onAgain(): void }) {
  return (
    <div className="rom-folder-step progress-step">
      <strong>Importacao rodando em background</strong>
      <p>Job {job.jobId} iniciado para {job.folderPaths.length} pasta(s). Voce pode fechar esta janela e acompanhar pela area de notificacoes.</p>
      <footer>
        <button type="button" className="text-button" onClick={onAgain}>Adicionar outra pasta</button>
        <button type="button" className="text-button active" onClick={onClose}>Fechar</button>
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

function saveSources(sources: ImportSource[]): void {
  window.localStorage.setItem(SOURCE_HISTORY_KEY, JSON.stringify(sources));
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
