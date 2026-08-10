/**
 * Painel de consulta e manutenção do histórico local de logs.
 *
 * Carrega dados somente quando montado na aba de configurações e permite ao
 * usuário atualizar, limpar o histórico ou abrir a pasta do arquivo no SO.
 */

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FolderOpen, RefreshCw, Trash2 } from "lucide-react";
import type { AppLogEntry } from "../../../shared/logs";
import { SectionIntro } from "../SectionIntro/SectionIntro";
import "./LogsSettings.css";

/** Formata data ISO para leitura local curta no painel. */
function formatLogTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString("pt-BR");
}

/** Exibe entradas de log persistidas e ações de manutenção não invasivas. */
export function LogsSettings() {
  const [entries, setEntries] = useState<AppLogEntry[]>([]);
  const [filePath, setFilePath] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /** Busca registros atuais pelo IPC, preservando mensagem quando a leitura falhar. */
  const loadLogs = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");
    try {
      const result = await window.gameStockAPI.app.listLogs();
      setEntries(result.entries);
      setFilePath(result.filePath);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os logs.");
    } finally {
      setLoading(false);
    }
  }, []);

  /** Carrega o histórico ao abrir esta seção. */
  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  /** Limpa arquivo local e sincroniza a lista visual com o novo histórico. */
  async function clearLogs(): Promise<void> {
    await window.gameStockAPI.app.clearLogs();
    await loadLogs();
  }

  /** Abre diretório do arquivo para copiar ou compartilhar o histórico. */
  async function openLogsFolder(): Promise<void> {
    if (!filePath) return;
    await window.gameStockAPI.shell.openPath(filePath.replace(/[\\/][^\\/]+$/, ""));
  }

  return (
    <section className="logs-settings">
      <SectionIntro
        title="Logs do aplicativo"
        description="Histórico local de eventos, avisos e erros. Mostra até 500 registros recentes."
      />

      <div className="logs-settings-actions">
        <button type="button" className="logs-action-button" onClick={() => void loadLogs()} disabled={loading}>
          <RefreshCw aria-hidden="true" size={15} className={loading ? "logs-refreshing" : ""} />
          Atualizar
        </button>
        <button type="button" className="logs-action-button" onClick={() => void openLogsFolder()} disabled={!filePath}>
          <FolderOpen aria-hidden="true" size={15} />
          Abrir pasta
          <ExternalLink aria-hidden="true" size={13} />
        </button>
        <button type="button" className="logs-action-button logs-action-danger" onClick={() => void clearLogs()} disabled={loading}>
          <Trash2 aria-hidden="true" size={15} />
          Limpar logs
        </button>
      </div>

      {error && <p className="logs-feedback logs-feedback-error" role="alert">{error}</p>}
      {loading ? <p className="logs-feedback">Carregando logs...</p> : entries.length === 0 ? (
        <p className="logs-feedback">Nenhum registro disponível.</p>
      ) : (
        <div className="logs-list" aria-label="Histórico de logs">
          {entries.map((entry) => (
            <article key={entry.id} className={`log-entry log-entry-${entry.level}`}>
              <div className="log-entry-meta">
                <time dateTime={entry.timestamp}>{formatLogTimestamp(entry.timestamp)}</time>
                <span>{entry.source}</span>
                <strong>{entry.level}</strong>
              </div>
              <pre>{entry.message}</pre>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
