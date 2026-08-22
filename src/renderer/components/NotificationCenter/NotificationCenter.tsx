/**
 * NotificationCenter.tsx
 *
 * Painel lateral de notificações de background exibido na interface principal.
 * Agrega três tipos de jobs: importação de ROMs, sincronização de mídia e
 * portabilidade de dados (exportação/importação de backup).
 *
 * Cada job é representado por um card específico com barra de progresso,
 * status textual e botão de dispensar. Jobs interrompidos exibem botão
 * "Continuar" para retomar a operação.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { DataPortabilityJob, RomFolderImportJob, RomFolderImportProgress } from "../../../shared/types";
import { MediaSyncJob, useGameStockStore } from "../../store";
import { timestamp } from "../../lib/time";
import "./NotificationCenter.css";

/** União discriminada dos três tipos de notificação suportados */
type NotificationItem =
  | { type: "rom"; job: RomFolderImportJob }
  | { type: "media"; job: MediaSyncJob }
  | { type: "data-portability"; job: DataPortabilityJob };

/**
 * Componente raiz do centro de notificações.
 * Lê os jobs do store, filtra os dispensados, ordena por data de início
 * e renderiza um card por notificação.
 */
export function NotificationCenter() {
  // Último job de importação de ROMs registrado no store
  const romImportJob = useGameStockStore((state) => state.lastRomImportJob);
  // Lista de jobs de sincronização de mídia ativos
  const mediaSyncJobs = useGameStockStore((state) => state.mediaSyncJobs);
  // Lista de jobs de portabilidade de dados (backup export/import)
  const dataPortabilityJobs = useGameStockStore((state) => state.dataPortabilityJobs);

  /**
   * IDs de jobs dispensados pelo usuário nesta sessão.
   * Inicializado com jobs já concluídos ou falhos para não exibi-los
   * na primeira renderização após reload de estado persistido.
   */
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  // Marca do início desta sessão para distinguir jobs hidratados do SQLite
  // (começados em sessão anterior) dos jobs iniciados agora.
  const sessionStartRef = useRef(Date.now());
  const jobsReady = romImportJob || mediaSyncJobs.length || dataPortabilityJobs.length;

  useEffect(() => {
    // Só roda quando os jobs hidratados já estão disponíveis (App.tsx preenche o
    // store de forma assíncrona). Jobs terminais de sessões anteriores são
    // auto-dispensados; jobs terminais desta sessão permanecem visíveis.
    if (!jobsReady) return;
    const terminalFromPast = [romImportJob, ...mediaSyncJobs, ...dataPortabilityJobs]
      .filter((job): job is NonNullable<typeof job> => Boolean(job))
      .filter((job) => job.status === "completed" || job.status === "failed" || job.status === "interrupted")
      .filter((job) => timestamp(job.startedAt) < sessionStartRef.current)
      .map((job) => job.jobId);
    if (!terminalFromPast.length) return;
    setDismissedIds((current) => Array.from(new Set([...current, ...terminalFromPast])));
  }, [dataPortabilityJobs, jobsReady, mediaSyncJobs, romImportJob]);

  /**
   * Lista de notificações visíveis, derivada dos jobs do store.
   * Exclui os dispensados e ordena do mais recente para o mais antigo.
   */
  const notifications = useMemo(() => {
    const items: NotificationItem[] = [];
    if (romImportJob) items.push({ type: "rom", job: romImportJob });
    for (const job of mediaSyncJobs) items.push({ type: "media", job });
    for (const job of dataPortabilityJobs) items.push({ type: "data-portability", job });
    return items
      .filter((item) => !dismissedIds.includes(item.job.jobId))
      .sort((a, b) => timestamp(b.job.startedAt) - timestamp(a.job.startedAt));
  }, [dataPortabilityJobs, dismissedIds, mediaSyncJobs, romImportJob]);

  // Não renderiza o painel quando não há notificações visíveis
  if (!notifications.length) return null;

  return (
    <aside className="notification-center" aria-label="Notificacoes de background">
      {notifications.map((item) => (
        <NotificationCard
          key={item.job.jobId}
          item={item}
          // Adiciona o id à lista de dispensados sem duplicar entradas
          onDismiss={() => setDismissedIds((current) => current.includes(item.job.jobId) ? current : [...current, item.job.jobId])}
        />
      ))}
    </aside>
  );
}

