import { useEffect, useRef, useState } from "react";
import { DatabaseZap, Gamepad2, Image, ImageOff, RefreshCw, X } from "lucide-react";
import { CoverSyncStats, RomFolderImportProgress } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { SectionIntro } from "../SectionIntro/SectionIntro";
import "./CoversSettings.css";

const EMPTY_STATS: CoverSyncStats = {
  total: 0,
  downloaded: 0,
  missing: 0,
  syncable: 0,
  metadataSyncable: 0,
  metadataDownloadedAt: null
};

export function CoversSettings() {
  const storeCoverStats = useGameStockStore((state) => state.coverStats);
  const setCoverStats = useGameStockStore((state) => state.setCoverStats);
  const stats = storeCoverStats ?? EMPTY_STATS;
  const [error, setError] = useState<string | null>(null);
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const romImportJob = useGameStockStore((state) => state.lastRomImportJob);
  const setLastRomImportJob = useGameStockStore((state) => state.setLastRomImportJob);
  const mediaSyncJobs = useGameStockStore((state) => state.mediaSyncJobs);
  const startMediaSyncJob = useGameStockStore((state) => state.startMediaSyncJob);
  const finishMediaSyncJob = useGameStockStore((state) => state.finishMediaSyncJob);
  const failMediaSyncJob = useGameStockStore((state) => state.failMediaSyncJob);
  const dismissMediaSyncJob = useGameStockStore((state) => state.dismissMediaSyncJob);
  const metadataStartupRunning = useGameStockStore((state) => state.metadataStartupRunning);
  const startupTrackedRef = useRef(false);
  const runningMediaJobs = mediaSyncJobs.filter((j) => j.status === "running");
  const syncing = runningMediaJobs.some((j) => j.jobId.startsWith("media-sync-"));
  const updatingMetadata = metadataStartupRunning || runningMediaJobs.some((j) => j.jobId.startsWith("metadata-"));
  const metadataJob = runningMediaJobs.find((j) => j.jobId.startsWith("metadata-")) ?? null;
  const mediaLibraryJobs = mediaSyncJobs.filter((j) => j.jobId.startsWith("media-sync-"));

  useEffect(() => {
    if (metadataStartupRunning) {
      startupTrackedRef.current = true;
      return;
    }
    if (startupTrackedRef.current) {
      startupTrackedRef.current = false;
      void loadStats();
    }
  }, [metadataStartupRunning]);

  useEffect(() => {
    void loadStats();
  }, []);

  async function loadStats() {
    setError(null);
    try {
      setCoverStats(await window.gameStockAPI.games.coverStats());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function syncCovers() {
    const jobId = `media-sync-${Date.now()}`;
    setError(null);
    startMediaSyncJob({
      jobId,
      title: "Sincronizando midia",
      subtitle: "Biblioteca",
      detail: "Preparando sincronizacao",
      progressLabel: "Sincronizando"
    });
    try {
      const result = await window.gameStockAPI.games.syncCovers();
      setCoverStats(result);
      reloadGames();
      finishMediaSyncJob(jobId, {
        title: `${result.metadataUpdated} metadado(s), ${result.downloadedNow} capa(s)`,
        detail: `${result.attempted} processados, ${result.skipped} pulados, ${result.failed} falha(s)`,
        progressLabel: "Concluido"
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      failMediaSyncJob(jobId, message);
    }
  }

  async function updateMetadata() {
    const jobId = `metadata-sync-${Date.now()}`;
    setError(null);
    startMediaSyncJob({
      jobId,
      title: "Atualizando base de dados",
      subtitle: "LaunchBox",
      detail: "Baixando Metadata.zip",
      progressLabel: "Iniciando"
    });
    try {
      await window.gameStockAPI.launchbox.ensureMetadata({ force: true });
      await loadStats();
      finishMediaSyncJob(jobId, {
        title: "Base de dados atualizada",
        detail: "Metadata.zip atualizado",
        progressLabel: "Concluido"
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      failMediaSyncJob(jobId, message);
    }
  }

  const romImportRunning = romImportJob?.status === "running";
  const romProgress = romImportJob?.progress ?? null;
  const romResult = romImportJob?.result;
  const romPercent = romImportJob
    ? romImportJob.status === "completed"
      ? 100
      : Math.min(100, Math.round(((romProgress?.current ?? 0) / (romProgress?.total || 1)) * 100))
    : 0;
  const romTitle = romResult
    ? `${romResult.summary.created} criados, ${romResult.summary.updated} atualizados`
    : romImportJob?.status === "failed"
      ? "Importacao de ROMs falhou"
      : romImportJob?.status === "interrupted"
        ? "Import interrompido"
        : "Importando ROMs";
  const romDetail = romResult
    ? `${romResult.summary.processed} processados, ${romResult.summary.unmatched} sem match, ${romResult.summary.failedDownloads} falha(s) de midia`
    : romProgress?.filename ?? romProgress?.message ?? "Aguardando progresso";
  const romStep = romImportJob
    ? romImportJob.status === "completed"
      ? "Concluido"
      : romImportJob.status === "failed"
        ? "Erro"
        : romImportJob.status === "interrupted"
          ? "Interrompido"
          : `${romProgress?.current ?? 0} de ${romProgress?.total ?? 0} - ${labelForRomStage(romProgress?.stage ?? "preparing_metadata")}`
    : "";

  async function resumeRomImport(): Promise<void> {
    if (!romImportJob) return;
    const { folderPaths, romFilePaths, platformId } = romImportJob;
    setLastRomImportJob(null);
    try {
      const newJob = await window.gameStockAPI.romFolderImport.import({ folderPaths, romFilePaths, platformId });
      setLastRomImportJob(newJob);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <section className="covers-settings">
      <div className="covers-sync-panel metadata-panel">
        <div className="covers-sync-header">
          <div>
            <strong>Atualizar dados</strong>
            <span>Ultimo download: {formatMetadataDate(stats.metadataDownloadedAt)}</span>
          </div>
          <button type="button" className="text-button active" onClick={updateMetadata} disabled={updatingMetadata || syncing}>
            <DatabaseZap aria-hidden="true" size={16} className={updatingMetadata ? "spin" : ""} />
            {updatingMetadata ? "Atualizando" : "Atualizar"}
          </button>
        </div>
        {updatingMetadata && (
          <>
            <div className={`covers-progress-track${metadataJob?.indeterminate ? " covers-progress-indeterminate" : ""}`} aria-label="Progresso do Metadata.zip">
              <span style={{ width: `${metadataJob?.percent ?? 100}%` }} />
            </div>
            <p className="covers-progress-text">{metadataJob?.detail ?? "Baixando Metadata.zip"}</p>
          </>
        )}
      </div>

      <div className="covers-media-intro">
        <SectionIntro title="Midia da biblioteca" description="Situacao das capas principais e metadados baixados para os jogos da biblioteca." />
      </div>

      <div className="covers-status">
        <div className="cover-stat">
          <Image aria-hidden="true" size={18} />
          <span>Covers</span>
          <strong>{stats.downloaded}</strong>
        </div>
        <div className="cover-stat warning">
          <ImageOff aria-hidden="true" size={18} />
          <span>Sem Covers</span>
          <strong>{stats.missing}</strong>
        </div>
        <div className="cover-stat">
          <Gamepad2 aria-hidden="true" size={18} />
          <span>Jogos</span>
          <strong>{stats.total}</strong>
        </div>
      </div>

      <div className={"covers-sync-panel" + (!syncing ? " covers-sync-panel-idle" : "")}>
        <div className="covers-sync-header">
          <div>
            <strong>Sincronizacao de midia</strong>
          </div>
          <button type="button" className="text-button active" onClick={syncCovers} disabled={syncing || updatingMetadata || romImportRunning || (stats.syncable === 0 && stats.metadataSyncable === 0)}>
            <RefreshCw aria-hidden="true" size={16} className={syncing ? "spin" : ""} />
            {syncing ? "Sincronizando" : "Sincronizar"}
          </button>
        </div>

        {mediaLibraryJobs.map((job) => (
          <div key={job.jobId} className={`covers-rom-sync-card covers-rom-sync-card--${job.status}`}>
            <div className="covers-rom-sync-card-header">
              <div>
                <strong>{job.title}</strong>
                <span>{job.subtitle}</span>
              </div>
              <div className="covers-rom-sync-card-meta">
                <small>{job.progressLabel}</small>
                {job.status !== "running" && (
                  <button type="button" className="covers-job-dismiss" onClick={() => dismissMediaSyncJob(job.jobId)} aria-label="Fechar">
                    <X aria-hidden="true" size={12} />
                  </button>
                )}
              </div>
            </div>
            <p>{job.detail}</p>
            <div className={`covers-progress-track${job.indeterminate ? " covers-progress-indeterminate" : ""}`} aria-label="Progresso de covers">
              <span style={{ width: `${job.percent}%` }} />
            </div>
            {job.status === "interrupted" && (
              <div className="covers-job-resume-row">
                <button type="button" className="text-button active" onClick={() => { dismissMediaSyncJob(job.jobId); void syncCovers(); }}>
                  <RefreshCw aria-hidden="true" size={14} />
                  Continuar
                </button>
              </div>
            )}
          </div>
        ))}

        {romImportJob && (
          <div className={`covers-rom-sync-card covers-rom-sync-card--${romImportJob.status}`}>
            <div className="covers-rom-sync-card-header">
              <div>
                <strong>{romTitle}</strong>
                <span>{romImportJob.platformName}</span>
              </div>
              <div className="covers-rom-sync-card-meta">
                <small>{romStep}</small>
                {romImportJob.status !== "running" && (
                  <button type="button" className="covers-job-dismiss" onClick={() => setLastRomImportJob(null)} aria-label="Fechar">
                    <X aria-hidden="true" size={12} />
                  </button>
                )}
              </div>
            </div>
            <p>{romDetail}</p>
            {romProgress?.imageFilename ? <p>{romProgress.imageFilename}</p> : null}
            <div className="covers-progress-track" aria-label="Progresso da importacao de ROMs">
              <span style={{ width: `${romPercent}%` }} />
            </div>
            {romImportJob.status === "interrupted" && (
              <div className="covers-job-resume-row">
                <button type="button" className="text-button active" onClick={() => void resumeRomImport()}>
                  <RefreshCw aria-hidden="true" size={14} />
                  Continuar
                </button>
              </div>
            )}
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
    </section>
  );
}

function formatMetadataDate(value: string | null): string {
  if (!value) return "nunca baixado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function labelForRomStage(stage: RomFolderImportProgress["stage"]): string {
  return {
    preparing_metadata: "preparando dados",
    matching: "fazendo match",
    downloading: "baixando midia",
    skipped: "pulando",
    saving: "salvando",
    done: "concluido",
    error: "erro"
  }[stage];
}
