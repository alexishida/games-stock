import { type ReactNode, useEffect, useRef } from "react";
import { Gamepad2, Layers3, Star, Trophy } from "lucide-react";
import { GameDetail } from "./components/GameDetail/GameDetail";
import { GameGrid } from "./components/GameGrid/GameGrid";
import { GameList } from "./components/GameList/GameList";
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
  getPersistedDataPortabilityJobs,
  getPersistedLastRomImportJob,
  getPersistedMediaSyncJobs,
  mergePersistedRomFolderEntries,
  migrateLegacyLocalStorageToDb
} from "./lib/appStatePersistence";

type CollectionTab = { value: CollectionFilter; label: string; icon: ReactNode };

const COLLECTION_TABS: CollectionTab[] = [
  { value: "all", label: "Todos os jogos", icon: <Layers3 aria-hidden="true" size={15} /> },
  { value: "favorites", label: "Favoritos", icon: <Star aria-hidden="true" size={15} /> },
  { value: "playing", label: "Jogando", icon: <Gamepad2 aria-hidden="true" size={15} /> },
  { value: "completed", label: "Concluído", icon: <Trophy aria-hidden="true" size={15} /> }
];
function LibraryView() {
  const collectionFilter = useGameStockStore((state) => state.collectionFilter);
  const sortBy = useGameStockStore((state) => state.sortBy);
  const viewMode = useGameStockStore((state) => state.viewMode);
  const setCollectionFilter = useGameStockStore((state) => state.setCollectionFilter);
  const setSortBy = useGameStockStore((state) => state.setSortBy);

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
        <div className="sort-control">
          <span>Ordenar por:</span>
          <select aria-label="Ordenar biblioteca" value={sortBy} onChange={(event) => setSortBy(event.target.value as GameSortBy)}>
            <option value="title">A-Z</option>
            <option value="year">Ano</option>
            <option value="recent">Recentes</option>
          </select>
        </div>
      </section>
      <section className="library-pane">
        {viewMode === "grid" ? <GameGrid /> : <GameList />}
      </section>
    </div>
  );
}

