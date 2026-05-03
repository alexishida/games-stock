import { useEffect, useMemo, useRef, useState } from "react";
import { DatabaseZap, Gamepad2, Image, ImageOff, RefreshCw } from "lucide-react";
import { CoverSyncStats, LaunchBoxProgress } from "../../../shared/types";
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
  const [stats, setStats] = useState<CoverSyncStats>(EMPTY_STATS);
  const [syncProgress, setSyncProgress] = useState<LaunchBoxProgress | null>(null);
  const [metadataProgress, setMetadataProgress] = useState<LaunchBoxProgress | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [updatingMetadata, setUpdatingMetadata] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncingRef = useRef(false);
  const updatingMetadataRef = useRef(false);
  const reloadGames = useGameStockStore((state) => state.reloadGames);

  useEffect(() => {
    void loadStats();
    return window.gameStockAPI.launchbox.onProgress((nextProgress) => {
      if (updatingMetadataRef.current) {
        setMetadataProgress(nextProgress);
        return;
      }
      if (syncingRef.current) setSyncProgress(nextProgress);
    });
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
    emitMediaJob("start", { jobId, title: "Sincronizacao de mídia" });
    syncingRef.current = true;
    setSyncing(true);
    setError(null);
    setSyncProgress(null);
    try {
      const result = await window.gameStockAPI.games.syncCovers();
      setStats(result);
      reloadGames();
      emitMediaJob("finish", { jobId, status: "completed", title: `${result.metadataUpdated} metadado(s), ${result.downloadedNow} capa(s)` });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      emitMediaJob("finish", { jobId, status: "failed", title: caught instanceof Error ? caught.message : String(caught) });
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
  const syncFileName = syncProgress?.filename ?? "Aguardando progresso";

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
            {syncing && <span>{syncFileName}</span>}
          </div>
          <button type="button" className="text-button active" onClick={syncCovers} disabled={syncing || updatingMetadata || (stats.syncable === 0 && stats.metadataSyncable === 0)}>
            <RefreshCw aria-hidden="true" size={16} className={syncing ? "spin" : ""} />
            {syncing ? "Sincronizando" : "Sincronizar"}
          </button>
        </div>

        {syncing && (
          <>
            <div className="covers-progress-track" aria-label="Progresso de covers">
              <span style={{ width: `${syncPercent}%` }} />
            </div>
            <p className="covers-progress-text">{syncProgress ? `${syncCurrent} de ${syncTotal}` : progressText}</p>
          </>
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

function emitMediaJob(type: "start" | "finish", detail: Record<string, unknown>): void {
  window.dispatchEvent(new CustomEvent(`gamestock:media:${type}`, { detail }));
}
