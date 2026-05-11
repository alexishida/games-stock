/**
 * DataPortabilitySettings.tsx
 *
 * Painel de portabilidade de dados dentro das configurações.
 * Permite ao usuário:
 *   - Exportar um pacote de backup (.gamestock-backup) com categorias selecionadas
 *   - Selecionar e pré-visualizar um pacote de backup existente antes de importar
 *   - Importar categorias específicas de um pacote, com progresso exibido via job do store
 *
 * Toda escrita em SQLite durante a importação ocorre no main process (via IPC),
 * garantindo transacionalidade e rollback em caso de falha.
 */

import { AlertTriangle, CheckCircle2, Download, FileArchive, HardDrive, PackageCheck, Upload } from "lucide-react";
import { useState } from "react";
import {
  DataPortabilityCategory,
  DATA_PORTABILITY_CATEGORIES,
  DataPortabilityJob,
  DataPortabilityImportPreview,
  DataPortabilityStartResult,
  DataPortabilityWarning
} from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { getPersistedRomFolderEntries } from "../../lib/appStatePersistence";
import { SectionIntro } from "../SectionIntro/SectionIntro";
import "./DataPortabilitySettings.css";

/**
 * Mapeamento de categorias para títulos e descrições em português,
 * usados na grade de seleção de categorias.
 */
const CATEGORY_LABELS: Record<DataPortabilityCategory, { title: string; description: string }> = {
  metadata: {
    title: "Metadados",
    description: "Jogos, favoritos, status e dados LaunchBox"
  },
  images: {
    title: "Imagens",
    description: "Capas, fundos e screenshots baixados"
  },
  platforms: {
    title: "Plataformas",
    description: "Plataformas, mapeamentos e emuladores"
  },
  romLocations: {
    title: "Localizações de ROMs",
    description: "Caminhos de ROM e pastas configuradas"
  }
};

/**
 * Componente principal do painel de portabilidade de dados.
 *
 * @param appVersion    Versão do aplicativo exibida no card de status.
 * @param storageStats  Estatísticas de armazenamento (total de jogos e tamanho do diretório de dados).
 */