/**
 * Roteador de cards: delega para o componente específico conforme o tipo do item.
 */
function NotificationCard({ item, onDismiss }: { item: NotificationItem; onDismiss(): void }) {
  if (item.type === "media") return <MediaNotificationCard job={item.job} onDismiss={onDismiss} />;
  if (item.type === "data-portability") return <DataPortabilityNotificationCard job={item.job} onDismiss={onDismiss} />;
  return <RomNotificationCard job={item.job} onDismiss={onDismiss} />;
}

/**
 * Card de notificação para jobs de portabilidade de dados (backup).
 * Exibe título dinâmico conforme o `kind` (export/import) e o status atual,
 * barra de progresso e caminho do pacote gerado quando disponível.
 */
function DataPortabilityNotificationCard({ job, onDismiss }: { job: DataPortabilityJob; onDismiss(): void }) {
  // Ação de remoção do job do store (limpa persistência SQLite)
  const dismissDataPortabilityJob = useGameStockStore((state) => state.dismissDataPortabilityJob);

  // Percentual calculado a partir do progresso atual; 100% quando concluído
  const percent = job.status === "completed" ? 100 : Math.min(100, Math.round((job.progress.current / (job.progress.total || 1)) * 100));

  // Título exibido no card varia conforme o status e o tipo de operação
  const title = job.status === "completed"
    ? job.kind === "export" ? "Backup exportado" : "Backup importado"
    : job.status === "failed"
      ? job.error ?? "Portabilidade falhou"
      : job.kind === "export" ? "Exportando backup" : "Importando backup";

  return (
    <article className={`notification-card ${job.status}`}>
      <div className="notification-title">
        <strong>{title}</strong>
        {/* Botão de dispensar visível apenas quando o job não está rodando */}
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
      {/* Mensagem de progresso textual */}
      <p>{job.progress.message}</p>
      {/* Caminho do arquivo de backup gerado, quando disponível */}
      {job.packagePath ? <span>{job.packagePath}</span> : null}
      {/* Barra de progresso visual */}
      <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
      {/* Legenda: contagem durante execução, texto de status quando terminal */}
      <small>{job.status === "running" ? `${job.progress.current} de ${job.progress.total}` : statusText(job.status)}</small>
    </article>
  );
}

/**
 * Card de notificação para jobs de importação de ROMs.
 * Exibe progresso por arquivo, permite dispensar o card e retomar
 * uma importação interrompida via botão "Continuar".
 */
function RomNotificationCard({ job, onDismiss }: { job: RomFolderImportJob; onDismiss(): void }) {
  // Atualiza o job de importação de ROMs no store
  const setLastRomImportJob = useGameStockStore((state) => state.setLastRomImportJob);

  // Evita divisão por zero quando o total ainda não é conhecido
  const total = job.progress.total || 1;

  /** Remove o job do store e marca como dispensado na lista local */
  function handleDismiss(): void {
    setLastRomImportJob(null);
    onDismiss();
  }

  /**
   * Retoma uma importação interrompida disparando um novo job IPC com os
   * mesmos parâmetros. Em caso de falha, restaura o job anterior.
   */
  async function resumeImport(): Promise<void> {
    const interrupted = job;
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
      // Restaura o job interrompido se a retomada falhar
      setLastRomImportJob(interrupted);
    }
  }

  // Percentual de conclusão; fixado em 100 quando o job terminou
  const percent = job.status === "completed" ? 100 : Math.min(100, Math.round((job.progress.current / total) * 100));

  // Título exibe resumo do resultado quando disponível, ou mensagem de progresso/status
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
        {/* Botão de dispensar visível apenas quando não está rodando */}
        {job.status !== "running" ? (
          <button type="button" onClick={handleDismiss} aria-label="Dispensar">
            <X aria-hidden="true" size={14} />
          </button>
        ) : null}
      </div>
      {/* Arquivo atual ou quantidade de pastas sendo processadas */}
      <p>{job.progress.filename ?? `${folderCount(job)} pasta(s)`}</p>
      {/* Nome do arquivo de imagem sendo baixado, quando aplicável */}
      {job.progress.imageFilename ? <span>{job.progress.imageFilename}</span> : null}
      {/* Barra de progresso visual */}
      <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
      {/* Legenda com status e etapa atual */}
      <small>{statusLabel(job.status, job.progress)}</small>
      {/* Botão para retomar importação interrompida */}
      {job.status === "interrupted" && (
        <button type="button" className="notification-resume-btn" onClick={() => void resumeImport()}>
          <RefreshCw aria-hidden="true" size={12} />
          Continuar
        </button>
      )}
    </article>
  );
}

