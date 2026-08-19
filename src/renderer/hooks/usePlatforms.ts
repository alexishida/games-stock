/**
 * Hook que mantém a lista de plataformas no store Zustand sincronizada com o banco de dados.
 *
 * Recarrega automaticamente sempre que o `platformsReloadToken` for incrementado,
 * o que ocorre após importações ou alterações de plataformas.
 * A lista é ordenada alfabeticamente em pt-BR, insensível a maiúsculas/minúsculas.
 */
import { useEffect } from "react";
import { useGameStockStore } from "../store";

export function usePlatforms(): void {
  const setPlatforms = useGameStockStore((state) => state.setPlatforms);
  // Token que dispara recarga quando incrementado (ex.: após importar plataforma nova)
  const platformsReloadToken = useGameStockStore((state) => state.platformsReloadToken);

  useEffect(() => {
    // Busca plataformas via IPC e ordena pelo nome em pt-BR antes de armazenar no store
    let cancelled = false;
    void window.gameStockAPI.platforms.list()
      .then((list) => {
        if (!cancelled) setPlatforms([...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })));
      })
      .catch((cause: unknown) => {
        // Não apaga lista já exibida em falha transitória de IPC.
        console.error("Falha ao carregar plataformas", cause);
      });
    return () => { cancelled = true; };
  }, [platformsReloadToken, setPlatforms]);
}