export default function App() {
  usePlatforms();
  useGames();
  useCollectionCounts();
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  const setViewMode = useGameStockStore((state) => state.setViewMode);
  const setImporterOpen = useGameStockStore((state) => state.setImporterOpen);
  const openSettings = useGameStockStore((state) => state.openSettings);
  const setCreateGameOpen = useGameStockStore((state) => state.setCreateGameOpen);
  const setSortBy = useGameStockStore((state) => state.setSortBy);
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const reloadPlatforms = useGameStockStore((state) => state.reloadPlatforms);

  const hydratePersistedLastRomImportJob = useGameStockStore((state) => state.hydratePersistedLastRomImportJob);
  const hydrateMediaSyncJobs = useGameStockStore((state) => state.hydrateMediaSyncJobs);
  const hydrateRomImportJobs = useGameStockStore((state) => state.hydrateRomImportJobs);
  const updateRomImportProgress = useGameStockStore((state) => state.updateRomImportProgress);
  const completeRomImportJob = useGameStockStore((state) => state.completeRomImportJob);
  const setMetadataStartupRunning = useGameStockStore((state) => state.setMetadataStartupRunning);
  const setCoverStats = useGameStockStore((state) => state.setCoverStats);
  const startMediaSyncJob = useGameStockStore((state) => state.startMediaSyncJob);
  const updateMediaSyncProgress = useGameStockStore((state) => state.updateMediaSyncProgress);
  const finishMediaSyncJob = useGameStockStore((state) => state.finishMediaSyncJob);
  const failMediaSyncJob = useGameStockStore((state) => state.failMediaSyncJob);
  const hydrateDataPortabilityJobs = useGameStockStore((state) => state.hydrateDataPortabilityJobs);
  const updateDataPortabilityProgress = useGameStockStore((state) => state.updateDataPortabilityProgress);
  const completeDataPortabilityJob = useGameStockStore((state) => state.completeDataPortabilityJob);

  const metadataStarted = useRef(false);

  useEffect(() => {
    let mounted = true;

    void window.gameStockAPI.app.getVersion().then((version) => {
      if (mounted) document.title = `GameStock v${version}`;
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let canceled = false;

    void (async () => {
      await migrateLegacyLocalStorageToDb();

      const [lastRomImportJob, mediaSyncJobs, dataPortabilityJobs] = await Promise.all([
        getPersistedLastRomImportJob(),
        getPersistedMediaSyncJobs(),
        getPersistedDataPortabilityJobs()
      ]);

      if (canceled) return;
      hydratePersistedLastRomImportJob(lastRomImportJob);
      hydrateMediaSyncJobs(mediaSyncJobs);
      hydrateDataPortabilityJobs(dataPortabilityJobs);
    })();

    return () => {
      canceled = true;
    };
  }, [hydrateDataPortabilityJobs, hydrateMediaSyncJobs, hydratePersistedLastRomImportJob]);

  useEffect(() => {
    if (metadataStarted.current) return;
    metadataStarted.current = true;
    void (async () => {
      const jobId = `metadata-startup-${Date.now()}`;
      let jobStarted = false;
      try {
        const exists = await window.gameStockAPI.launchbox.metadataExists();
        if (exists) return;
        jobStarted = true;
        setMetadataStartupRunning(true);
        startMediaSyncJob({
          jobId,
          title: "Baixando base de dados",
          subtitle: "LaunchBox",
          detail: "Baixando Metadata.zip",
          progressLabel: "Iniciando"
        });
        await window.gameStockAPI.launchbox.ensureMetadata({ force: false });
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
      }
    })();
  }, [failMediaSyncJob, finishMediaSyncJob, setCoverStats, setMetadataStartupRunning, startMediaSyncJob]);

  useEffect(() => window.gameStockAPI.games.onCoverStatsUpdated(setCoverStats), [setCoverStats]);
  useEffect(() => window.gameStockAPI.launchbox.onProgress(updateMediaSyncProgress), [updateMediaSyncProgress]);
  useEffect(() => {
    let canceled = false;
    void window.gameStockAPI.dataPortability.jobs().then((jobs) => {
      if (!canceled) hydrateDataPortabilityJobs(jobs);
    });
    return () => {
      canceled = true;
    };
  }, [hydrateDataPortabilityJobs]);
  useEffect(() => window.gameStockAPI.dataPortability.onProgress(updateDataPortabilityProgress), [updateDataPortabilityProgress]);
  useEffect(() => window.gameStockAPI.dataPortability.onCompleted((job) => {
    completeDataPortabilityJob(job);
    if (job.kind === "import" && job.status === "completed") {
      void mergePersistedRomFolderEntries(job.importResult?.summary.romFolderEntries ?? []);
      reloadGames();
      reloadPlatforms();
      void window.gameStockAPI.games.coverStats().then(setCoverStats).catch(() => undefined);
    }
  }), [completeDataPortabilityJob, reloadGames, reloadPlatforms, setCoverStats]);
  useEffect(() => {
    let canceled = false;
    void window.gameStockAPI.romFolderImport.jobs().then((jobs) => {
      if (!canceled) hydrateRomImportJobs(jobs);
    });
    return () => {
      canceled = true;
    };
  }, [hydrateRomImportJobs]);
  useEffect(() => window.gameStockAPI.view.onSet(setViewMode), [setViewMode]);
  useEffect(() => window.gameStockAPI.launchbox.onOpenImporter(() => setImporterOpen(true)), [setImporterOpen]);
  useEffect(() => window.gameStockAPI.romFolderImport.onOpenImporter(() => openSettings("biblioteca")), [openSettings]);
  useEffect(() => window.gameStockAPI.library.onOpenCreateGame(() => setCreateGameOpen(true)), [setCreateGameOpen]);
  useEffect(() => window.gameStockAPI.library.onOpenPlatformManager(() => openSettings("plataformas")), [openSettings]);
  useEffect(() => window.gameStockAPI.library.onSetSort(setSortBy), [setSortBy]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = window.gameStockAPI.romFolderImport.onProgress((progress) => {
      updateRomImportProgress(progress);
      if (progress.stage !== "done") return;
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
        <TopBar />
        <main className="main-area">
          {selectedGameId ? <GameDetail /> : <LibraryView />}
        </main>
      </div>
      <LaunchBoxImporter />
      <SettingsModal />
      <ManualGameModal />
      <NotificationCenter />
    </div>
  );
}
