/**
 * LaunchBoxImporter.tsx
 *
 * Modal de importação de jogos e imagens a partir do banco de dados do LaunchBox.
 * Permite buscar jogos por título e plataforma, selecionar tipos de imagem a importar
 * e iniciar o processo de download. Exibe barra de progresso em tempo real durante
 * a importação. É arrastável dentro da janela principal.
 */

import { useEffect } from "react";
import { X } from "lucide-react";
import { LaunchBoxImageType } from "../../../shared/types";
import { useDraggableDialog } from "../../hooks/useDraggableDialog";
import { useLaunchBoxImporter } from "../../hooks/useLaunchBoxImporter";
import { useGameStockStore } from "../../store";
import { ProgressBar } from "./ProgressBar";
import "./LaunchBoxImporter.css";

/**
 * Tipos de imagem suportados para importação do LaunchBox.
 * Cada opção corresponde a uma categoria de arte disponível no banco de dados LaunchBox.
 */
const imageTypes: LaunchBoxImageType[] = [
  "Box - Back",
  "Box - Front",
  "Cart - Front",
  "Fanart - Background",
  "Screenshot - Gameplay"
];

/**
 * Renderiza o modal de importação do LaunchBox.
 * O modal só é montado quando `importerOpen` está ativo no store global.
 * Ao abrir, garante que os dados do LaunchBox estejam carregados via `importer.ensure()`.
 */
export function LaunchBoxImporter() {
  // Flag que controla a visibilidade do modal no store global
  const importerOpen = useGameStockStore((state) => state.importerOpen);
  // Ação para abrir/fechar o modal de importação
  const setImporterOpen = useGameStockStore((state) => state.setImporterOpen);
  // Lista de plataformas cadastradas, usada para filtrar a busca por plataforma
  const platforms = useGameStockStore((state) => state.platforms);

  // Hook com toda a lógica de busca, seleção e importação do LaunchBox
  const importer = useLaunchBoxImporter();
  // Hook que fornece ref, style e handlers para tornar o modal arrastável
  const draggable = useDraggableDialog<HTMLElement>();

  /**
   * Ao abrir o modal, garante que os dados do LaunchBox estejam disponíveis
   * (carregando-os se necessário). Não executa nada ao fechar.
   */
  useEffect(() => {
    if (importerOpen) void importer.ensure();
  }, [importerOpen]);

  // Não renderiza nada enquanto o modal estiver fechado
  if (!importerOpen) return null;

  return (
    // Backdrop semi-transparente que cobre toda a área da janela principal
    <div className="modal-backdrop">
      {/* Seção principal do modal; recebe os handlers de drag para ser arrastável */}
      <section
        ref={draggable.dialogRef}
        className="importer-modal draggable-modal"
        style={draggable.style}
        onPointerDown={draggable.startDialogDrag}
        onPointerMove={draggable.dragDialog}
        onPointerUp={draggable.stopDialogDrag}
        onPointerCancel={draggable.stopDialogDrag}
      >
        {/* Cabeçalho com título do modal e botão de fechar */}
        <header>
          <h2>Importar do LaunchBox</h2>
          <button type="button" className="icon-button modal-close-button" onClick={() => setImporterOpen(false)} aria-label="Fechar">
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        {/* Barra de busca: campo de texto, filtro de plataforma e botão de buscar */}
        <div className="importer-search">
          <input value={importer.query} onChange={(event) => importer.setQuery(event.target.value)} placeholder="Buscar jogo" />
          <select value={importer.platformName} onChange={(event) => importer.setPlatformName(event.target.value)}>
            <option value="">Todas plataformas</option>
            {/* Opções geradas dinamicamente a partir das plataformas do store */}
            {platforms.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          <button type="button" className="text-button active" onClick={importer.search} disabled={importer.loading}>Buscar</button>
        </div>

        {/* Corpo do modal: lista de resultados à esquerda e seleção de tipos de imagem à direita */}
        <div className="importer-body">
          {/* Lista de jogos retornados pela busca */}
          <div className="result-list">
            {importer.results.map((game) => (
              // Botão de resultado; recebe classe "selected" quando é o jogo escolhido
              <button type="button" key={game.id} className={importer.selectedGame?.id === game.id ? "selected" : ""} onClick={() => importer.setSelectedGame(game)}>
                <strong>{game.name}</strong>
                <span>{game.platform} - {game.images.length} imagens</span>
              </button>
            ))}
          </div>

          {/* Checkboxes para selecionar quais tipos de imagem serão importados */}
          <div className="image-type-list">
            {imageTypes.map((type) => (
              <label key={type}>
                <input
                  type="checkbox"
                  checked={importer.selectedTypes.includes(type)}
                  onChange={(event) => {
                    // Adiciona o tipo à lista se marcado; remove se desmarcado
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

        {/* Barra de progresso da importação em andamento */}
        <ProgressBar progress={importer.progress} onProgress={importer.setProgress} />

        {/* Rodapé com botão de confirmar importação */}
        <footer>
          <button type="button" className="text-button active" disabled={!importer.selectedGame || importer.loading} onClick={importer.importSelected}>Importar</button>
        </footer>
      </section>
    </div>
  );
}
