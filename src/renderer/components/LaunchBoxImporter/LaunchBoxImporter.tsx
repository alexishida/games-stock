import { useEffect } from "react";
import { X } from "lucide-react";
import { LaunchBoxImageType } from "../../../shared/types";
import { useLaunchBoxImporter } from "../../hooks/useLaunchBoxImporter";
import { useGameStockStore } from "../../store";
import { ProgressBar } from "./ProgressBar";
import "./LaunchBoxImporter.css";

const platformEntries = [
  ["megadrive", "Mega Drive / Genesis"],
  ["snes", "SNES"],
  ["n64", "Nintendo 64"],
  ["nes", "NES"],
  ["gb", "Game Boy"],
  ["gba", "Game Boy Advance"],
  ["saturn", "Sega Saturn"]
];

const imageTypes: LaunchBoxImageType[] = ["Box - Front", "Box - Back", "Box - Spine", "Screenshot - Gameplay", "Fanart - Background", "Banner", "Clear Logo", "Disc", "Cart - Front", "Screenshot - Game Title"];

export function LaunchBoxImporter() {
  const importerOpen = useGameStockStore((state) => state.importerOpen);
  const setImporterOpen = useGameStockStore((state) => state.setImporterOpen);
  const importer = useLaunchBoxImporter();

  useEffect(() => {
    if (importerOpen) void importer.ensure();
  }, [importerOpen]);

  if (!importerOpen) return null;

  return (
    <div className="modal-backdrop">
      <section className="importer-modal">
        <header>
          <h2>Importar do LaunchBox</h2>
          <button type="button" className="icon-button modal-close-button" onClick={() => setImporterOpen(false)} aria-label="Fechar">
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <div className="importer-search">
          <input value={importer.query} onChange={(event) => importer.setQuery(event.target.value)} placeholder="Buscar jogo" />
          <select value={importer.platformKey} onChange={(event) => importer.setPlatformKey(event.target.value)}>
            <option value="">Todas plataformas</option>
            {platformEntries.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <button type="button" className="text-button active" onClick={importer.search} disabled={importer.loading}>Buscar</button>
        </div>
        <div className="importer-body">
          <div className="result-list">
            {importer.results.map((game) => (
              <button type="button" key={game.id} className={importer.selectedGame?.id === game.id ? "selected" : ""} onClick={() => importer.setSelectedGame(game)}>
                <strong>{game.name}</strong>
                <span>{game.platform} - {game.images.length} imagens</span>
              </button>
            ))}
          </div>
          <div className="image-type-list">
            {imageTypes.map((type) => (
              <label key={type}>
                <input
                  type="checkbox"
                  checked={importer.selectedTypes.includes(type)}
                  onChange={(event) => {
                    importer.setSelectedTypes(event.target.checked
                      ? [...importer.selectedTypes, type]
                      : importer.selectedTypes.filter((item) => item !== type));
                  }}
                />
                {type}
              </label>
            ))}
          </div>
        </div>
        <ProgressBar progress={importer.progress} onProgress={importer.setProgress} />
        <footer>
          <button type="button" className="text-button active" disabled={!importer.selectedGame || importer.loading} onClick={importer.importSelected}>Importar</button>
        </footer>
      </section>
    </div>
  );
}
