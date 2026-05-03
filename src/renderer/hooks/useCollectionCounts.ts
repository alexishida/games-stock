import { useEffect } from "react";
import { useGameStockStore } from "../store";

export function useCollectionCounts(): void {
  const reloadToken = useGameStockStore((state) => state.reloadToken);
  const setCollectionCounts = useGameStockStore((state) => state.setCollectionCounts);

  useEffect(() => {
    window.gameStockAPI.games.collectionCounts().then(setCollectionCounts);
  }, [reloadToken, setCollectionCounts]);
}
