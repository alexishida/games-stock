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
  // Observa o token de recarga para re-executar a query quando a biblioteca mudar
  const reloadToken = useGameStockStore((state) => state.reloadToken);
  const setCollectionCounts = useGameStockStore((state) => state.setCollectionCounts);

  useEffect(() => {
    // Busca contagens atualizadas via IPC e atualiza o store
    let cancelled = false;
    void window.gameStockAPI.games.collectionCounts()
      .then((counts) => { if (!cancelled) setCollectionCounts(counts); })
      .catch((cause: unknown) => {
        // Preserva contagens anteriores se SQLite/IPC falhar temporariamente.
        console.error("Falha ao carregar contagens da coleção", cause);
      });
    return () => { cancelled = true; };
  }, [reloadToken, setCollectionCounts]);
}
