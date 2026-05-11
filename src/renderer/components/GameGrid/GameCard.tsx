/**
 * GameCard.tsx
 *
 * Componente de card individual exibido na visualização em grade (GameGrid).
 * Cada card representa um jogo da biblioteca, exibindo capa, título, plataforma
 * e ações de lançar e favoritar. Consulta o emulador padrão da plataforma via IPC
 * para determinar se o jogo pode ser iniciado.
 */

import { useEffect, useState } from "react";
import { Play, Star } from "lucide-react";
import { Game, PlatformEmulator } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { localMediaUrl } from "../../utils/media";
import { GameCardPlaceholder } from "./GameCardPlaceholder";

/**
 * Exibe o card de um jogo na grade.
 *
 * @param game - Objeto com os dados do jogo a ser exibido.
 */
export function GameCard({ game }: { game: Game }) {
  // ID do jogo atualmente selecionado no store global
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  // Ação para selecionar um jogo no store global
  const setSelectedGame = useGameStockStore((state) => state.setSelectedGame);
  // Ação para atualizar um jogo já existente no store (usado ao favoritar/desfavoritar)
  const upsertGame = useGameStockStore((state) => state.upsertGame);
  // Ação para recarregar a lista de jogos do banco de dados
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  // Token que muda sempre que as plataformas são atualizadas; usado para forçar
  // o re-carregamento do emulador padrão ao detectar mudanças de configuração
  const platformsReloadToken = useGameStockStore((state) => state.platformsReloadToken);

  // URL local da imagem de capa do jogo (box art)
  const coverUrl = localMediaUrl(game.box_art_path);

  // Indica se a imagem de capa tem orientação paisagem (largura > altura)
  const [isLandscape, setIsLandscape] = useState(false);
  // Indica se o jogo está sendo lançado no momento
  const [launching, setLaunching] = useState(false);
  // Mensagem de erro exibida quando o lançamento falha
  const [launchError, setLaunchError] = useState("");
  // Indica se a operação de favoritar/desfavoritar está em andamento
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  // Emulador padrão configurado para a plataforma do jogo (null se não houver)
  const [defaultEmulator, setDefaultEmulator] = useState<PlatformEmulator | null>(null);
  // Indica se a consulta ao emulador padrão ainda está carregando
  const [emulatorLoading, setEmulatorLoading] = useState(false);

  /**
   * Busca o emulador padrão para a plataforma do jogo sempre que o platform_id
   * ou o platformsReloadToken mudar. Cancela a atualização de estado caso o
   * componente seja desmontado antes da resposta chegar (cleanup via flag `canceled`).
   */
  useEffect(() => {
    let canceled = false;
    setDefaultEmulator(null);

    // Se o jogo não tem plataforma associada, não há emulador a carregar
    if (!game.platform_id) {
      setEmulatorLoading(false);
      return undefined;
    }

    setEmulatorLoading(true);
    window.gameStockAPI.emulators
      .listByPlatform(game.platform_id)
      .then((items) => {
        // Seleciona o primeiro emulador marcado como padrão, ou null se não houver
        if (!canceled) setDefaultEmulator(items.find((item) => item.is_default === 1) ?? null);
      })
      .catch(() => {
        if (!canceled) setDefaultEmulator(null);
      })
      .finally(() => {
        if (!canceled) setEmulatorLoading(false);
      });

    // Cleanup: cancela atualizações de estado de chamadas antigas
    return () => {
      canceled = true;
    };
  }, [game.platform_id, platformsReloadToken]);

  // Verifica se o jogo tem ROM configurada (caminho não vazio)
  const hasRom = Boolean(game.rom_path?.trim());
  // Verifica se existe emulador padrão definido para a plataforma
  const hasDefaultEmulator = Boolean(defaultEmulator);
  // O jogo só pode ser lançado se tiver ROM, emulador padrão e a consulta já tiver finalizado
  const canLaunch = hasRom && hasDefaultEmulator && !emulatorLoading;

  /**
   * Solicita o lançamento do jogo via IPC.
   * Impede propagação do clique para não selecionar o card ao mesmo tempo.
   */
  async function launch(event: React.MouseEvent): Promise<void> {
    event.stopPropagation();
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

  /**
   * Alterna o status de favorito do jogo via IPC e atualiza o store.
   * Impede propagação do clique para não selecionar o card ao mesmo tempo.
   */
  async function toggleFavorite(event: React.MouseEvent): Promise<void> {
    event.stopPropagation();
    if (favoriteLoading) return;
    setFavoriteLoading(true);
    try {
      // Inverte o valor atual de `favorite` e persiste via IPC
      const updated = await window.gameStockAPI.games.update(game.id, { favorite: !game.favorite });
      // Atualiza o jogo no store sem recarregar a lista inteira
      upsertGame(updated);
      // Recarrega a lista para refletir filtros de favoritos, se ativos
      reloadGames();
    } finally {
      setFavoriteLoading(false);
    }
  }

  // Monta a string de classes CSS do card com base no estado atual
  const classes = [
    "game-card",
    selectedGameId === game.id ? "selected" : "",  // Destaca o card selecionado
    isLandscape ? "landscape" : ""                  // Ajusta layout para capa no modo paisagem
  ].filter(Boolean).join(" ");

  /** Seleciona este jogo como o jogo ativo no store. */
  function handleSelect(): void {
    setSelectedGame(game);
  }

  /**
   * Permite selecionar o card via teclado (Enter ou Espaço),
   * garantindo acessibilidade para navegação por teclado.
   */
  function handleCardKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleSelect();
  }

  /**
   * Retorna o texto de tooltip do botão de lançar, refletindo o estado atual:
   * erro, ROM ausente, emulador carregando, emulador ausente ou pronto para jogar.
   */
  function getLaunchTitle(): string {
    if (launchError) return launchError;
    if (!hasRom) return "ROM não configurada";
    if (emulatorLoading) return "Verificando emulador da plataforma";
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
        {/* Exibe a capa do jogo se disponível; caso contrário, exibe o placeholder */}
        {coverUrl
          ? <img
              src={coverUrl}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              onLoad={(event) => {
                // Detecta orientação da imagem para aplicar classe CSS adequada
                const img = event.currentTarget;
                setIsLandscape(img.naturalWidth > img.naturalHeight);
              }}
            />
          : <GameCardPlaceholder />
        }
        {/* Gradiente visual sobreposto à capa para legibilidade do texto */}
        <div className="card-gradient" />
        {/* Nome da plataforma e título do jogo sobrepostos na parte inferior do card */}
        <div className="card-copy">
          <span className="card-platform">{game.platform_name ?? "Sem plataforma"}</span>
          <strong>{game.title}</strong>
        </div>
        {/* Indicador de favorito exibido no canto do card quando o jogo é favorito */}
        {game.favorite && (
          <div className="card-favorite-indicator" aria-label="Favorito" title="Favorito">
            <Star size={18} fill="#facc15" color="#facc15" aria-hidden="true" />
          </div>
        )}
        {/* Ações exibidas ao passar o mouse sobre o card */}
        <div className="card-hover-actions">
          {/* Botão de favoritar/desfavoritar */}
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
          {/* Botão de lançar o jogo; desabilitado se não puder iniciar */}
          <button
            type="button"
            className={`card-action-btn card-launch-btn${!canLaunch ? " disabled" : ""}${launching ? " launching" : ""}`}
            title={getLaunchTitle()}
            disabled={!canLaunch || launching}
            onClick={launch}
            aria-label="Jogar"
          >
            <Play size={13} fill="currentColor" aria-hidden="true" />
          </button>
        </div>
        {/* Mensagem de erro de lançamento exibida temporariamente sobre o card */}
        {launchError && <div className="card-launch-error">{launchError}</div>}
      </div>
    </div>
  );
}
