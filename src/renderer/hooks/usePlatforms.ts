import { useEffect } from "react";
import { useGameStockStore } from "../store";

export function usePlatforms(): void {
  const setPlatforms = useGameStockStore((state) => state.setPlatforms);
  const platformsReloadToken = useGameStockStore((state) => state.platformsReloadToken);

  useEffect(() => {
    window.gameStockAPI.platforms.list().then(setPlatforms);
  }, [platformsReloadToken, setPlatforms]);
}
