import { useEffect } from "react";
import { GameDetail } from "./components/GameDetail/GameDetail";
import { GameGrid } from "./components/GameGrid/GameGrid";
import { GameList } from "./components/GameList/GameList";
import { LaunchBoxImporter } from "./components/LaunchBoxImporter/LaunchBoxImporter";
import { ManualGameModal } from "./components/ManualGame/ManualGameModal";
import { NotificationCenter } from "./components/NotificationCenter/NotificationCenter";
import { PlatformManager } from "./components/PlatformManager/PlatformManager";
import { RomFolderImporter } from "./components/RomFolderImporter/RomFolderImporter";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { TopBar } from "./components/TopBar/TopBar";
import { useGames } from "./hooks/useGames";
import { usePlatforms } from "./hooks/usePlatforms";
import { useGameStockStore } from "./store";

export default function App() {
  usePlatforms();
  useGames();
  const viewMode = useGameStockStore((state) => state.viewMode);
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  const collectionFilter = useGameStockStore((state) => state.collectionFilter);
  const sortBy = useGameStockStore((state) => state.sortBy);
  const setViewMode = useGameStockStore((state) => state.setViewMode);
  const setCollectionFilter = useGameStockStore((state) => state.setCollectionFilter);
  const setSortBy = useGameStockStore((state) => state.setSortBy);
  const setImporterOpen = useGameStockStore((state) => state.setImporterOpen);
  const setRomFolderImporterOpen = useGameStockStore((state) => state.setRomFolderImporterOpen);
  const setCreateGameOpen = useGameStockStore((state) => state.setCreateGameOpen);
  const setPlatformManagerOpen = useGameStockStore((state) => state.setPlatformManagerOpen);

  useEffect(() => window.gameStockAPI.view.onSet(setViewMode), [setViewMode]);
  useEffect(() => window.gameStockAPI.launchbox.onOpenImporter(() => setImporterOpen(true)), [setImporterOpen]);
  useEffect(() => window.gameStockAPI.romFolderImport.onOpenImporter(() => setRomFolderImporterOpen(true)), [setRomFolderImporterOpen]);
  useEffect(() => window.gameStockAPI.library.onOpenCreateGame(() => setCreateGameOpen(true)), [setCreateGameOpen]);
  useEffect(() => window.gameStockAPI.library.onOpenPlatformManager(() => setPlatformManagerOpen(true)), [setPlatformManagerOpen]);
  useEffect(() => window.gameStockAPI.library.onSetSort(setSortBy), [setSortBy]);

  return (
    <div className="app-shell">
      <TopBar />
      <div className="content-shell">
        <Sidebar />
        <main className="main-area">
          {selectedGameId ? (
            <GameDetail />
          ) : (
            <div className="home-content">
              <section className="library-header" aria-label="Filtros da biblioteca">
                <div className="library-tabs">
                  <button type="button" className={collectionFilter === "all" ? "active" : ""} onClick={() => setCollectionFilter("all")}>Todos os jogos</button>
                  <button type="button" className={collectionFilter === "favorites" ? "active" : ""} onClick={() => setCollectionFilter("favorites")}>Favoritos</button>
                  <button type="button" className={collectionFilter === "completed" ? "active" : ""} onClick={() => setCollectionFilter("completed")}>Concluidos</button>
                  <button type="button" className={collectionFilter === "unplayed" ? "active" : ""} onClick={() => setCollectionFilter("unplayed")}>Nao jogados</button>
                </div>
                <div className="sort-control">
                  <span>Ordenar por:</span>
                  <select aria-label="Ordenar biblioteca" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
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
          )}
        </main>
      </div>
      <LaunchBoxImporter />
      <RomFolderImporter />
      <ManualGameModal />
      <PlatformManager />
      <NotificationCenter />
      <button type="button" className="floating-add" aria-label="Novo jogo" onClick={() => setCreateGameOpen(true)}>
        <span className="material-symbols-outlined" aria-hidden="true">add</span>
      </button>
    </div>
  );
}
