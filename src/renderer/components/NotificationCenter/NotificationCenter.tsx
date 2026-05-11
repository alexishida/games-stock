import { useMemo, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { DataPortabilityJob, RomFolderImportJob, RomFolderImportProgress } from "../../../shared/types";
import { MediaSyncJob, useGameStockStore } from "../../store";
import "./NotificationCenter.css";

type NotificationItem =
  | { type: "rom"; job: RomFolderImportJob }
  | { type: "media"; job: MediaSyncJob }
  | { type: "data-portability"; job: DataPortabilityJob };

export function NotificationCenter() {
  const romImportJob = useGameStockStore((state) => state.lastRomImportJob);
  const mediaSyncJobs = useGameStockStore((state) => state.mediaSyncJobs);
  const dataPortabilityJobs = useGameStockStore((state) => state.dataPortabilityJobs);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => initialDismissedIds([romImportJob, ...mediaSyncJobs, ...dataPortabilityJobs]));
  const notifications = useMemo(() => {
    const items: NotificationItem[] = [];
    if (romImportJob) items.push({ type: "rom", job: romImportJob });
    for (const job of mediaSyncJobs) items.push({ type: "media", job });
    for (const job of dataPortabilityJobs) items.push({ type: "data-portability", job });
    return items
      .filter((item) => !dismissedIds.includes(item.job.jobId))
      .sort((a, b) => timestamp(b.job.startedAt) - timestamp(a.job.startedAt));
  }, [dataPortabilityJobs, dismissedIds, mediaSyncJobs, romImportJob]);

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

function initialDismissedIds(jobs: Array<RomFolderImportJob | MediaSyncJob | DataPortabilityJob | null>): string[] {
  return jobs
    .filter((job): job is RomFolderImportJob | MediaSyncJob | DataPortabilityJob =>
      Boolean(job && (job.status === "completed" || job.status === "failed"))
    )
    .map((job) => job.jobId);
}

function NotificationCard({ item, onDismiss }: { item: NotificationItem; onDismiss(): void }) {
  if (item.type === "media") return <MediaNotificationCard job={item.job} onDismiss={onDismiss} />;
  if (item.type === "data-portability") return <DataPortabilityNotificationCard job={item.job} onDismiss={onDismiss} />;
  return <RomNotificationCard job={item.job} onDismiss={onDismiss} />;
}

function DataPortabilityNotificationCard({ job, onDismiss }: { job: DataPortabilityJob; onDismiss(): void }) {
  const dismissDataPortabilityJob = useGameStockStore((state) => state.dismissDataPortabilityJob);
  const percent = job.status === "completed" ? 100 : Math.min(100, Math.round((job.progress.current / (job.progress.total || 1)) * 100));
  const title = job.status === "completed"
    ? job.kind === "export" ? "Backup exportado" : "Backup importado"
    : job.status === "failed"
      ? job.error ?? "Portabilidade falhou"
      : job.kind === "export" ? "Exportando backup" : "Importando backup";

  return (
    <article className={`notification-card ${job.status}`}>
      <div className="notification-title">
        <strong>{title}</strong>
        {job.status !== "running" ? (
          <button
            type="button"
            onClick={() => {
              dismissDataPortabilityJob(job.jobId);
              onDismiss();
            }}
            aria-label="Dispensar"
          >
            <X aria-hidden="true" size={14} />
          </button>
        ) : null}
      </div>
      <p>{job.progress.message}</p>
      {job.packagePath ? <span>{job.packagePath}</span> : null}
      <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
      <small>{job.status === "running" ? `${job.progress.current} de ${job.progress.total}` : statusText(job.status)}</small>
    </article>
  );
}

function RomNotificationCard({ job, onDismiss }: { job: RomFolderImportJob; onDismiss(): void }) {
  const setLastRomImportJob = useGameStockStore((state) => state.setLastRomImportJob);
  const total = job.progress.total || 1;

  async function resumeImport(): Promise<void> {
    setLastRomImportJob(null);
    try {
      const newJob = await window.gameStockAPI.romFolderImport.import({
        folderPaths: job.folderPaths,
        romFilePaths: job.romFilePaths,
        platformId: job.platformId,
        detectionMode: job.detectionMode ?? "manual",
        includeSubfolders: job.includeSubfolders
      });
      setLastRomImportJob(newJob);
    } catch {
      // import error will surface via job status
    }
  }
  const percent = job.status === "completed" ? 100 : Math.min(100, Math.round((job.progress.current / total) * 100));
  const title = job.result
    ? `${job.result.summary.created} criados, ${job.result.summary.updated} atualizados`
    : job.status === "failed"
      ? job.error ?? job.progress.message ?? "Importacao de ROMs falhou"
      : job.status === "interrupted"
        ? "Import interrompido"
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
      {job.status === "interrupted" && (
        <button type="button" className="notification-resume-btn" onClick={() => void resumeImport()}>
          <RefreshCw aria-hidden="true" size={12} />
          Continuar
        </button>
      )}
    </article>
  );
}

function MediaNotificationCard({ job, onDismiss }: { job: MediaSyncJob; onDismiss(): void }) {
  const openSettings = useGameStockStore((state) => state.openSettings);
  const percent = job.status === "running" ? job.percent : 100;
  const progressText = job.status === "completed"
    ? "Concluído"
    : job.status === "failed"
      ? "Erro"
      : job.status === "interrupted"
        ? "Interrompido"
        : job.progressLabel;
  const showProgressText = !sameNotificationText(job.detail, progressText);

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
      {showProgressText ? <small>{progressText}</small> : null}
      {job.status === "interrupted" && (
        <button type="button" className="notification-resume-btn" onClick={() => openSettings("covers")}>
          <RefreshCw aria-hidden="true" size={12} />
          Continuar
        </button>
      )}
    </article>
  );
}

function folderCount(job: RomFolderImportJob): number {
  if (job.folderPaths.length) return job.folderPaths.length;
  return job.progress.folderPath ? 1 : 0;
}

function statusLabel(status: RomFolderImportJob["status"], progress: RomFolderImportProgress): string {
  if (status === "completed") return "Concluído";
  if (status === "failed") return "Erro";
  if (status === "interrupted") return "Interrompido";
  return `${progress.current} de ${progress.total} - ${labelForStage(progress.stage)}`;
}

function labelForStage(stage: RomFolderImportProgress["stage"]): string {
  return {
    preparing_metadata: "preparando dados",
    matching: "fazendo match",
    downloading: "baixando mídia",
    skipped: "pulando",
    saving: "salvando",
    done: "concluído",
    error: "erro"
  }[stage];
}

function statusText(status: DataPortabilityJob["status"]): string {
  if (status === "completed") return "Concluido";
  if (status === "failed") return "Erro";
  if (status === "interrupted") return "Interrompido";
  return "Rodando";
}

function timestamp(value: string | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function sameNotificationText(left: string, right: string): boolean {
  return left.trim().localeCompare(right.trim(), "pt-BR", { sensitivity: "base" }) === 0;
}
