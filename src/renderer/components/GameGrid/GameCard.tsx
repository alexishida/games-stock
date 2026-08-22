/**
 * GameCard.tsx
 *
 * Card individual da grade de jogos.
 * Exibe capa, titulo, plataforma e acoes rapidas. O emulador padrao chega
 * do GameGrid para evitar uma chamada IPC por card.
 */
import { memo, useState } from "react";
import { LoaderCircle, Play, Star } from "lucide-react";
import type { Game, PlatformEmulator } from "../../../shared/types";
import { requestGameLaunch } from "../../lib/gameLaunch";
import { useGameStockStore } from "../../store";
import { localMediaUrl } from "../../utils/media";
import { GameCardPlaceholder } from "./GameCardPlaceholder";

/** Props do card de jogo exibido na grade principal. */
interface GameCardProps {
  /** Jogo representado pelo card. */
  game: Game;
  /** Emulador padrao da plataforma, carregado no componente pai. */
  defaultEmulator: PlatformEmulator | null;
  /** Indica se a plataforma do card ainda esta consultando emulador padrao. */
  defaultEmulatorLoading: boolean;
}

/**
 * Exibe o card de um jogo na grade.
 *
 * Memo evita renderizacao vinda do pai quando o objeto do jogo e os metadados
 * de emulador permanecem iguais.
 */
export const GameCard = memo(function GameCard({
  game,
  defaultEmulator,
  defaultEmulatorLoading
}: GameCardProps) {
  // Booleano derivado reduz re-render: so muda no card selecionado e no anterior
  const selected = useGameStockStore((state) => state.selectedGameId === game.id);
  // Acao para selecionar um jogo no store global
  const setSelectedGame = useGameStockStore((state) => state.setSelectedGame);
  // Acao para atualizar um jogo ja existente no store ao favoritar/desfavoritar
  const upsertGame = useGameStockStore((state) => state.upsertGame);
  // Recarrega a lista para refletir filtros de colecao apos favoritar
  const reloadGames = useGameStockStore((state) => state.reloadGames);

  // URL local da imagem de capa do jogo
  const coverUrl = localMediaUrl(game.box_art_path);

  // Indica se a imagem de capa tem orientacao paisagem
  const [isLandscape, setIsLandscape] = useState(false);
  // Indica se o jogo esta sendo lancado no momento
  const [launching, setLaunching] = useState(false);
  // Mensagem de erro exibida quando o lancamento falha
  const [launchError, setLaunchError] = useState("");
  // Indica se a operacao de favoritar/desfavoritar esta em andamento
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  // Verifica se o jogo tem ROM configurada
  const hasRom = Boolean(game.rom_path?.trim());
  // Verifica se existe emulador padrao definido para a plataforma
  const hasDefaultEmulator = Boolean(defaultEmulator);
  // O jogo so pode ser lancado quando ROM e emulador padrao estao prontos
  const canLaunch = hasRom && hasDefaultEmulator && !defaultEmulatorLoading;

  /**
   * Solicita o lancamento do jogo via IPC.
   * Impede propagacao para nao selecionar o card junto com o clique no botao.
   */
  async function launch(event: React.MouseEvent): Promise<void> {
    event.stopPropagation();
    if (!canLaunch || launching) return;
    setLaunchError("");
    setLaunching(true);
    try {
      const result = await requestGameLaunch(game.id);
      if (result === "selection-required") return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao lançar jogo";
      setLaunchError(msg);
      // Remove a mensagem temporaria depois de alguns segundos
      setTimeout(() => setLaunchError(""), 4000);
    } finally {
      setLaunching(false);
    }
  }

  /**
   * Alterna o favorito do jogo via IPC e atualiza o store local.
   * A recarga mantem filtros e contagens coerentes.
   */
  async function toggleFavorite(event: React.MouseEvent): Promise<void> {
    event.stopPropagation();
    if (favoriteLoading) return;
    setFavoriteLoading(true);
    try {
      const updated = await window.gameStockAPI.games.update(game.id, { favorite: !game.favorite });
      upsertGame(updated);
      reloadGames();
    } finally {
      setFavoriteLoading(false);
    }
  }

  // Classes estaveis do card com estados visuais derivados
  const classes = [
    "game-card",
    selected ? "selected" : "",
    isLandscape ? "landscape" : ""
  ].filter(Boolean).join(" ");

  /** Seleciona este jogo como ativo no store. */
  function handleSelect(): void {
    setSelectedGame(game);
  }

  /** Permite selecionar o card via teclado com Enter ou Espaco. */
  function handleCardKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleSelect();
  }

  /** Retorna o tooltip do botao de jogar conforme disponibilidade atual. */
  function getLaunchTitle(): string {
    if (launchError) return launchError;
    if (!hasRom) return "ROM não configurada";
    if (defaultEmulatorLoading) return "Verificando emulador da plataforma";
    if (!defaultEmulator) return "Escolha um emulador padrão para esta plataforma";
    return `Jogar com ${defaultEmulator.emulator?.name ?? "emulador padrão"}`;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={classes}
      onClick={handleSelect}
      onKeyDown={handleCardKeyDown}
    >
      <div className="cover-frame">
        {coverUrl
          ? <img
              src={coverUrl}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              onLoad={(event) => {
                const img = event.currentTarget;
                setIsLandscape(img.naturalWidth > img.naturalHeight);
              }}
            />
          : <GameCardPlaceholder />
        }
        <div className="card-gradient" />
        <div className="card-copy">
          <span className="card-platform">{game.platform_name ?? "Sem plataforma"}</span>
          <strong>{game.title}</strong>
        </div>
        {game.favorite && (
          <div className="card-favorite-indicator" aria-label="Favorito" title="Favorito">
            <Star size={18} fill="#facc15" color="#facc15" aria-hidden="true" />
          </div>
        )}
        <div className="card-hover-actions">
          <button
            type="button"
            className={`card-action-btn card-favorite-btn${game.favorite ? " active" : ""}`}
            title={game.favorite ? "Remover favorito" : "Marcar favorito"}
            disabled={favoriteLoading}
            onClick={toggleFavorite}
            aria-label={game.favorite ? "Remover favorito" : "Marcar favorito"}
          >
            <Star size={14} fill={game.favorite ? "#facc15" : "none"} color={game.favorite ? "#facc15" : undefined} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`card-action-btn card-launch-btn${!canLaunch ? " disabled" : ""}${launching ? " launching" : ""}`}
            title={getLaunchTitle()}
            disabled={!canLaunch || launching}
            onClick={launch}
            aria-label="Jogar"
          >
            {/* Spinner deixa claro que launch ainda aguarda início do processo do emulador. */}
            {launching ? <LoaderCircle size={14} className="card-launch-spinner" aria-hidden="true" /> : <Play size={13} fill="currentColor" aria-hidden="true" />}
          </button>
        </div>
        {launchError && <div className="card-launch-error">{launchError}</div>}
      </div>
    </div>
  );
});
