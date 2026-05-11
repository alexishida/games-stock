/**
 * GameListRow.tsx
 *
 * Componente de linha individual na visualização em lista (GameList).
 * Exibe miniatura da capa, título, plataforma, gênero, publisher, ano,
 * indicadores de status (favorito, jogando, concluído) e botão de lançar.
 * Permite seleção por clique ou teclado.
 */

import { useState } from "react";
import { Gamepad2, Play, Star, Trophy } from "lucide-react";
import { Game } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { localMediaUrl } from "../../utils/media";

/**
 * Renderiza uma linha da lista de jogos com dados resumidos e ações rápidas.
 *
 * @param game - Objeto com os dados do jogo representado nesta linha.
 */
export function GameListRow({ game }: { game: Game }) {
  // ID do jogo atualmente selecionado no store global
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  // Ação para selecionar um jogo no store global
  const setSelectedGame = useGameStockStore((state) => state.setSelectedGame);

  // URL local da miniatura de capa do jogo (box art)
  const coverUrl = localMediaUrl(game.box_art_path);

  // Indica se a imagem de capa tem orientação paisagem (largura > altura)
  const [isLandscape, setIsLandscape] = useState(false);
  // Indica se o jogo está sendo lançado no momento
  const [launching, setLaunching] = useState(false);
  // Mensagem de erro exibida quando o lançamento falha
  const [launchError, setLaunchError] = useState("");

  // O jogo só pode ser lançado se possuir caminho de ROM configurado
  const canLaunch = Boolean(game.rom_path?.trim());

  /**
   * Solicita o lançamento do jogo via IPC.
   * Impede propagação do clique para não selecionar a linha ao mesmo tempo.
   */
  async function launch(e: React.MouseEvent): Promise<void> {
    e.stopPropagation();
    if (!canLaunch || launching) return;
    setLaunchError("");
    setLaunching(true);
    try {
      await window.gameStockAPI.games.launch(game.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao lançar jogo";
      setLaunchError(msg);
      // Remove a mensagem de erro automaticamente após 4 segundos
      setTimeout(() => setLaunchError(""), 4000);
    } finally {
      setLaunching(false);
    }
  }

  /** Seleciona este jogo como o jogo ativo no store. */
  function handleSelect(): void {
    setSelectedGame(game);
  }

  /**
   * Permite selecionar a linha via teclado (Enter ou Espaço),
   * garantindo acessibilidade para navegação por teclado.
   */
  function handleRowKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleSelect();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      // Aplica classe "selected" quando esta linha corresponde ao jogo selecionado
      className={selectedGameId === game.id ? "game-list-row selected" : "game-list-row"}
      onClick={handleSelect}
      onKeyDown={handleRowKeyDown}
    >
      {/* Miniatura da capa; classe "landscape" ajusta layout para imagens mais largas */}
      <span className={isLandscape ? "thumb landscape" : "thumb"}>
        {coverUrl
          ? <img
              src={coverUrl}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              onLoad={(e) => {
                // Detecta orientação da imagem para aplicar classe CSS adequada
                const img = e.currentTarget;
                setIsLandscape(img.naturalWidth > img.naturalHeight);
              }}
            />
          : /* Ícone de controle exibido quando não há imagem de capa */
            <Gamepad2 aria-hidden="true" size={22} />}
      </span>

      {/* Colunas de metadados do jogo */}
      <span className="col-title">{game.title}</span>
      <span className="col-meta">{game.platform_name}</span>
      <span className="col-meta col-genre">{game.genre ?? "—"}</span>
      <span className="col-meta">{game.publisher ?? "—"}</span>
      <span className="col-year">{game.year ?? "—"}</span>

      {/* Coluna de status: ícones de favorito, jogando e concluído */}
      <span className="col-status">
        {game.favorite && <Star size={13} fill="currentColor" className="icon-fav" aria-label="Favorito" />}
        {game.play_status === "playing" && <Gamepad2 size={13} className="icon-playing" aria-label="Jogando" />}
        {game.play_status === "completed" && <Trophy size={13} className="icon-completed" aria-label="Concluído" />}
      </span>

      {/* Coluna de ação: botão de lançar o jogo */}
      <span className="col-launch">
        <button
          type="button"
          className={`list-launch-btn${!canLaunch ? " disabled" : ""}${launching ? " launching" : ""}`}
          // Tooltip reflete erro recente ou motivo de impedimento (ROM ausente)
          title={launchError || (canLaunch ? "Jogar" : "ROM não configurada")}
          disabled={!canLaunch || launching}
          onClick={launch}
          aria-label="Jogar"
        >
          <Play size={12} fill="currentColor" aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}
