/**
 * Componente raiz da aplicação.
 *
 * Responsabilidades:
 * - Registrar todos os listeners de IPC (eventos vindos do main process).
 * - Hidratar o store Zustand com dados persistidos no SQLite ao inicializar.
 * - Baixar a base de dados LaunchBox (Metadata.zip) caso ainda não exista.
 * - Renderizar o layout principal: Sidebar, TopBar, área de conteúdo e modais globais.
 */
import { type ReactNode, useEffect, useRef, useState } from "react";
import { BarChart3, Gamepad2, Layers3, Star, Trophy } from "lucide-react";
import { GameDetail } from "./components/GameDetail/GameDetail";
import { GameGrid } from "./components/GameGrid/GameGrid";
import { GameList } from "./components/GameList/GameList";
import { GameVersionModal } from "./components/GameVersionModal/GameVersionModal";
import { HardwareInventory } from "./components/HardwareInventory";
import { LaunchBoxImporter } from "./components/LaunchBoxImporter/LaunchBoxImporter";
import { ManualGameModal } from "./components/ManualGame/ManualGameModal";
import { NotificationCenter } from "./components/NotificationCenter/NotificationCenter";
import { SettingsModal } from "./components/SettingsModal/SettingsModal";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { TopBar } from "./components/TopBar/TopBar";
import { useCollectionCounts } from "./hooks/useCollectionCounts";
import { useGames } from "./hooks/useGames";
import { usePlatforms } from "./hooks/usePlatforms";
import { useGameStockStore } from "./store";
import { CollectionFilter, GameSortBy } from "../shared/types";
import {
  getPersistedRomFolderEntries,
  getPersistedDataPortabilityJobs,
  getPersistedLastRomImportJob,
  getPersistedMediaSyncJobs,
  mergePersistedRomFolderEntries,
  migrateLegacyLocalStorageToDb
} from "./lib/appStatePersistence";

/** Definição de uma aba de filtro da coleção: valor do filtro, rótulo e ícone. */
type CollectionTab = { value: CollectionFilter; label: string; icon: ReactNode };

/** Abas de filtro exibidas no cabeçalho da biblioteca. */
const COLLECTION_TABS: CollectionTab[] = [
  { value: "all", label: "Todos os jogos", icon: <Layers3 aria-hidden="true" size={15} /> },
  { value: "mostPlayed", label: "Mais Jogados", icon: <BarChart3 aria-hidden="true" size={15} /> },
  { value: "favorites", label: "Favoritos", icon: <Star aria-hidden="true" size={15} /> },
  { value: "playing", label: "Jogando", icon: <Gamepad2 aria-hidden="true" size={15} /> },
  { value: "completed", label: "Concluído", icon: <Trophy aria-hidden="true" size={15} /> }
];

/**
 * Exibe o conteúdo principal da biblioteca: abas de filtro, ordenação e a grade/lista de jogos.
 * Renderizado quando nenhum jogo está selecionado.
 */
