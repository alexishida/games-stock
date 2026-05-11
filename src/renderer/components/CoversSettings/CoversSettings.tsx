/**
 * CoversSettings.tsx
 *
 * Painel de configurações de mídia da biblioteca.
 * Responsável por:
 *   - Exibir estatísticas de capas baixadas e ausentes
 *   - Disparar e acompanhar a sincronização de mídia (covers) via job assíncrono
 *   - Atualizar a base de metadados LaunchBox (Metadata.zip)
 *   - Mostrar o progresso do job de importação de ROMs em andamento
 *   - Permitir retomar imports interrompidos
 */

import { useEffect, useRef, useState } from "react";
import { DatabaseZap, Gamepad2, Image, ImageOff, RefreshCw, X } from "lucide-react";
import { CoverSyncStats, RomFolderImportProgress } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { SectionIntro } from "../SectionIntro/SectionIntro";
import "./CoversSettings.css";

/** Valores padrão de estatísticas quando o store ainda não carregou dados reais. */
const EMPTY_STATS: CoverSyncStats = {
  total: 0,
  downloaded: 0,
  missing: 0,
  syncable: 0,
  metadataSyncable: 0,
  metadataDownloadedAt: null
};

/**
 * Componente principal da aba de capas/mídia dentro das configurações.
 * Lê o estado global de jobs de mídia e importação de ROMs via Zustand store.
 */
