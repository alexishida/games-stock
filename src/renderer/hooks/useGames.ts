import { useEffect } from "react";
import { GameFilters, GameListResult } from "../../shared/types";
import { useGameStockStore } from "../store";

const PAGE_SIZE = 50;
const pageCache = new Map<string, GameListResult>();

function buildFilters(params: {
  selectedPlatformId: number | null;
  searchQuery: string;
  collectionFilter: GameFilters["collectionFilter"];
  sortBy: GameFilters["sortBy"];
  currentPage: number;
}): GameFilters {
  return {
    platformId: params.selectedPlatformId,
    search: params.searchQuery,
    collectionFilter: params.collectionFilter,
    sortBy: params.sortBy,
    page: params.currentPage,
    pageSize: PAGE_SIZE
  };
}

function cacheKey(filters: GameFilters, reloadToken: number): string {
  return JSON.stringify({ ...filters, reloadToken });
}

function prefetchPage(filters: GameFilters, reloadToken: number): void {
  const key = cacheKey(filters, reloadToken);
  if (pageCache.has(key)) return;

  window.setTimeout(() => {
    window.gameStockAPI.games.list(filters).then((result) => {
      pageCache.set(key, result);
    });
  }, 250);
}

export function useGames(): void {
  const selectedPlatformId = useGameStockStore((state) => state.selectedPlatformId);
  const searchQuery = useGameStockStore((state) => state.searchQuery);
  const collectionFilter = useGameStockStore((state) => state.collectionFilter);
  const sortBy = useGameStockStore((state) => state.sortBy);
  const currentPage = useGameStockStore((state) => state.currentPage);
  const reloadToken = useGameStockStore((state) => state.reloadToken);
  const setGames = useGameStockStore((state) => state.setGames);
  const setLoading = useGameStockStore((state) => state.setLoading);

  useEffect(() => {
    let cancelled = false;
    const filters = buildFilters({ selectedPlatformId, searchQuery, collectionFilter, sortBy, currentPage });
    const key = cacheKey(filters, reloadToken);
    const cached = pageCache.get(key);

    if (cached) {
      setGames(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    window.gameStockAPI.games
      .list(filters)
      .then((result) => {
        pageCache.set(key, result);
        if (!cancelled) {
          setGames(result);

          const totalPages = Math.ceil(result.filtered / PAGE_SIZE);
          if (currentPage < totalPages) {
            prefetchPage({ ...filters, page: currentPage + 1 }, reloadToken);
          }
          if (currentPage > 1) {
            prefetchPage({ ...filters, page: currentPage - 1 }, reloadToken);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPlatformId, searchQuery, collectionFilter, sortBy, currentPage, reloadToken, setGames, setLoading]);
}