/**
 * Card de notificação para jobs de sincronização de mídia (download de capas).
 * Suporta barra de progresso determinada e indeterminada.
 * Interrompido exibe botão que abre as configurações de mídia.
 */
function MediaNotificationCard({ job, onDismiss }: { job: MediaSyncJob; onDismiss(): void }) {
  // Abre o modal de configurações na aba especificada
  const openSettings = useGameStockStore((state) => state.openSettings);
  // Remove o job de sincronização de mídia do store
  const dismissMediaSyncJob = useGameStockStore((state) => state.dismissMediaSyncJob);

  // Durante execução usa o percentual do job; ao terminar fixa em 100
  const percent = job.status === "running" ? job.percent : 100;

  // Texto de progresso legível conforme o status
  const progressText = job.status === "completed"
    ? "Concluído"
    : job.status === "failed"
      ? "Erro"
      : job.status === "interrupted"
        ? "Interrompido"
        : job.progressLabel;

  // Evita duplicar o texto quando `detail` e `progressText` são idênticos
  const showProgressText = !sameNotificationText(job.detail, progressText);

  return (
    <article className={`notification-card ${job.status}`}>
      <div className="notification-title">
        <strong>{job.title}</strong>
        {/* Botão de dispensar visível apenas quando não está rodando */}
        {job.status !== "running" ? (
          <button
            type="button"
            onClick={() => { dismissMediaSyncJob(job.jobId); onDismiss(); }}
            aria-label="Dispensar"
          >
            <X aria-hidden="true" size={14} />
          </button>
        ) : null}
      </div>
      {/* Detalhe textual do progresso atual */}
      <p>{job.detail}</p>
      {/* Barra de progresso: classe extra para animação indeterminada quando aplicável */}
      <div className={`progress-track${job.indeterminate ? " progress-track--indeterminate" : ""}`}>
        <span style={{ width: `${percent}%` }} />
      </div>
      {/* Legenda secundária exibida apenas quando difere do detalhe principal */}
      {showProgressText ? <small>{progressText}</small> : null}
      {/* Botão que abre as configurações de mídia para retomar sincronização */}
      {job.status === "interrupted" && (
        <button type="button" className="notification-resume-btn" onClick={() => openSettings("covers")}>
          <RefreshCw aria-hidden="true" size={12} />
          Continuar
        </button>
      )}
    </article>
  );
}

/**
 * Retorna a quantidade de pastas envolvidas em um job de importação de ROMs.
 * Usa `folderPaths` quando disponível; caso contrário verifica `progress.folderPath`.
 */
function folderCount(job: RomFolderImportJob): number {
  if (job.folderPaths.length) return job.folderPaths.length;
  return job.progress.folderPath ? 1 : 0;
}

/**
 * Formata o texto de status exibido na legenda do card de importação de ROMs.
 * Durante execução mostra contagem e etapa atual; ao terminar mostra o status.
 */
function statusLabel(status: RomFolderImportJob["status"], progress: RomFolderImportProgress): string {
  if (status === "completed") return "Concluído";
  if (status === "failed") return "Erro";
  if (status === "interrupted") return "Interrompido";
  return `${progress.current} de ${progress.total} - ${labelForStage(progress.stage)}`;
}

/**
 * Mapeia o identificador interno de etapa do importador para
 * uma descrição legível em português.
 */
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

/**
 * Converte o status de um job de portabilidade de dados para texto legível.
 */
function statusText(status: DataPortabilityJob["status"]): string {
  if (status === "completed") return "Concluido";
  if (status === "failed") return "Erro";
  if (status === "interrupted") return "Interrompido";
  return "Rodando";
}

/**
 * Compara dois textos de notificação de forma case-insensitive e sem acentos.
 * Usado para evitar exibir informação duplicada no card.
 */
function sameNotificationText(left: string, right: string): boolean {
  return left.trim().localeCompare(right.trim(), "pt-BR", { sensitivity: "base" }) === 0;
}