function LibraryView() {
  const collectionFilter = useGameStockStore((state) => state.collectionFilter);
  const selectedCategory = useGameStockStore((state) => state.selectedCategory);
  const sortBy = useGameStockStore((state) => state.sortBy);
  const viewMode = useGameStockStore((state) => state.viewMode);
  const reloadToken = useGameStockStore((state) => state.reloadToken);
  const setCollectionFilter = useGameStockStore((state) => state.setCollectionFilter);
  const setSelectedCategory = useGameStockStore((state) => state.setSelectedCategory);
  const setSortBy = useGameStockStore((state) => state.setSortBy);
  const [genres, setGenres] = useState<string[]>([]);

  useEffect(() => {
    let canceled = false;

    // Recarrega gêneros quando a biblioteca muda para manter o filtro coerente.
    void window.gameStockAPI.games.listGenres()
      .then((nextGenres) => {
        if (canceled) return;
        setGenres(nextGenres);

        // Limpa seleção inválida quando a categoria deixa de existir após edição/importação.
        if (selectedCategory && !nextGenres.includes(selectedCategory)) {
          setSelectedCategory("");
        }
      })
      .catch(() => {
        if (!canceled) setGenres([]);
      });

    return () => {
      canceled = true;
    };
  }, [reloadToken, selectedCategory, setSelectedCategory]);

  return (
    <div className="home-content">
      <section className="library-header" aria-label="Filtros da biblioteca">
        <div className="library-tabs">
          {COLLECTION_TABS.map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              className={collectionFilter === value ? "active" : ""}
              onClick={() => setCollectionFilter(value)}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
        <div className="library-actions">
          <div className="category-control">
            <span>Categoria:</span>
            <select
              aria-label="Filtrar biblioteca por categoria"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
            >
              <option value="">Todas</option>
              {genres.map((genre) => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
          </div>
          <div className="sort-control">
            <span>Ordenar por:</span>
            <select aria-label="Ordenar biblioteca" value={sortBy} onChange={(event) => setSortBy(event.target.value as GameSortBy)}>
              <option value="title">A-Z</option>
              <option value="year">Ano</option>
              <option value="recent">Recentes</option>
              <option value="mostPlayed">Mais jogados</option>
            </select>
          </div>
        </div>
      </section>
      <section className="library-pane">
        {/* Alterna entre exibição em grade ou lista conforme preferência do usuário */}
        {viewMode === "grid" ? <GameGrid /> : <GameList />}
      </section>
    </div>
  );
}

/**
 * Componente principal da aplicação.
 *
 * Inicializa hooks de dados (plataformas, jogos, contagens),
 * registra listeners IPC e orquestra o layout geral.
 */
export default function App() {
  // Hooks que carregam dados do SQLite via IPC e atualizam o store
  usePlatforms();
  useGames();
  useCollectionCounts();

  // Leitura de estado do store para controle de UI e ações
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  const sidebarMode = useGameStockStore((state) => state.sidebarMode);
  const romFolderEntries = useGameStockStore((state) => state.romFolderEntries);
  const setViewMode = useGameStockStore((state) => state.setViewMode);
  const setImporterOpen = useGameStockStore((state) => state.setImporterOpen);
  const openSettings = useGameStockStore((state) => state.openSettings);
  const setCreateGameOpen = useGameStockStore((state) => state.setCreateGameOpen);
  const setSortBy = useGameStockStore((state) => state.setSortBy);
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const reloadPlatforms = useGameStockStore((state) => state.reloadPlatforms);

  // Ações de hidratação: carregam estado persistido no SQLite para o store em memória
  const hydratePersistedLastRomImportJob = useGameStockStore((state) => state.hydratePersistedLastRomImportJob);
  const hydrateRomFolderEntries = useGameStockStore((state) => state.hydrateRomFolderEntries);
  const hydrateMediaSyncJobs = useGameStockStore((state) => state.hydrateMediaSyncJobs);
  const hydrateRomImportJobs = useGameStockStore((state) => state.hydrateRomImportJobs);

  // Ações relacionadas a jobs de importação de ROMs
  const updateRomImportProgress = useGameStockStore((state) => state.updateRomImportProgress);
  const completeRomImportJob = useGameStockStore((state) => state.completeRomImportJob);

  // Ações relacionadas ao download/sincronização de metadados e capas
  const setMetadataStartupRunning = useGameStockStore((state) => state.setMetadataStartupRunning);
  const setCoverStats = useGameStockStore((state) => state.setCoverStats);
  const startMediaSyncJob = useGameStockStore((state) => state.startMediaSyncJob);
  const updateMediaSyncProgress = useGameStockStore((state) => state.updateMediaSyncProgress);
  const finishMediaSyncJob = useGameStockStore((state) => state.finishMediaSyncJob);
  const failMediaSyncJob = useGameStockStore((state) => state.failMediaSyncJob);

  // Ações relacionadas a jobs de portabilidade de dados (backup/restore)
  const hydrateDataPortabilityJobs = useGameStockStore((state) => state.hydrateDataPortabilityJobs);
  const updateDataPortabilityProgress = useGameStockStore((state) => state.updateDataPortabilityProgress);
  const completeDataPortabilityJob = useGameStockStore((state) => state.completeDataPortabilityJob);

  // Ref para garantir que o download de metadados seja iniciado apenas uma vez, mesmo em StrictMode
  const metadataStarted = useRef(false);
  // Ref para evitar disparar o sync incremental mais de uma vez em StrictMode.
  const configuredFolderSyncStarted = useRef(false);
  // Libera o sync automático só depois do bootstrap de metadados decidir se precisa baixar ou não.
  const [metadataBootstrapSettled, setMetadataBootstrapSettled] = useState(false);

  // Atualiza o título da janela com a versão do app
  useEffect(() => {
    let mounted = true;

    void window.gameStockAPI.app.getVersion().then((version) => {
      if (mounted) document.title = `GameStock v${version}`;
    });

    return () => {
      mounted = false;
    };
  }, []);

  // Migra dados do localStorage legado para o SQLite e hidrata o store com estado persistido
  useEffect(() => {
    let canceled = false;

    void (async () => {
      // Garante que dados antigos do localStorage sejam movidos para o SQLite antes de ler
      await migrateLegacyLocalStorageToDb();

      const [romFolderEntries, lastRomImportJob, mediaSyncJobs, dataPortabilityJobs] = await Promise.all([
        getPersistedRomFolderEntries(),
        getPersistedLastRomImportJob(),
        getPersistedMediaSyncJobs(),
        getPersistedDataPortabilityJobs()
      ]);

      if (canceled) return;
      hydrateRomFolderEntries(romFolderEntries);
      hydratePersistedLastRomImportJob(lastRomImportJob);
      hydrateMediaSyncJobs(mediaSyncJobs);
      hydrateDataPortabilityJobs(dataPortabilityJobs);
    })();

    return () => {
      canceled = true;
    };
  }, [hydrateDataPortabilityJobs, hydrateMediaSyncJobs, hydratePersistedLastRomImportJob, hydrateRomFolderEntries]);

  // Baixa automaticamente o Metadata.zip do LaunchBox na primeira vez que o app abre
  useEffect(() => {
    if (metadataStarted.current) return;
    metadataStarted.current = true;
    void (async () => {
      const jobId = `metadata-startup-${Date.now()}`;
      let jobStarted = false;
      try {
        const exists = await window.gameStockAPI.launchbox.metadataExists();
        if (exists) return; // Metadados já presentes, nada a fazer
        jobStarted = true;
        setMetadataStartupRunning(true);
        startMediaSyncJob({
          jobId,
          title: "Baixando base de dados",
          subtitle: "LaunchBox",
          detail: "Baixando Metadata.zip",
          progressLabel: "Iniciando"
        });
        // Repassa o jobId para que os ticks de bootstrap atualizem o job de startup correto.
        await window.gameStockAPI.launchbox.ensureMetadata({ force: false, jobId });
        setCoverStats(await window.gameStockAPI.games.coverStats());
        finishMediaSyncJob(jobId, {
          title: "Base de dados pronta",
          detail: "Metadata.zip disponível",
          progressLabel: "Concluído"
        });
      } catch (err) {
        if (jobStarted) failMediaSyncJob(jobId, err instanceof Error ? err.message : "Falha ao baixar base de dados");
      } finally {
        if (jobStarted) setMetadataStartupRunning(false);
        setMetadataBootstrapSettled(true);
      }
    })();
  }, [failMediaSyncJob, finishMediaSyncJob, setCoverStats, setMetadataStartupRunning, startMediaSyncJob]);

  /**
   * Faz sync incremental das pastas configuradas quando o app abre.
   * Importa só ROMs novas encontradas no disco, sem reprocessar a pasta inteira.
   */
  useEffect(() => {
    if (!metadataBootstrapSettled) return;
    if (configuredFolderSyncStarted.current) return;
    if (!romFolderEntries.length) return;

    configuredFolderSyncStarted.current = true;

    void window.gameStockAPI.romFolderImport.syncConfiguredFolders(romFolderEntries).catch(() => undefined);
  }, [metadataBootstrapSettled, romFolderEntries]);

  // Atualiza estatísticas de capas quando o main process emite evento de atualização
  useEffect(() => window.gameStockAPI.games.onCoverStatsUpdated(setCoverStats), [setCoverStats]);

  // Recebe ticks de progresso do download/extração do LaunchBox e repassa ao store
  useEffect(() => window.gameStockAPI.launchbox.onProgress(updateMediaSyncProgress), [updateMediaSyncProgress]);

  // Hidrata jobs de portabilidade ao montar (pode ter sido iniciado em outra sessão)
  useEffect(() => {
    let canceled = false;
    void window.gameStockAPI.dataPortability.jobs().then((jobs) => {
      if (!canceled) hydrateDataPortabilityJobs(jobs);
    });
    return () => {
      canceled = true;
    };
  }, [hydrateDataPortabilityJobs]);

  // Atualiza progresso de jobs de portabilidade (exportação/importação de backup)
  useEffect(() => window.gameStockAPI.dataPortability.onProgress(updateDataPortabilityProgress), [updateDataPortabilityProgress]);

  // Ao completar job de portabilidade: atualiza store, mescla pastas de ROM importadas e recarrega dados
  useEffect(() => window.gameStockAPI.dataPortability.onCompleted((job) => {
    completeDataPortabilityJob(job);
    if (job.kind === "import" && job.status === "completed") {
      // Mescla entradas de pastas de ROM do pacote importado com as entradas locais
      void mergePersistedRomFolderEntries(job.importResult?.summary.romFolderEntries ?? [])
        .then(getPersistedRomFolderEntries)
        .then(hydrateRomFolderEntries)
        .catch(() => undefined);
      reloadGames();
      reloadPlatforms();
      void window.gameStockAPI.games.coverStats().then(setCoverStats).catch(() => undefined);
    }
  }), [completeDataPortabilityJob, hydrateRomFolderEntries, reloadGames, reloadPlatforms, setCoverStats]);

  // Hidrata jobs de importação de ROM ao montar (detecta jobs interrompidos por crash)
  useEffect(() => {
    let canceled = false;
    void window.gameStockAPI.romFolderImport.jobs().then((jobs) => {
      if (!canceled) hydrateRomImportJobs(jobs);
    });
    return () => {
      canceled = true;
    };
  }, [hydrateRomImportJobs]);

  // Listeners de menu/IPC que abrem partes da UI
  useEffect(() => window.gameStockAPI.view.onSet(setViewMode), [setViewMode]);
  useEffect(() => window.gameStockAPI.launchbox.onOpenImporter(() => setImporterOpen(true)), [setImporterOpen]);
  useEffect(() => window.gameStockAPI.romFolderImport.onOpenImporter(() => openSettings("biblioteca")), [openSettings]);
  useEffect(() => window.gameStockAPI.library.onOpenCreateGame(() => setCreateGameOpen(true)), [setCreateGameOpen]);
  useEffect(() => window.gameStockAPI.library.onOpenPlatformManager(() => openSettings("plataformas")), [openSettings]);
  useEffect(() => window.gameStockAPI.library.onSetSort(setSortBy), [setSortBy]);

  // Recebe progresso de importação de ROM; ao concluir, aguarda 1,5 s e recarrega jogos/plataformas
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = window.gameStockAPI.romFolderImport.onProgress((progress) => {
      updateRomImportProgress(progress);
      if (progress.stage !== "done") return;
      // Pequeno atraso para garantir que o SQLite finalizou as escritas antes de recarregar
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        reloadGames();
        reloadPlatforms();
      }, 1500);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, [reloadGames, reloadPlatforms, updateRomImportProgress]);

  // Ao completar um job de importação de ROM: atualiza store e recarrega biblioteca
  useEffect(() => window.gameStockAPI.romFolderImport.onCompleted((result) => {
    if (!result.jobId) return;
    completeRomImportJob(result);
    reloadGames();
    reloadPlatforms();
    void window.gameStockAPI.games.coverStats().then(setCoverStats).catch(() => undefined);
  }), [completeRomImportJob, reloadGames, reloadPlatforms, setCoverStats]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-right">
        {/* TopBar é específica da biblioteca de jogos; oculta no modo inventário */}
        {sidebarMode === "library" && <TopBar />}
        <main className="main-area">
          {/* Alterna entre biblioteca de jogos e inventário de hardware */}
          {sidebarMode === "inventory"
            ? <HardwareInventory />
            : selectedGameId ? <GameDetail /> : <LibraryView />
          }
        </main>
      </div>
      {/* Modais globais — montados sempre para preservar estado mesmo quando fechados */}
      <LaunchBoxImporter />
      <SettingsModal />
      <ManualGameModal />
      <GameVersionModal />
      <NotificationCenter />
    </div>
  );
}
