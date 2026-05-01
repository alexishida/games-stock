import { useEffect } from "react";
import { GameDetail } from "./components/GameDetail/GameDetail";
import { GameGrid } from "./components/GameGrid/GameGrid";
import { GameList } from "./components/GameList/GameList";
import { LaunchBoxImporter } from "./components/LaunchBoxImporter/LaunchBoxImporter";
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
  const setViewMode = useGameStockStore((state) => state.setViewMode);
  const setImporterOpen = useGameStockStore((state) => state.setImporterOpen);

  useEffect(() => window.gameStockAPI.view.onSet(setViewMode), [setViewMode]);
  useEffect(() => window.gameStockAPI.launchbox.onOpenImporter(() => setImporterOpen(true)), [setImporterOpen]);

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
                  <button type="button" className="active">Todos os jogos</button>
                  <button type="button">Favoritos</button>
                  <button type="button">Concluidos</button>
                  <button type="button">Nao jogados</button>
                </div>
                <div className="sort-control">
                  <span>Ordenar por:</span>
                  <select aria-label="Ordenar biblioteca">
                    <option>A-Z</option>
                    <option>Ano</option>
                    <option>Recentes</option>
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
      <button type="button" className="floating-add" aria-label="Importar jogos" onClick={() => setImporterOpen(true)}>
        <span className="material-symbols-outlined" aria-hidden="true">add</span>
      </button>
    </div>
  );
}
