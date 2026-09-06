/**
 * Hook de leitura do inventário de cores instalados no RetroArch.
 *
 * Centraliza recarga inicial, atualização manual e nova leitura quando a janela
 * volta ao foco após o usuário instalar cores pelo próprio RetroArch.
 */

import { useCallback, useEffect, useState } from "react";
import type { RetroArchCoreInventory } from "../../../shared/types";

/**
 * Mantém inventário de cores sincronizado enquanto uma interface RetroArch está aberta.
 * Falha de inventário não interfere nos vínculos de plataforma já carregados.
 */
export function useRetroArchCoreInventory(emulatorId: number, enabled: boolean) {
  const [inventory, setInventory] = useState<RetroArchCoreInventory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  /** Solicita nova leitura sem reaproveitar resultado anterior do renderer. */
  const reload = useCallback((): void => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setInventory(null);
      setError("");
      return;
    }

    let active = true;
    setLoading(true);
    setError("");
    void window.gameStockAPI.emulators.listRetroArchCores(emulatorId)
      .then((nextInventory) => {
        if (active) setInventory(nextInventory);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a lista de cores");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [emulatorId, enabled, reloadToken]);

  useEffect(() => {
    if (!enabled) return;
    // Core Updater roda fora desta janela; foco indica momento certo para reler a pasta.
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [enabled, reload]);

  return { inventory, loading, error, reload };
}