export function DataPortabilitySettings({
  appVersion,
  storageStats
}: {
  appVersion: string;
  storageStats: { totalGames: number; dataDirSizeMb: number; dataDirPath: string } | null;
}) {
  // Categorias selecionadas para exportação (inicialmente todas)
  const [exportCategories, setExportCategories] = useState<DataPortabilityCategory[]>([...DATA_PORTABILITY_CATEGORIES]);

  // Categorias selecionadas para importação (preenchidas após pré-visualização do pacote)
  const [importCategories, setImportCategories] = useState<DataPortabilityCategory[]>([]);

  // Dados de pré-visualização do pacote selecionado para importação
  const [preview, setPreview] = useState<DataPortabilityImportPreview | null>(null);

  // Estado de ocupado: controla qual operação está em andamento (export, preview ou import)
  const [busy, setBusy] = useState<"export" | "preview" | "import" | null>(null);

  // Mensagem de sucesso exibida ao usuário após operação concluída
  const [message, setMessage] = useState("");

  // Mensagem de erro exibida ao usuário em caso de falha
  const [error, setError] = useState("");

  // Lista de jobs de portabilidade em andamento ou concluídos (do store Zustand)
  const dataPortabilityJobs = useGameStockStore((state) => state.dataPortabilityJobs);
  const startDataPortabilityJob = useGameStockStore((state) => state.startDataPortabilityJob);

  /**
   * Inicia a exportação do pacote de backup.
   * Abre diálogo nativo para escolha do destino via IPC e exibe progresso via job no store.
   */
  async function exportPackage(): Promise<void> {
    if (!exportCategories.length) {
      setError("Selecione ao menos uma categoria para exportar.");
      return;
    }
    setBusy("export");
    setError("");
    setMessage("");
    try {
      // Busca entradas de pastas de ROM persistidas caso a categoria "romLocations" esteja selecionada
      const romFolderEntries = exportCategories.includes("romLocations") ? await getPersistedRomFolderEntries() : [];
      const result = await window.gameStockAPI.dataPortability.exportPackage({
        categories: exportCategories,
        romFolderEntries
      });
      // Ignora se o usuário cancelou o diálogo de salvar arquivo
      if (!isCanceledStart(result)) {
        startDataPortabilityJob(result);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  }

  /**
   * Abre um diálogo nativo para selecionar o arquivo de backup e carrega a pré-visualização.
   * A pré-visualização exibe contagens, avisos e erros antes de confirmar a importação.
   */
  async function selectImportPackage(): Promise<void> {
    setBusy("preview");
    setError("");
    setMessage("");
    setPreview(null);
    try {
      const packagePath = await window.gameStockAPI.dialogs.openAnyFile();
      if (!packagePath) return;
      const nextPreview = await window.gameStockAPI.dataPortability.previewImport(packagePath);
      setPreview(nextPreview);
      // Pré-seleciona todas as categorias disponíveis no pacote
      setImportCategories(nextPreview.availableCategories);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  }

  /**
   * Confirma a importação das categorias selecionadas.
   * O job roda em background no main process; o progresso é exibido via store.
   */
  async function importPackage(): Promise<void> {
    if (!preview || !importCategories.length) {
      setError("Selecione ao menos uma categoria para importar.");
      return;
    }
    setBusy("import");
    setError("");
    setMessage("");
    try {
      const result = await window.gameStockAPI.dataPortability.importPackage({
        packagePath: preview.packagePath,
        categories: importCategories
      });
      startDataPortabilityJob(result);
      setMessage("Importação iniciada em background.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  }

  /**
   * Bloqueia o botão de importar se há erros críticos no pacote
   * ou se nenhuma categoria foi selecionada.
   */
  const importBlocked = Boolean(preview?.errors.length) || !preview || !importCategories.length;

  return (
    <section className="data-portability-settings">
      {/* Cards com métricas de armazenamento: versão do app, quantidade de jogos e tamanho em disco */}
      <div className="data-portability-status-grid">
        <div className="data-portability-stat">
          <HardDrive aria-hidden="true" size={18} />
          <span>Versão</span>
          <strong>{appVersion || "carregando"}</strong>
        </div>
        <div className="data-portability-stat">
          <FileArchive aria-hidden="true" size={18} />
          <span>Biblioteca</span>
          <strong>{storageStats ? `${storageStats.totalGames} jogos` : "carregando"}</strong>
        </div>
        <div className="data-portability-stat">
          <PackageCheck aria-hidden="true" size={18} />
          <span>Dados locais</span>
          <strong>{storageStats ? `${storageStats.dataDirSizeMb} MB` : "carregando"}</strong>
        </div>
      </div>

      {/* Seção de exportação de backup */}
      <section className="data-portability-panel">
        <SectionIntro title="Exportar backup" description="Crie um pacote local com as partes selecionadas da biblioteca." />
        {/* Grade de checkboxes para selecionar categorias a exportar */}
        <CategoryGrid selected={exportCategories} onChange={setExportCategories} />
        <div className="data-portability-actions">
          <button type="button" className="text-button active" onClick={exportPackage} disabled={busy !== null || !exportCategories.length}>
            <Download aria-hidden="true" size={15} />
            {busy === "export" ? "Exportando..." : "Exportar"}
          </button>
        </div>
      </section>

      {/* Seção de importação de backup */}
      <section className="data-portability-panel">
        <SectionIntro title="Importar backup" description="Previsualize um pacote e restaure somente as categorias escolhidas." />
        <div className="data-portability-actions data-portability-actions-start">
          <button type="button" className="text-button" onClick={selectImportPackage} disabled={busy !== null}>
            <Upload aria-hidden="true" size={15} />
            {busy === "preview" ? "Lendo..." : "Selecionar pacote"}
          </button>
        </div>

        {/* Pré-visualização do pacote selecionado */}
        {preview && (
          <div className="data-portability-preview">
            <div className="data-portability-preview-header">
              <div>
                <strong>Pacote selecionado</strong>
                <span>{preview.packagePath}</span>
              </div>
              {/* Data de criação do backup formatada */}
              <small>{formatDate(preview.manifest.createdAt)}</small>
            </div>
            {/* Contagens de itens por categoria dentro do pacote */}
            <div className="data-portability-counts">
              <span>{preview.counts.games ?? 0} jogos</span>
              <span>{preview.counts.platforms ?? 0} plataformas</span>
              <span>{preview.counts.images ?? 0} imagens</span>
              <span>{preview.counts.romLocations ?? 0} ROMs</span>
            </div>
            {/* Grade de seleção de categorias — restrita às disponíveis no pacote */}
            <CategoryGrid selected={importCategories} available={preview.availableCategories} onChange={setImportCategories} />
            {/* Avisos não críticos encontrados durante a pré-visualização */}
            <WarningList title="Avisos" warnings={preview.warnings} />
            {/* Erros críticos que bloqueiam a importação */}
            <WarningList title="Erros" warnings={preview.errors} />
            <div className="data-portability-actions">
              <button type="button" className="text-button active" onClick={importPackage} disabled={busy !== null || importBlocked}>
                <Upload aria-hidden="true" size={15} />
                {busy === "import" ? "Importando..." : "Importar selecionados"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Feedback de sucesso após iniciar uma operação */}
      {message && (
        <div className="data-portability-message success">
          <CheckCircle2 aria-hidden="true" size={16} />
          <span>{message}</span>
        </div>
      )}
      {/* Feedback de erro */}
      {error && (
        <div className="data-portability-message error">
          <AlertTriangle aria-hidden="true" size={16} />
          <span>{error}</span>
        </div>
      )}
      {/* Lista dos últimos jobs de portabilidade (máx 3) com progresso */}
      {dataPortabilityJobs.length ? (
        <div className="data-portability-job-list">
          {dataPortabilityJobs.slice(0, 3).map((job) => (
            <DataPortabilityJobCard key={job.jobId} job={job} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Card de progresso para um job de portabilidade (exportação ou importação).
 * Exibe barra de progresso, status e mensagem atual do job.
 */
function DataPortabilityJobCard({ job }: { job: DataPortabilityJob }) {
  // Calcula percentual: 100 quando concluído, proporcional ao progresso atual caso contrário
  const percent = job.status === "completed" ? 100 : Math.min(100, Math.round((job.progress.current / (job.progress.total || 1)) * 100));
  return (
    <div className={`data-portability-job data-portability-job--${job.status}`}>
      <div>
        <strong>{job.kind === "export" ? "Exportação" : "Importação"}</strong>
        <span>{job.progress.message}</span>
      </div>
      {/* Exibe contagem enquanto rodando ou rótulo de status quando finalizado */}
      <small>{job.status === "running" ? `${job.progress.current} de ${job.progress.total}` : statusLabel(job.status)}</small>
      <div className="data-portability-progress-track" aria-label="Progresso de portabilidade">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/**
 * Grade de checkboxes para selecionar/desselecionar categorias de portabilidade.
 *
 * @param selected   Categorias atualmente selecionadas.
 * @param available  Categorias disponíveis para seleção (padrão: todas as categorias).
 * @param onChange   Callback chamado com a nova lista de categorias ao alterar seleção.
 */
function CategoryGrid({
  selected,
  available = DATA_PORTABILITY_CATEGORIES,
  onChange
}: {
  selected: DataPortabilityCategory[];
  available?: DataPortabilityCategory[];
  onChange(categories: DataPortabilityCategory[]): void;
}) {
  // Set para verificar rapidamente se uma categoria está disponível no pacote
  const availableSet = new Set(available);

  return (
    <div className="data-portability-category-grid">
      {DATA_PORTABILITY_CATEGORIES.map((category) => {
        // Categorias não presentes no pacote ficam desabilitadas
        const disabled = !availableSet.has(category);
        const checked = selected.includes(category) && !disabled;
        return (
          <label key={category} className={`data-portability-category${checked ? " selected" : ""}${disabled ? " disabled" : ""}`}>
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(event) => {
                // Adiciona ou remove a categoria da seleção conforme o estado do checkbox
                if (event.target.checked) onChange([...selected, category]);
                else onChange(selected.filter((item) => item !== category));
              }}
            />
            <span>
              <strong>{CATEGORY_LABELS[category].title}</strong>
              <small>{CATEGORY_LABELS[category].description}</small>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Lista de avisos ou erros de pré-visualização do pacote.
 * Exibe no máximo 8 itens e indica quantos foram omitidos.
 *
 * @param title    Título da seção ("Avisos" ou "Erros").
 * @param warnings Lista de avisos/erros retornados pelo main process.
 */
function WarningList({ title, warnings }: { title: string; warnings: DataPortabilityWarning[] }) {
  if (!warnings.length) return null;
  return (
    <div className="data-portability-warning-list">
      <strong>{title}</strong>
      {warnings.slice(0, 8).map((warning, index) => (
        <p key={`${warning.code}-${index}`}>{warning.message}</p>
      ))}
      {/* Indica quantos avisos adicionais foram omitidos da lista */}
      {warnings.length > 8 && <p>+{warnings.length - 8} item(ns)</p>}
    </div>
  );
}

/**
 * Type guard que verifica se o resultado de início de exportação representa um cancelamento.
 * O usuário cancela quando fecha o diálogo de salvar sem escolher um arquivo.
 */
function isCanceledStart(result: DataPortabilityStartResult): result is { canceled: true; filePath: null; warnings: DataPortabilityWarning[] } {
  return "canceled" in result && result.canceled;
}

/**
 * Converte o status interno do job em rótulo legível em português.
 */
function statusLabel(status: DataPortabilityJob["status"]): string {
  if (status === "completed") return "Concluído";
  if (status === "failed") return "Erro";
  if (status === "interrupted") return "Interrompido";
  return "Rodando";
}

/**
 * Formata uma string de data ISO para exibição curta em pt-BR.
 * Retorna o valor original se a data for inválida.
 */
function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}
