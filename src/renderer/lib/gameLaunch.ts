/**
 * Utilitários do fluxo de launch de jogos.
 *
 * Centraliza a decisão entre:
 * - iniciar o jogo direto quando só existe uma versão jogável; ou
 * - abrir o modal de seleção quando há múltiplas variantes relacionadas.
 *
 * Isso evita duplicar a mesma lógica em grade, lista e detalhe.
 */

import { useGameStockStore } from "../store";

/** Resultado do fluxo de preparação do launch para a UI reagir sem ambiguidade. */
export type GameLaunchFlowResult = "launched" | "selection-required";

/**
 * Resolve o fluxo de launch de um jogo.
 * Se houver várias versões jogáveis, abre o modal global de seleção.
 */
export async function requestGameLaunch(gameId: number): Promise<GameLaunchFlowResult> {
  const versions = await window.gameStockAPI.games.listVersions(gameId);
  if (versions.length <= 1) {
    await window.gameStockAPI.games.launch(versions[0]?.id ?? gameId);
    useGameStockStore.getState().reloadGames();
    return "launched";
  }

  useGameStockStore.getState().openLaunchSelection(gameId, versions);
  return "selection-required";
}
