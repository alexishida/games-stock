import { useState } from "react";
import { CircleCheck, Gamepad2, Play, Star } from "lucide-react";
import { Game } from "../../../shared/types";
import { useGameStockStore } from "../../store";
import { localMediaUrl } from "../../utils/media";

export function GameListRow({ game }: { game: Game }) {
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  const setSelectedGameId = useGameStockStore((state) => state.setSelectedGameId);
  const coverUrl = localMediaUrl(game.box_art_path);
  const [isLandscape, setIsLandscape] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState("");

  const canLaunch = Boolean(game.rom_path?.trim());

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
      setTimeout(() => setLaunchError(""), 4000);
    } finally {
      setLaunching(false);
    }
  }

  return (
    <button
      type="button"
      className={selectedGameId === game.id ? "game-list-row selected" : "game-list-row"}
      onClick={() => setSelectedGameId(game.id)}
    >
      <span className={isLandscape ? "thumb landscape" : "thumb"}>
        {coverUrl
          ? <img
              src={coverUrl}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                setIsLandscape(img.naturalWidth > img.naturalHeight);
              }}
            />
          : <Gamepad2 aria-hidden="true" size={22} />}
      </span>
      <span className="col-title">{game.title}</span>
      <span className="col-meta">{game.platform_name}</span>
      <span className="col-meta col-genre">{game.genre ?? "—"}</span>
      <span className="col-meta">{game.publisher ?? "—"}</span>
      <span className="col-year">{game.year ?? "—"}</span>
      <span className="col-status">
        {game.favorite && <Star size={13} fill="currentColor" className="icon-fav" aria-label="Favorito" />}
        {game.play_status === "playing" && <Gamepad2 size={13} className="icon-playing" aria-label="Jogando" />}
        {game.play_status === "completed" && <CircleCheck size={13} className="icon-completed" aria-label="Concluído" />}
      </span>
      <span className="col-launch">
        <button
          type="button"
          className={`list-launch-btn${!canLaunch ? " disabled" : ""}${launching ? " launching" : ""}`}
          title={launchError || (canLaunch ? "Jogar" : "ROM não configurada")}
          disabled={!canLaunch || launching}
          onClick={launch}
          aria-label="Jogar"
        >
          <Play size={12} fill="currentColor" aria-hidden="true" />
        </button>
      </span>
    </button>
  );
}
