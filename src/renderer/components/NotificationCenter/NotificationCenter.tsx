import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { RomFolderImportJob, RomFolderImportProgress } from "../../../shared/types";
import { MediaSyncJob, useGameStockStore } from "../../store";
import "./NotificationCenter.css";

type NotificationItem =
  | { type: "rom"; job: RomFolderImportJob }
  | { type: "media"; job: MediaSyncJob };

const AUTO_DISMISS_MS = 5000;

export function NotificationCenter() {
  const romImportJob = useGameStockStore((state) => state.lastRomImportJob);
  const mediaSyncJobs = useGameStockStore((state) => state.mediaSyncJobs);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => initialDismissedIds([romImportJob, ...mediaSyncJobs]));
  const notifications = useMemo(() => {
    const items: NotificationItem[] = [];
    if (romImportJob) items.push({ type: "rom", job: romImportJob });
    for (const job of mediaSyncJobs) items.push({ type: "media", job });
    return items
      .filter((item) => !dismissedIds.includes(item.job.jobId))
      .sort((a, b) => timestamp(b.job.startedAt) - timestamp(a.job.startedAt));
  }, [dismissedIds, mediaSyncJobs, romImportJob]);

  useEffect(() => {
    const completedIds = notifications
      .filter((item) => item.job.status !== "running")
      .map((item) => item.job.jobId);
    if (!completedIds.length) return undefined;

    const timer = setTimeout(() => {
      setDismissedIds((current) => [...new Set([...current, ...completedIds])]);
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
  }, [notifications]);

  if (!notifications.length) return null;

  return (
    <aside className="notification-center" aria-label="Notificacoes de background">
      {notifications.map((item) => (
        <NotificationCard
          key={item.job.jobId}
          item={item}
          onDismiss={() => setDismissedIds((current) => current.includes(item.job.jobId) ? current : [...current, item.job.jobId])}
        />
      ))}
    </aside>
  );
}

function initialDismissedIds(jobs: Array<RomFolderImportJob | MediaSyncJob | null>): string[] {
  return jobs
    .filter((job): job is RomFolderImportJob | MediaSyncJob => Boolean(job && job.status !== "running"))
    .map((job) => job.jobId);
}

function NotificationCard({ item, onDismiss }: { item: NotificationItem; onDismiss(): void }) {
  if (item.type === "media") return <MediaNotificationCard job={item.job} onDismiss={onDismiss} />;
  return <RomNotificationCard job={item.job} onDismiss={onDismiss} />;
}

function RomNotificationCard({ job, onDismiss }: { job: RomFolderImportJob; onDismiss(): void }) {
  const total = job.progress.total || 1;
  const percent = job.status === "completed" ? 100 : Math.min(100, Math.round((job.progress.current / total) * 100));
  const title = job.result
    ? `${job.result.summary.created} criados, ${job.result.summary.updated} atualizados`
    : job.status === "failed"
      ? job.error ?? job.progress.message ?? "Importacao de ROMs falhou"
      : job.progress.message ?? "Importando ROMs";

  return (
    <article className={`notification-card ${job.status}`}>
      <div className="notification-title">
        <strong>{title}</strong>
        {job.status !== "running" ? (
          <button type="button" onClick={onDismiss} aria-label="Dispensar">
            <X aria-hidden="true" size={14} />
          </button>
        ) : null}
      </div>
      <p>{job.progress.filename ?? `${folderCount(job)} pasta(s)`}</p>
      {job.progress.imageFilename ? <span>{job.progress.imageFilename}</span> : null}
      <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
      <small>{statusLabel(job.status, job.progress)}</small>
    </article>
  );
}

function MediaNotificationCard({ job, onDismiss }: { job: MediaSyncJob; onDismiss(): void }) {
  const percent = job.status === "running" ? job.percent : 100;
  const progressText = job.status === "completed"
    ? "Concluido"
    : job.status === "failed"
      ? "Erro"
      : job.progressLabel;

  return (
    <article className={`notification-card ${job.status}`}>
      <div className="notification-title">
        <strong>{job.title}</strong>
        {job.status !== "running" ? (
          <button type="button" onClick={onDismiss} aria-label="Dispensar">
            <X aria-hidden="true" size={14} />
          </button>
        ) : null}
      </div>
      <p>{job.detail}</p>
      <div className={`progress-track${job.indeterminate ? " progress-track--indeterminate" : ""}`}>
        <span style={{ width: `${percent}%` }} />
      </div>
      <small>{progressText}</small>
    </article>
  );
}

function folderCount(job: RomFolderImportJob): number {
  if (job.folderPaths.length) return job.folderPaths.length;
  return job.progress.folderPath ? 1 : 0;
}

function statusLabel(status: RomFolderImportJob["status"], progress: RomFolderImportProgress): string {
  if (status === "completed") return "Concluido";
  if (status === "failed") return "Erro";
  return `${progress.current} de ${progress.total} - ${labelForStage(progress.stage)}`;
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

function timestamp(value: string | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}
