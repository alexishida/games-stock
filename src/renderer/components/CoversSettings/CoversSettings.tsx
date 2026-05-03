import { useEffect, useMemo, useRef, useState } from "react";
import { DatabaseZap, Gamepad2, Image, ImageOff, RefreshCw } from "lucide-react";
import { CoverSyncStats, LaunchBoxProgress, RomFolderImportJob, RomFolderImportProgress } from "../../../shared/types";
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
const LAST_ROM_IMPORT_JOB_KEY = "gamestock.media.lastRomImportJob";
const LAST_MEDIA_SYNC_JOB_KEY = "gamestock.media.lastMediaSyncJob";

export function CoversSettings() {
  const [stats, setStats] = useState<CoverSyncStats>(EMPTY_STATS);
  const [syncProgress, setSyncProgress] = useState<LaunchBoxProgress | null>(null);
  const [metadataProgress, setMetadataProgress] = useState<LaunchBoxProgress | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [updatingMetadata, setUpdatingMetadata] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncingRef = useRef(false);
  const updatingMetadataRef = useRef(false);
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const romImportJob = useGameStockStore((state) => state.lastRomImportJob);
  const setRomImportJob = useGameStockStore((state) => state.setLastRomImportJob);
  const mediaSyncJob = useGameStockStore((state) => state.lastMediaSyncJob);
  const setMediaSyncJob = useGameStockStore((state) => state.setLastMediaSyncJob);

  useEffect(() => {
    void loadStats();
    return window.gameStockAPI.launchbox.onProgress((nextProgress) => {
      if (updatingMetadataRef.current) {
        setMetadataProgress(nextProgress);
        return;
      }
      if (syncingRef.current) {
        setSyncProgress(nextProgress);
        setMediaSyncJob((current) => current
          ? {
            ...current,
            detail: nextProgress.filename ?? current.detail,
            progressLabel: `${nextProgress.current} de ${nextProgress.total}`,
            percent: nextProgress.total ? Math.round((nextProgress.current / nextProgress.total) * 100) : current.percent
          }
          : current);
      }
    });
  }, []);

  useEffect(() => {
    void window.gameStockAPI.romFolderImport.jobs().then((jobs) => {
      const latestJob = jobs[0];
      setRomImportJob((current) => current ?? latestJob ?? loadSavedRomImportJob());
    });

    const removeCompleted = window.gameStockAPI.romFolderImport.onCompleted((result) => {
      if (!result.jobId) return;
      void loadStats();
    });

    return () => {
      removeCompleted();
    };
  }, []);

  const percent = useMemo(() => {
    if (!stats.total) return 0;
    return Math.round((stats.downloaded / stats.total) * 100);
  }, [stats.downloaded, stats.total]);

  async function loadStats() {
    setError(null);
    try {
      setStats(await window.gameStockAPI.games.coverStats());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function syncCovers() {
    const jobId = `media-sync-${Date.now()}`;
    const startedAt = new Date().toISOString();
    emitMediaJob("start", { jobId, title: "Sincronizacao de mídia" });
    syncingRef.current = true;
    setSyncing(true);
    setError(null);
    setSyncProgress(null);
    setMediaSyncJob({
      jobId,
      title: "Sincronizando mídia",
      subtitle: "Biblioteca",
      status: "running",
      detail: "Preparando sincronizacao",
      progressLabel: "Sincronizando",
      percent: 0,
      startedAt
    });
    try {
      const result = await window.gameStockAPI.games.syncCovers();
      setStats(result);
      reloadGames();
      const completedJob = {
        jobId,
        title: `${result.metadataUpdated} metadado(s), ${result.downloadedNow} capa(s)`,
        subtitle: "Biblioteca",
        status: "completed" as const,
        detail: `${result.attempted} processados, ${result.skipped} pulados, ${result.failed} falha(s)`,
        progressLabel: "Concluido",
        percent: 100,
        startedAt
      };
      setMediaSyncJob(completedJob);
      window.localStorage.setItem(LAST_MEDIA_SYNC_JOB_KEY, JSON.stringify(completedJob));
      emitMediaJob("finish", { jobId, status: "completed", title: `${result.metadataUpdated} metadado(s), ${result.downloadedNow} capa(s)` });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      const failedJob = {
        jobId,
        title: "Sincronizacao de mídia falhou",
        subtitle: "Biblioteca",
        status: "failed" as const,
        detail: message,
        progressLabel: "Erro",
        percent: 100,
        startedAt
      };
      setMediaSyncJob(failedJob);
      window.localStorage.setItem(LAST_MEDIA_SYNC_JOB_KEY, JSON.stringify(failedJob));
      emitMediaJob("finish", { jobId, status: "failed", title: message });
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      setSyncProgress(null);
    }
  }

  async function updateMetadata() {
    const jobId = `metadata-sync-${Date.now()}`;
    emitMediaJob("start", { jobId, title: "Atualizando base de dados" });
    updatingMetadataRef.current = true;
    setUpdatingMetadata(true);
    setError(null);
    setMetadataProgress(null);
    try {
      await window.gameStockAPI.launchbox.ensureMetadata({ force: true });
      await loadStats();
      emitMediaJob("finish", { jobId, status: "completed", title: "Base de dados atualizada" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      emitMediaJob("finish", { jobId, status: "failed", title: caught instanceof Error ? caught.message : String(caught) });
    } finally {
      updatingMetadataRef.current = false;
      setUpdatingMetadata(false);
      setMetadataProgress(null);
    }
  }

  const progressText = syncProgress
    ? `${syncProgress.current}/${syncProgress.total} ${syncProgress.filename ?? ""}`.trim()
    : syncing
      ? "Preparando sincronizacao"
      : `${percent}% da biblioteca com capa`;
  const syncTotal = syncProgress?.total || 1;
  const syncCurrent = syncProgress?.current || 0;
  const syncPercent = syncing && syncProgress?.total ? Math.round((syncCurrent / syncTotal) * 100) : percent;
  const currentMediaSyncJob = syncing
    ? {
      title: "Sincronizando mídia",
      subtitle: "Biblioteca",
      detail: syncProgress?.filename ?? progressText,
      progressLabel: syncProgress ? `${syncCurrent} de ${syncTotal}` : "Sincronizando",
      percent: syncPercent
    }
    : mediaSyncJob;
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
      : "Importando ROMs";
  const romDetail = romResult
    ? `${romResult.summary.processed} processados, ${romResult.summary.unmatched} sem match, ${romResult.summary.failedDownloads} falha(s) de midia`
    : romProgress?.filename ?? romProgress?.message ?? "Aguardando progresso";
  const romStep = romImportJob
    ? romImportJob.status === "completed"
      ? "Concluido"
      : romImportJob.status === "failed"
        ? "Erro"
        : `${romProgress?.current ?? 0} de ${romProgress?.total ?? 0} - ${labelForRomStage(romProgress?.stage ?? "preparing_metadata")}`
    : "";
  const showRomImportJob = Boolean(romImportJob && (
    romImportJob.status === "running" ||
    !mediaSyncJob ||
    timestamp(romImportJob.startedAt) >= timestamp(mediaSyncJob.startedAt)
  ));
  const showMediaSyncJob = Boolean(currentMediaSyncJob && !showRomImportJob);

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
            <div className="covers-progress-track" aria-label="Progresso do Metadata.zip">
              <span style={{ width: `${metadataProgress?.total ? Math.round((metadataProgress.current / metadataProgress.total) * 100) : 0}%` }} />
            </div>
            <p className="covers-progress-text">
              {metadataProgress ? `${formatMegabytesProgress(metadataProgress)} ${metadataProgress.filename ?? "Metadata.zip"}` : "Baixando Metadata.zip"}
            </p>
          </>
        )}
      </div>

      <div className="covers-media-intro">
        <SectionIntro title="Mídia da biblioteca" description="Situacao das capas principais e metadados baixados para os jogos da biblioteca." />
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
          <strong>{stats.metadataSyncable}</strong>
        </div>
      </div>

      <div className={"covers-sync-panel" + (!syncing ? " covers-sync-panel-idle" : "")}>
        <div className="covers-sync-header">
          <div>
            <strong>Sincronizacao de mídia</strong>
          </div>
          <button type="button" className="text-button active" onClick={syncCovers} disabled={syncing || updatingMetadata || romImportRunning || (stats.syncable === 0 && stats.metadataSyncable === 0)}>
            <RefreshCw aria-hidden="true" size={16} className={syncing ? "spin" : ""} />
            {syncing ? "Sincronizando" : "Sincronizar"}
          </button>
        </div>

        {showMediaSyncJob && currentMediaSyncJob && (
          <div className="covers-rom-sync-card">
            <div className="covers-rom-sync-card-header">
              <div>
                <strong>{currentMediaSyncJob.title}</strong>
                <span>{currentMediaSyncJob.subtitle}</span>
              </div>
              <small>{currentMediaSyncJob.progressLabel}</small>
            </div>
            <p>{currentMediaSyncJob.detail}</p>
            <div className="covers-progress-track" aria-label="Progresso de covers">
              <span style={{ width: `${currentMediaSyncJob.percent}%` }} />
            </div>
          </div>
        )}

        {showRomImportJob && romImportJob && (
          <div className="covers-rom-sync-card">
            <div className="covers-rom-sync-card-header">
              <div>
                <strong>{romTitle}</strong>
                <span>{romImportJob.platformName}</span>
              </div>
              <small>{romStep}</small>
            </div>
            <p>{romDetail}</p>
            {romProgress?.imageFilename ? <p>{romProgress.imageFilename}</p> : null}
            <div className="covers-progress-track" aria-label="Progresso da importacao de ROMs">
              <span style={{ width: `${romPercent}%` }} />
            </div>
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

function formatMegabytesProgress(progress: LaunchBoxProgress): string {
  const current = formatMegabytes(progress.current);
  if (!progress.total) return current;
  return `${current}/${formatMegabytes(progress.total)}`;
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function timestamp(value: string | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function emitMediaJob(type: "start" | "finish", detail: Record<string, unknown>): void {
  window.dispatchEvent(new CustomEvent(`gamestock:media:${type}`, { detail }));
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

function loadSavedRomImportJob(): RomFolderImportJob | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LAST_ROM_IMPORT_JOB_KEY) ?? "null") as RomFolderImportJob | null;
    return parsed?.jobId ? parsed : null;
  } catch {
    return null;
  }
}
