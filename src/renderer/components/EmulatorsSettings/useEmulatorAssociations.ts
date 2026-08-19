/**
 * Estado e operações dos vínculos de um emulador.
 *
 * Mantém carregamento IPC em lote fora do componente visual da linha.
 */

import { useCallback, useEffect, useState } from "react";
import type { Emulator, Platform, PlatformEmulator } from "../../../shared/types";

/** Gerencia expansão, leitura e remoção de vínculos do emulador informado. */
export function useEmulatorAssociations(emulator: Emulator, platforms: Platform[], onReload: () => void) {
  const [associations, setAssociations] = useState<PlatformEmulator[]>([]);
  const [expanded, setExpanded] = useState(false);

  /** Carrega vínculos uma vez para todas as plataformas visíveis. */
  const loadAssociations = useCallback(async (): Promise<void> => {
    const linksByPlatform = await window.gameStockAPI.emulators.listByPlatforms(platforms.map((platform) => platform.id));
    const links = platforms.flatMap((platform) => (linksByPlatform[platform.id] ?? [])
      .filter((link) => link.emulator_id === emulator.id)
      .map((link) => ({ ...link, emulator })));
    setAssociations(links);
  }, [emulator, platforms]);

  useEffect(() => {
    if (expanded) void loadAssociations();
  }, [expanded, loadAssociations]);

  /** Remove vínculo e atualiza somente dados afetados. */
  const unlink = useCallback(async (platformId: number): Promise<void> => {
    await window.gameStockAPI.emulators.unlinkPlatform(emulator.id, platformId);
    await loadAssociations();
    onReload();
  }, [emulator.id, loadAssociations, onReload]);

  return { associations, expanded, setExpanded, loadAssociations, unlink };
}
