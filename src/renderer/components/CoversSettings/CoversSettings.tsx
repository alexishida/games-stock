import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, RefreshCw, XCircle } from "lucide-react";
import { CoverSyncResult, CoverSyncStats, LaunchBoxProgress } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { SectionIntro } from "../SectionIntro/SectionIntro";
import "./CoversSettings.css";

const EMPTY_STATS: CoverSyncStats = {
  total: 0,
  downloaded: 0,
  missing: 0,
  syncable: 0
};

export function CoversSettings() {
  const [stats, setStats] = useState<CoverSyncStats>(EMPTY_STATS);
  const [progress, setProgress] = useState<LaunchBoxProgress | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CoverSyncResult | null>(null);
  const reloadGames = useGameStockStore((state) => state.reloadGames);

  useEffect(() => {
    void loadStats();
    return window.gameStockAPI.launchbox.onProgress(setProgress);
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
    setSyncing(true);
    setError(null);
    setLastResult(null);
    setProgress(null);
    try {
      const result = await window.gameStockAPI.games.syncCovers();
      setStats(result);
      setLastResult(result);
      reloadGames();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  }

  const progressText = progress
    ? `${progress.current}/${progress.total} ${progress.filename ?? ""}`.trim()
    : syncing
      ? "Preparando sincronizacao"
      : `${percent}% da biblioteca com capa`;

  return (
    <section className="covers-settings">
      <SectionIntro title="Covers" description="Situacao das capas principais baixadas para os jogos da biblioteca." />

      <div className="covers-status">
        <div className="cover-stat">
          <CheckCircle2 aria-hidden="true" size={18} />
          <span>Baixadas</span>
          <strong>{stats.downloaded}</strong>
        </div>
        <div className="cover-stat warning">
          <XCircle aria-hidden="true" size={18} />
          <span>Faltando</span>
          <strong>{stats.missing}</strong>
        </div>
        <div className="cover-stat">
          <Download aria-hidden="true" size={18} />
          <span>Prontas para baixar</span>
          <strong>{stats.syncable}</strong>
        </div>
      </div>

      <div className="covers-sync-panel">
        <div className="covers-sync-header">
          <div>
            <strong>Sincronizacao de covers</strong>
            <span>{stats.total} jogo(s) na biblioteca</span>
          </div>
          <button type="button" className="text-button active" onClick={syncCovers} disabled={syncing || stats.syncable === 0}>
            <RefreshCw aria-hidden="true" size={16} className={syncing ? "spin" : ""} />
            {syncing ? "Sincronizando" : "Sincronizar"}
          </button>
        </div>

        <div className="covers-progress-track" aria-label="Progresso de covers">
          <span style={{ width: `${syncing && progress?.total ? Math.round((progress.current / progress.total) * 100) : percent}%` }} />
        </div>
        <p className="covers-progress-text">{progressText}</p>

        {lastResult && (
          <p className="covers-result">
            {lastResult.downloadedNow} baixada(s), {lastResult.failed} falha(s), {lastResult.skipped} ignorada(s).
          </p>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
    </section>
  );
}
