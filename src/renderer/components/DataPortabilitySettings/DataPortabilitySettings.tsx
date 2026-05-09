import { AlertTriangle, CheckCircle2, Download, FileArchive, HardDrive, PackageCheck, Upload } from "lucide-react";
import { useState } from "react";
import {
  DataPortabilityCategory,
  DATA_PORTABILITY_CATEGORIES,
  DataPortabilityJob,
  DataPortabilityImportPreview,
  DataPortabilityRomFolderEntry,
  DataPortabilityStartResult,
  DataPortabilityWarning
} from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { SectionIntro } from "../SectionIntro/SectionIntro";
import "./DataPortabilitySettings.css";

const ROM_FOLDER_ENTRIES_KEY = "gamestock.romImport.folderEntries";

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

export function DataPortabilitySettings({
  appVersion,
  storageStats
}: {
  appVersion: string;
  storageStats: { totalGames: number; dataDirSizeMb: number; dataDirPath: string } | null;
}) {
  const [exportCategories, setExportCategories] = useState<DataPortabilityCategory[]>([...DATA_PORTABILITY_CATEGORIES]);
  const [importCategories, setImportCategories] = useState<DataPortabilityCategory[]>([]);
  const [preview, setPreview] = useState<DataPortabilityImportPreview | null>(null);
  const [busy, setBusy] = useState<"export" | "preview" | "import" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dataPortabilityJobs = useGameStockStore((state) => state.dataPortabilityJobs);
  const startDataPortabilityJob = useGameStockStore((state) => state.startDataPortabilityJob);

  async function exportPackage(): Promise<void> {
    if (!exportCategories.length) {
      setError("Selecione ao menos uma categoria para exportar.");
      return;
    }
    setBusy("export");
    setError("");
    setMessage("");
    try {
      const result = await window.gameStockAPI.dataPortability.exportPackage({
        categories: exportCategories,
        romFolderEntries: exportCategories.includes("romLocations") ? loadRomFolderEntries() : []
      });
      if (!isCanceledStart(result)) {
        startDataPortabilityJob(result);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  }

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
      setImportCategories(nextPreview.availableCategories);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  }

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

  const importBlocked = Boolean(preview?.errors.length) || !preview || !importCategories.length;

  return (
    <section className="data-portability-settings">
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

      <section className="data-portability-panel">
        <SectionIntro title="Exportar backup" description="Crie um pacote local com as partes selecionadas da biblioteca." />
        <CategoryGrid selected={exportCategories} onChange={setExportCategories} />
        <div className="data-portability-actions">
          <button type="button" className="text-button active" onClick={exportPackage} disabled={busy !== null || !exportCategories.length}>
            <Download aria-hidden="true" size={15} />
            {busy === "export" ? "Exportando..." : "Exportar"}
          </button>
        </div>
      </section>

      <section className="data-portability-panel">
        <SectionIntro title="Importar backup" description="Previsualize um pacote e restaure somente as categorias escolhidas." />
        <div className="data-portability-actions data-portability-actions-start">
          <button type="button" className="text-button" onClick={selectImportPackage} disabled={busy !== null}>
            <Upload aria-hidden="true" size={15} />
            {busy === "preview" ? "Lendo..." : "Selecionar pacote"}
          </button>
        </div>

        {preview && (
          <div className="data-portability-preview">
            <div className="data-portability-preview-header">
              <div>
                <strong>Pacote selecionado</strong>
                <span>{preview.packagePath}</span>
              </div>
              <small>{formatDate(preview.manifest.createdAt)}</small>
            </div>
            <div className="data-portability-counts">
              <span>{preview.counts.games ?? 0} jogos</span>
              <span>{preview.counts.platforms ?? 0} plataformas</span>
              <span>{preview.counts.images ?? 0} imagens</span>
              <span>{preview.counts.romLocations ?? 0} ROMs</span>
            </div>
            <CategoryGrid selected={importCategories} available={preview.availableCategories} onChange={setImportCategories} />
            <WarningList title="Avisos" warnings={preview.warnings} />
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

      {message && (
        <div className="data-portability-message success">
          <CheckCircle2 aria-hidden="true" size={16} />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="data-portability-message error">
          <AlertTriangle aria-hidden="true" size={16} />
          <span>{error}</span>
        </div>
      )}
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

function DataPortabilityJobCard({ job }: { job: DataPortabilityJob }) {
  const percent = job.status === "completed" ? 100 : Math.min(100, Math.round((job.progress.current / (job.progress.total || 1)) * 100));
  return (
    <div className={`data-portability-job data-portability-job--${job.status}`}>
      <div>
        <strong>{job.kind === "export" ? "Exportação" : "Importação"}</strong>
        <span>{job.progress.message}</span>
      </div>
      <small>{job.status === "running" ? `${job.progress.current} de ${job.progress.total}` : statusLabel(job.status)}</small>
      <div className="data-portability-progress-track" aria-label="Progresso de portabilidade">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function CategoryGrid({
  selected,
  available = DATA_PORTABILITY_CATEGORIES,
  onChange
}: {
  selected: DataPortabilityCategory[];
  available?: DataPortabilityCategory[];
  onChange(categories: DataPortabilityCategory[]): void;
}) {
  const availableSet = new Set(available);

  return (
    <div className="data-portability-category-grid">
      {DATA_PORTABILITY_CATEGORIES.map((category) => {
        const disabled = !availableSet.has(category);
        const checked = selected.includes(category) && !disabled;
        return (
          <label key={category} className={`data-portability-category${checked ? " selected" : ""}${disabled ? " disabled" : ""}`}>
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(event) => {
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

function WarningList({ title, warnings }: { title: string; warnings: DataPortabilityWarning[] }) {
  if (!warnings.length) return null;
  return (
    <div className="data-portability-warning-list">
      <strong>{title}</strong>
      {warnings.slice(0, 8).map((warning, index) => (
        <p key={`${warning.code}-${index}`}>{warning.message}</p>
      ))}
      {warnings.length > 8 && <p>+{warnings.length - 8} item(ns)</p>}
    </div>
  );
}

function loadRomFolderEntries(): DataPortabilityRomFolderEntry[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(ROM_FOLDER_ENTRIES_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRomFolderEntry);
  } catch {
    return [];
  }
}

function isRomFolderEntry(value: unknown): value is DataPortabilityRomFolderEntry {
  return Boolean(
    value &&
    typeof value === "object" &&
    "folderPath" in value &&
    "platformId" in value &&
    typeof (value as DataPortabilityRomFolderEntry).folderPath === "string"
  );
}

function isCanceledStart(result: DataPortabilityStartResult): result is { canceled: true; filePath: null; warnings: DataPortabilityWarning[] } {
  return "canceled" in result && result.canceled;
}

function statusLabel(status: DataPortabilityJob["status"]): string {
  if (status === "completed") return "Concluído";
  if (status === "failed") return "Erro";
  if (status === "interrupted") return "Interrompido";
  return "Rodando";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}
