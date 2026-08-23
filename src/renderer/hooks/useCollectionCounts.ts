/**
 * Hook que mantém as contagens de jogos por coleção especial (favoritos, jogando, concluído)
 * sincronizadas com o banco de dados via IPC.
 *
 * Recarrega automaticamente sempre que o `reloadToken` do store for incrementado,
 * o que ocorre após qualquer operação que altere a biblioteca (importação, edição, etc.).
 */
import { useEffect } from "react";
import { useGameStockStore } from "../store";

export function useCollectionCounts(): void {
  // Observa filtros e token para manter ambas facetas sincronizadas com a lista.
  const reloadToken = useGameStockStore((state) => state.reloadToken);
  const selectedPlatformId = useGameStockStore((state) => state.selectedPlatformId);
  const searchQuery = useGameStockStore((state) => state.searchQuery);
  const selectedCategory = useGameStockStore((state) => state.selectedCategory);
  const collectionFilter = useGameStockStore((state) => state.collectionFilter);
  const showGamesWithoutCover = useGameStockStore((state) => state.showGamesWithoutCover);
  const setLibrarySidebarCounts = useGameStockStore((state) => state.setLibrarySidebarCounts);

  useEffect(() => {
    // Query facetada evita que um menu ignore a seleção feita no outro.
    let cancelled = false;
    void window.gameStockAPI.games.sidebarCounts({
      platformId: selectedPlatformId,
      search: searchQuery,
      genre: selectedCategory,
      collectionFilter,
      includeMissingCovers: showGamesWithoutCover
    })
      .then((counts) => { if (!cancelled) setLibrarySidebarCounts(counts); })
      .catch((cause: unknown) => {
        // Preserva contagens anteriores se SQLite/IPC falhar temporariamente.
        console.error("Falha ao carregar contagens da coleção", cause);
      });
    return () => { cancelled = true; };
  }, [reloadToken, selectedPlatformId, searchQuery, selectedCategory, collectionFilter, showGamesWithoutCover, setLibrarySidebarCounts]);
}
