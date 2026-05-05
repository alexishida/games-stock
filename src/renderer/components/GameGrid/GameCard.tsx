import { useEffect, useState } from "react";
import { Play, Star } from "lucide-react";
import { Game, PlatformEmulator } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { localMediaUrl } from "../../utils/media";
import { GameCardPlaceholder } from "./GameCardPlaceholder";

export function GameCard({ game }: { game: Game }) {
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  const selectGame = useGameStockStore((state) => state.selectGame);
  const upsertGame = useGameStockStore((state) => state.upsertGame);
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const platformsReloadToken = useGameStockStore((state) => state.platformsReloadToken);
  const coverUrl = localMediaUrl(game.box_art_path);
  const [isLandscape, setIsLandscape] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [defaultEmulator, setDefaultEmulator] = useState<PlatformEmulator | null>(null);
  const [emulatorLoading, setEmulatorLoading] = useState(false);

  useEffect(() => {
    let canceled = false;
    setDefaultEmulator(null);

    if (!game.platform_id) {
      setEmulatorLoading(false);
      return undefined;
    }

    setEmulatorLoading(true);
    window.gameStockAPI.emulators
      .listByPlatform(game.platform_id)
      .then((items) => {
        if (!canceled) setDefaultEmulator(items.find((item) => item.is_default === 1) ?? null);
      })
      .catch(() => {
        if (!canceled) setDefaultEmulator(null);
      })
      .finally(() => {
        if (!canceled) setEmulatorLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [game.platform_id, platformsReloadToken]);

  const hasRom = Boolean(game.rom_path?.trim());
  const hasDefaultEmulator = Boolean(defaultEmulator);
  const canLaunch = hasRom && hasDefaultEmulator && !emulatorLoading;

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
      setTimeout(() => setLaunchError(""), 4000);
    } finally {
      setLaunching(false);
    }
  }

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

  const classes = [
    "game-card",
    selectedGameId === game.id ? "selected" : "",
    isLandscape ? "landscape" : ""
  ].filter(Boolean).join(" ");

  function handleSelect(): void {
    selectGame(game);
  }

  function handleCardKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleSelect();
  }

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
            <Play size={13} fill="currentColor" aria-hidden="true" />
          </button>
        </div>
        {launchError && <div className="card-launch-error">{launchError}</div>}
      </div>
    </div>
  );
}
