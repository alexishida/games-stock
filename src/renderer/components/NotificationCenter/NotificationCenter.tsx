import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { LaunchBoxProgress, RomFolderImportProgress, RomFolderImportResult } from "../../../shared/types";
import "./NotificationCenter.css";

interface RomNotificationItem {
  type: "rom";
  jobId: string;
  folderCount: number;
  platformName?: string;
  status: "running" | "completed" | "failed";
  progress: RomFolderImportProgress;
  result?: RomFolderImportResult;
}

interface MediaNotificationItem {
  type: "media";
  jobId: string;
  title: string;
  status: "running" | "completed" | "failed";
  progress: LaunchBoxProgress | null;
}

type NotificationItem = RomNotificationItem | MediaNotificationItem;
const AUTO_DISMISS_MS = 5000;

export function NotificationCenter() {
  const [items, setItems] = useState<Record<string, NotificationItem>>({});
  const activeMediaJob = useRef<string | null>(null);
  const notifications = useMemo(() => Object.values(items).sort((a, b) => a.jobId.localeCompare(b.jobId)).reverse(), [items]);

  useEffect(() => window.gameStockAPI.romFolderImport.onProgress((progress) => {
    if (!progress.jobId) return;
    setItems((current) => ({
      ...current,
      [progress.jobId!]: {
        type: "rom",
        jobId: progress.jobId!,
        folderCount: current[progress.jobId!]?.folderCount || (progress.folderPath ? 1 : 0),
        platformName: current[progress.jobId!]?.platformName,
        status: progress.stage === "error" ? "failed" : current[progress.jobId!]?.status ?? "running",
        progress,
        result: current[progress.jobId!]?.result
      }
    }));
  }), []);

  useEffect(() => {
    const removeProgress = window.gameStockAPI.launchbox.onProgress((progress) => {
      const jobId = activeMediaJob.current;
      if (!jobId) return;
      setItems((current) => {
        const item = current[jobId];
        if (!item || item.type !== "media") return current;
        return {
          ...current,
          [jobId]: {
            ...item,
            status: progress.status === "error" ? "failed" : item.status,
            progress
          }
        };
      });
    });

    function onStart(event: Event): void {
      const detail = (event as CustomEvent<{ jobId: string; title: string }>).detail;
      activeMediaJob.current = detail.jobId;
      setItems((current) => ({
        ...current,
        [detail.jobId]: {
          type: "media",
          jobId: detail.jobId,
          title: detail.title,
          status: "running",
          progress: null
        }
      }));
    }

    function onFinish(event: Event): void {
      const detail = (event as CustomEvent<{ jobId: string; title: string; status: "completed" | "failed" }>).detail;
      activeMediaJob.current = activeMediaJob.current === detail.jobId ? null : activeMediaJob.current;
      setItems((current) => {
        const item = current[detail.jobId];
        if (!item || item.type !== "media") return current;
        return {
          ...current,
          [detail.jobId]: {
            ...item,
            title: detail.title,
            status: detail.status,
            progress: item.progress
              ? { ...item.progress, current: item.progress.total || item.progress.current, status: detail.status === "completed" ? "done" : "error" }
              : { current: 1, total: 1, filename: detail.title, status: detail.status === "completed" ? "done" : "error" }
          }
        };
      });
    }

    window.addEventListener("gamestock:media:start", onStart);
    window.addEventListener("gamestock:media:finish", onFinish);
    return () => {
      removeProgress();
      window.removeEventListener("gamestock:media:start", onStart);
      window.removeEventListener("gamestock:media:finish", onFinish);
    };
  }, []);

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
        type: "rom",
        jobId: result.jobId!,
        folderCount: result.folderPaths.length,
        platformName: result.platformName,
        status: "completed",
        progress,
        result
      }
    }));
  }), []);

  useEffect(() => {
    const completedIds = notifications
      .filter((item) => item.status !== "running")
      .map((item) => item.jobId);
    if (!completedIds.length) return undefined;

    const timer = setTimeout(() => {
      setItems((current) => {
        const next = { ...current };
        for (const jobId of completedIds) {
          if (next[jobId]?.status !== "running") delete next[jobId];
        }
        return next;
      });
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
  }, [notifications]);

  if (!notifications.length) return null;

  return (
    <aside className="notification-center" aria-label="Notificacoes de background">
      {notifications.map((item) => (
        <NotificationCard
          key={item.jobId}
          item={item}
          onDismiss={() => setItems((current) => {
            const { [item.jobId]: _, ...rest } = current;
            return rest;
          })}
        />
      ))}
    </aside>
  );
}

function NotificationCard({ item, onDismiss }: { item: NotificationItem; onDismiss(): void }) {
  if (item.type === "media") return <MediaNotificationCard item={item} onDismiss={onDismiss} />;

  const total = item.progress.total || 1;
  const percent = Math.min(100, Math.round((item.progress.current / total) * 100));
  const title = item.result ? `${item.result.summary.created} criados, ${item.result.summary.updated} atualizados` : item.progress.message ?? "Importando ROMs";

  return (
    <article className={`notification-card ${item.status}`}>
      <div className="notification-title">
        <strong>{title}</strong>
        {item.status !== "running" ? (
          <button type="button" onClick={onDismiss} aria-label="Dispensar">
            <X aria-hidden="true" size={14} />
          </button>
        ) : null}
      </div>
      <p>{item.progress.filename ?? `${item.folderCount || item.result?.folderPaths.length || 0} pasta(s)`}</p>
      {item.progress.imageFilename ? <span>{item.progress.imageFilename}</span> : null}
      <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
      <small>{item.status === "completed" ? "Concluido" : `${item.progress.current} de ${item.progress.total} - ${labelForStage(item.progress.stage)}`}</small>
    </article>
  );
}

function MediaNotificationCard({ item, onDismiss }: { item: MediaNotificationItem; onDismiss(): void }) {
  const total = item.progress?.total || 1;
  const current = item.progress?.current || 0;
  const percent = item.status === "completed" ? 100 : Math.min(100, Math.round((current / total) * 100));
  const progressText = item.status === "completed"
    ? "Concluido"
    : item.status === "failed"
      ? "Erro"
      : formatMediaProgress(item, current, total);

  return (
    <article className={`notification-card ${item.status}`}>
      <div className="notification-title">
        <strong>{item.title}</strong>
        {item.status !== "running" ? (
          <button type="button" onClick={onDismiss} aria-label="Dispensar">
            <X aria-hidden="true" size={14} />
          </button>
        ) : null}
      </div>
      <p>{item.progress?.filename ?? "Aguardando progresso"}</p>
      <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
      <small>{progressText}</small>
    </article>
  );
}

function formatMediaProgress(item: MediaNotificationItem, current: number, total: number): string {
  if (item.progress?.filename?.toLowerCase() === "metadata.zip") {
    return `${formatMegabytes(current)} de ${formatMegabytes(total)}`;
  }
  return `${current} de ${total}`;
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
