/**
 * GameGrid.tsx
 *
 * Componente de visualização em grade da biblioteca de jogos.
 * Lê a lista de jogos do store global e renderiza um GameCard para cada jogo.
 * Exibe mensagem de estado vazio quando não há jogos correspondentes aos filtros ativos.
 * Inclui o componente de Pagination ao final da grade.
 */

import { useEffect, useMemo, useState } from "react";
import type { PlatformEmulator } from "../../../shared/types";
import { loadDefaultPlatformEmulators } from "../../lib/defaultEmulators";
import { useGameStockStore } from "../../store";
import { Pagination } from "../Pagination/Pagination";
import { GameCard } from "./GameCard";
import "./GameGrid.css";

/**
 * Renderiza a grade de cards de jogos da biblioteca.
 * Exibe mensagem de estado vazio quando a lista está vazia.
 */
export function GameGrid() {
  // Lista de jogos da página atual, já filtrada e paginada pelo store
  const games = useGameStockStore((state) => state.games);
  // Token usado para invalidar o cache quando vinculos de plataforma/emulador mudam
  const platformsReloadToken = useGameStockStore((state) => state.platformsReloadToken);

  // Mapa de emuladores padrao carregados uma vez por plataforma visivel, nao por card
  const [defaultEmulators, setDefaultEmulators] = useState<Record<number, PlatformEmulator | null>>({});
  // Indica carregamento dos emuladores padrao usados pelos botoes de jogar dos cards
  const [emulatorsLoading, setEmulatorsLoading] = useState(false);

  // Plataformas unicas presentes na pagina atual; reduz dezenas de cards a poucas consultas
  const visiblePlatformIds = useMemo(
    () => Array.from(new Set(games.map((game) => game.platform_id).filter((id): id is number => typeof id === "number"))),
    [games]
  );

  /**
   * Carrega os emuladores padrao das plataformas exibidas na grade.
   * O helper compartilha cache com outras telas para evitar IPC repetido.
   */
  useEffect(() => {
    let canceled = false;
    if (!visiblePlatformIds.length) {
      setDefaultEmulators({});
      setEmulatorsLoading(false);
      return undefined;
    }

    setDefaultEmulators({});
    setEmulatorsLoading(true);
    void loadDefaultPlatformEmulators(visiblePlatformIds, platformsReloadToken)
      .then((nextEmulators) => {
        if (!canceled) setDefaultEmulators(nextEmulators);
      })
      .finally(() => {
        if (!canceled) setEmulatorsLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [platformsReloadToken, visiblePlatformIds]);

  // Estado vazio: exibido quando nenhum jogo corresponde à busca ou filtro ativo
  if (!games.length) return <div className="empty-state">Nenhum jogo encontrado</div>;

  return (
    <>
      {/* Grade responsiva com um GameCard por jogo */}
      <div className="game-grid-wrap">
        {games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            defaultEmulator={game.platform_id ? defaultEmulators[game.platform_id] ?? null : null}
            defaultEmulatorLoading={Boolean(game.platform_id) && emulatorsLoading}
          />
        ))}
      </div>
      {/* Controles de paginação posicionados abaixo da grade */}
      <Pagination />
    </>
  );
}
