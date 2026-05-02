import { useEffect } from "react";
import { useGameStockStore } from "../store";

const PAGE_SIZE = 50;

export function useGames(): void {
  const selectedPlatformId = useGameStockStore((state) => state.selectedPlatformId);
  const searchQuery = useGameStockStore((state) => state.searchQuery);
  const collectionFilter = useGameStockStore((state) => state.collectionFilter);
  const sortBy = useGameStockStore((state) => state.sortBy);
  const onlyPhysical = useGameStockStore((state) => state.onlyPhysical);
  const currentPage = useGameStockStore((state) => state.currentPage);
  const reloadToken = useGameStockStore((state) => state.reloadToken);
  const setGames = useGameStockStore((state) => state.setGames);
  const setLoading = useGameStockStore((state) => state.setLoading);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    window.gameStockAPI.games
      .list({ platformId: selectedPlatformId, search: searchQuery, ownedPhysical: onlyPhysical, collectionFilter, sortBy, page: currentPage, pageSize: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) setGames(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPlatformId, searchQuery, collectionFilter, sortBy, onlyPhysical, currentPage, reloadToken, setGames, setLoading]);
}
