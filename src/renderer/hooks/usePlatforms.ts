import { useEffect } from "react";
import { useGameStockStore } from "../store";

export function usePlatforms(): void {
  const setPlatforms = useGameStockStore((state) => state.setPlatforms);

  useEffect(() => {
    window.gameStockAPI.platforms.list().then(setPlatforms);
  }, [setPlatforms]);
}