export function CoversSettings() {
  // Estatísticas de capas vindas do store (pode ser null antes do primeiro carregamento)
  const storeCoverStats = useGameStockStore((state) => state.coverStats);
  const setCoverStats = useGameStockStore((state) => state.setCoverStats);
  // Fallback para EMPTY_STATS enquanto os dados reais não chegaram
  const stats = storeCoverStats ?? EMPTY_STATS;

  const [error, setError] = useState<string | null>(null);

  const reloadGames = useGameStockStore((state) => state.reloadGames);

  // Job de importação de ROMs (último job registrado no store)
  const romImportJob = useGameStockStore((state) => state.lastRomImportJob);
  const setLastRomImportJob = useGameStockStore((state) => state.setLastRomImportJob);

  // Lista de jobs de sincronização de mídia (covers, metadata)
  const mediaSyncJobs = useGameStockStore((state) => state.mediaSyncJobs);
  const startMediaSyncJob = useGameStockStore((state) => state.startMediaSyncJob);
  const finishMediaSyncJob = useGameStockStore((state) => state.finishMediaSyncJob);
  const failMediaSyncJob = useGameStockStore((state) => state.failMediaSyncJob);
  const dismissMediaSyncJob = useGameStockStore((state) => state.dismissMediaSyncJob);

  // Flag que indica se o download inicial de metadados ao iniciar o app está em andamento
  const metadataStartupRunning = useGameStockStore((state) => state.metadataStartupRunning);

  /**
   * Ref usado para detectar quando o download de startup termina,
   * evitando re-carregar stats enquanto ainda está em andamento.
   */
  const startupTrackedRef = useRef(false);

  // Jobs atualmente em execução (status === "running")
  const runningMediaJobs = mediaSyncJobs.filter((j) => j.status === "running");

  // true se algum job de sincronização de covers está rodando
  const syncing = runningMediaJobs.some((j) => j.jobId.startsWith("media-sync-"));

  // true se o download de metadata está em andamento (startup ou manual)
  const updatingMetadata = metadataStartupRunning || runningMediaJobs.some((j) => j.jobId.startsWith("metadata-"));

  // Job de metadata em execução (para exibir progresso na barra)
  const metadataJob = runningMediaJobs.find((j) => j.jobId.startsWith("metadata-")) ?? null;

  // Jobs de sincronização de mídia da biblioteca (distintos do job de metadata)
  const mediaLibraryJobs = mediaSyncJobs.filter((j) => j.jobId.startsWith("media-sync-"));

  /**
   * Recarrega estatísticas de covers assim que o download de startup terminar.
   * Usa startupTrackedRef para não perder o evento de transição false→false.
   */
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

  /** Carrega as estatísticas de covers na montagem inicial do componente. */
  useEffect(() => {
    void loadStats();
  }, []);

  /** Busca estatísticas de covers via IPC e atualiza o store. */
  async function loadStats() {
    setError(null);
    try {
      setCoverStats(await window.gameStockAPI.games.coverStats());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  /**
   * Inicia a sincronização de mídia (download de capas para jogos sem capa).
   * Cria um job com ID único baseado em timestamp e atualiza o store ao concluir.
   */
  async function syncCovers() {
    const jobId = `media-sync-${Date.now()}`;
    setError(null);
    startMediaSyncJob({
      jobId,
      title: "Sincronizando mídia",
      subtitle: "Biblioteca",
      detail: "Preparando sincronização",
      progressLabel: "Sincronizando"
    });
    try {
      const result = await window.gameStockAPI.games.syncCovers();
      setCoverStats(result);
      reloadGames();
      finishMediaSyncJob(jobId, {
        title: `${result.metadataUpdated} metadado(s), ${result.downloadedNow} capa(s)`,
        detail: `${result.attempted} processados, ${result.skipped} pulados, ${result.failed} falha(s)`,
        progressLabel: "Concluído",
        failures: result.failures
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      failMediaSyncJob(jobId, message);
    }
  }

  /**
   * Força o re-download do Metadata.zip do LaunchBox.
   * Cria um job de metadata separado para exibir progresso na barra.
   */
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
        progressLabel: "Concluído"
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      failMediaSyncJob(jobId, message);
    }
  }

  // ── Derivações do job de importação de ROMs para exibição no card ──

  /** true se o import de ROMs está rodando agora */
  const romImportRunning = romImportJob?.status === "running";

  /** Progresso atual do job de ROMs (pode ser null se ainda não iniciou) */
  const romProgress = romImportJob?.progress ?? null;

  /** Resultado final do job de ROMs (disponível apenas após conclusão) */
  const romResult = romImportJob?.result;

  /**
   * Percentual de progresso calculado:
   * - 100 se concluído
   * - Proporção current/total arredondada caso contrário
   */
  const romPercent = romImportJob
    ? romImportJob.status === "completed"
      ? 100
      : Math.min(100, Math.round(((romProgress?.current ?? 0) / (romProgress?.total || 1)) * 100))
    : 0;

  /** Título exibido no card do job de ROMs, variando conforme o status */
  const romTitle = romResult
    ? `${romResult.summary.created} criados, ${romResult.summary.updated} atualizados`
    : romImportJob?.status === "failed"
      ? "Importação de ROMs falhou"
      : romImportJob?.status === "interrupted"
        ? "Import interrompido"
        : "Importando ROMs";

  /** Detalhe exibido abaixo do título no card (nome do arquivo atual ou resumo) */
  const romDetail = romResult
    ? `${romResult.summary.processed} processados, ${romResult.summary.unmatched} sem match, ${romResult.summary.failedDownloads} falha(s) de mídia`
    : romProgress?.filename ?? romProgress?.message ?? "Aguardando progresso";

  /** Rótulo do passo atual do job de ROMs (contagem + estágio em português) */
  const romStep = romImportJob
    ? romImportJob.status === "completed"
      ? "Concluído"
      : romImportJob.status === "failed"
        ? "Erro"
        : romImportJob.status === "interrupted"
          ? "Interrompido"
          : `${romProgress?.current ?? 0} de ${romProgress?.total ?? 0} - ${labelForRomStage(romProgress?.stage ?? "preparing_metadata")}`
    : "";

  /**
   * Retoma um import de ROMs que foi interrompido (ex.: app fechado durante o job).
   * Limpa o job antigo do store e inicia um novo com os mesmos parâmetros.
   */
  async function resumeRomImport(): Promise<void> {
    if (!romImportJob) return;
    const { folderPaths, romFilePaths, platformId, detectionMode, includeSubfolders } = romImportJob;
    setLastRomImportJob(null);
    try {
      const newJob = await window.gameStockAPI.romFolderImport.import({
        folderPaths,
        romFilePaths,
        platformId,
        detectionMode: detectionMode ?? "manual",
        includeSubfolders
      });
      setLastRomImportJob(newJob);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <section className="covers-settings">
      {/* Painel de atualização do Metadata.zip */}
      <div className="covers-sync-panel metadata-panel">
        <div className="covers-sync-header">
          <div>
            <strong>Atualizar dados</strong>
            <span>Último download: {formatMetadataDate(stats.metadataDownloadedAt)}</span>
          </div>
          <button type="button" className="text-button active" onClick={updateMetadata} disabled={updatingMetadata || syncing}>
            <DatabaseZap aria-hidden="true" size={16} className={updatingMetadata ? "spin" : ""} />
            {updatingMetadata ? "Atualizando" : "Atualizar"}
          </button>
        </div>
        {/* Barra de progresso indeterminada exibida durante o download do Metadata.zip */}
        {updatingMetadata && (
          <>
            <div className={`covers-progress-track${metadataJob?.indeterminate ? " covers-progress-indeterminate" : ""}`} aria-label="Progresso do Metadata.zip">
              <span style={{ width: `${metadataJob?.percent ?? 100}%` }} />
            </div>
            <p className="covers-progress-text">{metadataJob?.detail ?? "Baixando Metadata.zip"}</p>
          </>
        )}
      </div>

      {/* Introdução da seção de mídia da biblioteca */}
      <div className="covers-media-intro">
        <SectionIntro title="Mídia da biblioteca" description="Situação das capas principais e metadados baixados para os jogos da biblioteca." />
      </div>

      {/* Cards com contadores: capas baixadas, ausentes e total de jogos */}
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

      {/* Painel de sincronização de mídia — ocupa estado "idle" quando não está rodando */}
      <div className={"covers-sync-panel" + (!syncing ? " covers-sync-panel-idle" : "")}>
        <div className="covers-sync-header">
          <div>
            <strong>Sincronização de mídia</strong>
          </div>
          {/* Botão desabilitado se não há jogos sincronizáveis ou outro job em andamento */}
          <button type="button" className="text-button active" onClick={syncCovers} disabled={syncing || updatingMetadata || romImportRunning || (stats.syncable === 0 && stats.metadataSyncable === 0)}>
            <RefreshCw aria-hidden="true" size={16} className={syncing ? "spin" : ""} />
            {syncing ? "Sincronizando" : "Sincronizar"}
          </button>
        </div>

        {/* Cards de jobs de sincronização de mídia da biblioteca (um por job) */}
        {mediaLibraryJobs.map((job) => (
          <div key={job.jobId} className={`covers-rom-sync-card covers-rom-sync-card--${job.status}`}>
            <div className="covers-rom-sync-card-header">
              <div>
                <strong>{job.title}</strong>
                <span>{job.subtitle}</span>
              </div>
              <div className="covers-rom-sync-card-meta">
                <small>{job.progressLabel}</small>
                {/* Botão de fechar disponível apenas quando o job não está rodando */}
                {job.status !== "running" && (
                  <button type="button" className="covers-job-dismiss" onClick={() => dismissMediaSyncJob(job.jobId)} aria-label="Fechar">
                    <X aria-hidden="true" size={12} />
                  </button>
                )}
              </div>
            </div>
            <p>{job.detail}</p>
            {/* Barra de progresso — indeterminate quando o job não tem total definido */}
            <div className={`covers-progress-track${job.indeterminate ? " covers-progress-indeterminate" : ""}`} aria-label="Progresso de covers">
              <span style={{ width: `${job.percent}%` }} />
            </div>
            {/* Lista de falhas individuais de download de covers, se houver */}
            {job.failures?.length ? (
              <div className="covers-failure-section">
                <div className="covers-failure-section-header">
                  <strong>Motivo das falhas</strong>
                  <span>{job.failures.length} jogo(s)</span>
                </div>
                <div className="covers-failure-list">
                  {job.failures.map((failure) => (
                    <div key={`${job.jobId}-${failure.gameId}-${failure.launchboxId ?? "sem-launchbox"}`} className="covers-failure-item">
                      <strong>{failure.title}</strong>
                      <span>{failure.platformName}</span>
                      <p>{failure.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {/* Botão de retomar exibido apenas para jobs interrompidos */}
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

        {/* Card do job de importação de ROMs (único, controlado pelo lastRomImportJob do store) */}
        {romImportJob && (
          <div className={`covers-rom-sync-card covers-rom-sync-card--${romImportJob.status}`}>
            <div className="covers-rom-sync-card-header">
              <div>
                <strong>{romTitle}</strong>
                <span>{romImportJob.platformName}</span>
              </div>
              <div className="covers-rom-sync-card-meta">
                <small>{romStep}</small>
                {/* Fechar disponível apenas quando o job não está rodando */}
                {romImportJob.status !== "running" && (
                  <button type="button" className="covers-job-dismiss" onClick={() => setLastRomImportJob(null)} aria-label="Fechar">
                    <X aria-hidden="true" size={12} />
                  </button>
                )}
              </div>
            </div>
            <p>{romDetail}</p>
            {/* Nome do arquivo de imagem sendo baixado no momento (download de covers do import) */}
            {romProgress?.imageFilename ? <p>{romProgress.imageFilename}</p> : null}
            <div className="covers-progress-track" aria-label="Progresso da importação de ROMs">
              <span style={{ width: `${romPercent}%` }} />
            </div>
            {/* Botão de retomar import de ROMs interrompido */}
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

/**
 * Formata a data do último download do Metadata.zip para exibição em pt-BR.
 * Retorna "nunca baixado" quando o valor é null.
 */
function formatMetadataDate(value: string | null): string {
  if (!value) return "nunca baixado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

/**
 * Converte o estágio interno do job de importação de ROMs em rótulo legível em português.
 * Usado no campo de progresso exibido ao usuário.
 */
function labelForRomStage(stage: RomFolderImportProgress["stage"]): string {
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
