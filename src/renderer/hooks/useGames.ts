import { useEffect } from "react";
import { useGameStockStore } from "../store";

export function useGames(): void {
  const selectedPlatformId = useGameStockStore((state) => state.selectedPlatformId);
  const searchQuery = useGameStockStore((state) => state.searchQuery);
  const collectionFilter = useGameStockStore((state) => state.collectionFilter);
  const sortBy = useGameStockStore((state) => state.sortBy);
  const onlyPhysical = useGameStockStore((state) => state.onlyPhysical);
  const reloadToken = useGameStockStore((state) => state.reloadToken);
  const setGames = useGameStockStore((state) => state.setGames);
  const setLoading = useGameStockStore((state) => state.setLoading);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    window.gameStockAPI.games
      .list({ platformId: selectedPlatformId, search: searchQuery, ownedPhysical: onlyPhysical, collectionFilter, sortBy })
      .then((result) => {
        if (!cancelled) setGames(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPlatformId, searchQuery, collectionFilter, sortBy, onlyPhysical, reloadToken, setGames, setLoading]);
}
