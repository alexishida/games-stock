import { useEffect, useMemo, useState } from "react";
import { RomFolderImportJob, RomFolderImportProgress, RomFolderImportResult } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import "./NotificationCenter.css";

interface NotificationItem {
  jobId: string;
  folderCount: number;
  platformName?: string;
  status: "running" | "completed" | "failed";
  progress: RomFolderImportProgress;
  result?: RomFolderImportResult;
}

export function NotificationCenter() {
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const reloadPlatforms = useGameStockStore((state) => state.reloadPlatforms);
  const [items, setItems] = useState<Record<string, NotificationItem>>({});
  const notifications = useMemo(() => Object.values(items).sort((a, b) => a.jobId.localeCompare(b.jobId)).reverse(), [items]);

  useEffect(() => window.gameStockAPI.romFolderImport.onProgress((progress) => {
    if (!progress.jobId) return;
    setItems((current) => ({
      ...current,
      [progress.jobId!]: {
        jobId: progress.jobId!,
        folderCount: current[progress.jobId!]?.folderCount || (progress.folderPath ? 1 : 0),
        platformName: current[progress.jobId!]?.platformName,
        status: progress.stage === "error" ? "failed" : current[progress.jobId!]?.status ?? "running",
        progress,
        result: current[progress.jobId!]?.result
      }
    }));
  }), []);

  useEffect(() => window.gameStockAPI.romFolderImport.onCompleted((result) => {
    if (!result.jobId) return;
    const progress: RomFolderImportProgress = {
      jobId: result.jobId,
      current: result.summary.processed,
      total: result.summary.processed,
      stage: "done",
      message: "Importacao concluida"
    };
    setItems((current) => ({
      ...current,
      [result.jobId!]: {
        jobId: result.jobId!,
        folderCount: result.folderPaths.length,
        platformName: result.platformName,
        status: "completed",
        progress,
        result
      }
    }));
    reloadGames();
    reloadPlatforms();
  }), [reloadGames, reloadPlatforms]);

  if (!notifications.length) return null;

  return (
    <aside className="notification-center" aria-label="Notificacoes de background">
      <header>
        <strong>Background</strong>
        <span>{notifications.length}</span>
      </header>
      {notifications.map((item) => <NotificationCard key={item.jobId} item={item} onDismiss={() => setItems((current) => {
        const next = { ...current };
        delete next[item.jobId];
        return next;
      })} />)}
    </aside>
  );
}

function NotificationCard({ item, onDismiss }: { item: NotificationItem; onDismiss(): void }) {
  const total = item.progress.total || 1;
  const percent = Math.min(100, Math.round((item.progress.current / total) * 100));
  const title = item.result ? `${item.result.summary.created} criados, ${item.result.summary.updated} atualizados` : item.progress.message ?? "Importando ROMs";

  return (
    <article className={`notification-card ${item.status}`}>
      <div className="notification-title">
        <strong>{title}</strong>
        {item.status !== "running" ? <button type="button" onClick={onDismiss}>x</button> : null}
      </div>
      <p>{item.progress.filename ?? `${item.folderCount || item.result?.folderPaths.length || 0} pasta(s)`}</p>
      {item.progress.imageFilename ? <span>{item.progress.imageFilename}</span> : null}
      <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
      <small>{item.status === "completed" ? "Concluido" : `${item.progress.current} de ${item.progress.total} - ${labelForStage(item.progress.stage)}`}</small>
    </article>
  );
}

function labelForStage(stage: RomFolderImportProgress["stage"]): string {
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
