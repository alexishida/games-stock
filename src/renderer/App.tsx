import { useEffect } from "react";
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
import { CollectionFilter, GameSortBy, RomFolderImportJob, RomFolderImportProgress, RomFolderImportResult } from "../shared/types";

const COLLECTION_TABS: { value: CollectionFilter; label: string }[] = [
  { value: "all", label: "Todos os jogos" },
  { value: "favorites", label: "Favoritos" },
  { value: "completed", label: "Concluidos" },
  { value: "unplayed", label: "Nao jogados" }
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
          {COLLECTION_TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={collectionFilter === value ? "active" : ""}
              onClick={() => setCollectionFilter(value)}
            >
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
  const setSettingsOpen = useGameStockStore((state) => state.setSettingsOpen);
  const setSettingsSection = useGameStockStore((state) => state.setSettingsSection);
  const setLastRomImportJob = useGameStockStore((state) => state.setLastRomImportJob);

  useEffect(() => window.gameStockAPI.view.onSet(setViewMode), [setViewMode]);
  useEffect(() => window.gameStockAPI.launchbox.onOpenImporter(() => setImporterOpen(true)), [setImporterOpen]);
  useEffect(() => window.gameStockAPI.romFolderImport.onOpenImporter(() => openSettings("biblioteca")), [openSettings]);
  useEffect(() => window.gameStockAPI.library.onOpenCreateGame(() => setCreateGameOpen(true)), [setCreateGameOpen]);
  useEffect(() => window.gameStockAPI.library.onOpenPlatformManager(() => openSettings("plataformas")), [openSettings]);
  useEffect(() => window.gameStockAPI.library.onSetSort(setSortBy), [setSortBy]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = window.gameStockAPI.romFolderImport.onProgress((progress) => {
      if (progress.jobId) setLastRomImportJob((current) => updateRomImportJob(current, progress));
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
  }, [reloadGames, reloadPlatforms, setLastRomImportJob]);

  useEffect(() => window.gameStockAPI.romFolderImport.onCompleted(() => {
    reloadGames();
    reloadPlatforms();
  }), [reloadGames, reloadPlatforms]);

  useEffect(() => window.gameStockAPI.romFolderImport.onCompleted((result) => {
    if (!result.jobId) return;
    const completedJob = completeRomImportJob(result);
    setLastRomImportJob(completedJob);
    window.localStorage.setItem("gamestock.media.lastRomImportJob", JSON.stringify(completedJob));
    setSettingsOpen(true);
    setSettingsSection("covers");
  }), [setLastRomImportJob, setSettingsOpen, setSettingsSection]);

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

function updateRomImportJob(current: RomFolderImportJob | null, progress: RomFolderImportProgress): RomFolderImportJob {
  return {
    jobId: progress.jobId!,
    folderPaths: current?.jobId === progress.jobId ? current.folderPaths : [],
    romFilePaths: current?.jobId === progress.jobId ? current.romFilePaths : [],
    platformId: current?.jobId === progress.jobId ? current.platformId : 0,
    platformName: current?.jobId === progress.jobId ? current.platformName : "Biblioteca",
    status: progress.stage === "error" ? "failed" : "running",
    startedAt: current?.jobId === progress.jobId ? current.startedAt : new Date().toISOString(),
    progress,
    result: current?.jobId === progress.jobId ? current.result : undefined,
    error: progress.stage === "error" ? progress.message : undefined
  };
}

function completeRomImportJob(result: RomFolderImportResult): RomFolderImportJob {
  return {
    jobId: result.jobId!,
    folderPaths: result.folderPaths,
    romFilePaths: result.romFilePaths,
    platformId: result.platformId,
    platformName: result.platformName,
    status: "completed",
    startedAt: new Date().toISOString(),
    progress: {
      jobId: result.jobId,
      current: result.summary.processed,
      total: result.summary.processed,
      stage: "done",
      message: "Importacao concluida"
    },
    result
  };
}
