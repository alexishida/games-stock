import { useEffect } from "react";
import { X } from "lucide-react";
import { LaunchBoxImageType } from "../../../shared/types";
import { useDraggableDialog } from "../../hooks/useDraggableDialog";
import { useLaunchBoxImporter } from "../../hooks/useLaunchBoxImporter";
import { useGameStockStore } from "../../store";
import { ProgressBar } from "./ProgressBar";
import "./LaunchBoxImporter.css";

const imageTypes: LaunchBoxImageType[] = [
  "Box - Back",
  "Box - Front",
  "Cart - Front",
  "Fanart - Background",
  "Screenshot - Gameplay"
];

export function LaunchBoxImporter() {
  const importerOpen = useGameStockStore((state) => state.importerOpen);
  const setImporterOpen = useGameStockStore((state) => state.setImporterOpen);
  const platforms = useGameStockStore((state) => state.platforms);
  const importer = useLaunchBoxImporter();
  const draggable = useDraggableDialog<HTMLElement>();

  useEffect(() => {
    if (importerOpen) void importer.ensure();
  }, [importerOpen]);

  if (!importerOpen) return null;

  return (
    <div className="modal-backdrop">
      <section
        ref={draggable.dialogRef}
        className="importer-modal draggable-modal"
        style={draggable.style}
        onPointerDown={draggable.startDialogDrag}
        onPointerMove={draggable.dragDialog}
        onPointerUp={draggable.stopDialogDrag}
        onPointerCancel={draggable.stopDialogDrag}
      >
        <header>
          <h2>Importar do LaunchBox</h2>
          <button type="button" className="icon-button modal-close-button" onClick={() => setImporterOpen(false)} aria-label="Fechar">
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <div className="importer-search">
          <input value={importer.query} onChange={(event) => importer.setQuery(event.target.value)} placeholder="Buscar jogo" />
          <select value={importer.platformName} onChange={(event) => importer.setPlatformName(event.target.value)}>
            <option value="">Todas plataformas</option>
            {platforms.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
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
