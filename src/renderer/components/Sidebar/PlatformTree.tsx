/**
 * PlatformTree.tsx
 *
 * Árvore de navegação por plataforma na sidebar.
 * Exibe um botão "Todos" com o total geral de jogos e, abaixo,
 * as plataformas agrupadas por categoria (apenas as que têm ao menos 1 jogo).
 * Permite filtrar a biblioteca selecionando uma plataforma específica.
 */

import { useMemo } from "react";
import { useGameStockStore } from "../../store";

/**
 * Componente de árvore de plataformas na sidebar.
 * Agrupa plataformas por categoria e ordena os grupos alfabeticamente.
 * A plataforma selecionada recebe a classe "selected".
 * "Todos" é considerado ativo quando não há plataforma selecionada, mesmo com filtro de coleção.
 */
export function PlatformTree() {
  // Lista de todas as plataformas cadastradas
  const platforms = useGameStockStore((state) => state.platforms);
  // Contagens facetadas que respeitam a coleção e demais filtros ativos.
  const sidebarCounts = useGameStockStore((state) => state.librarySidebarCounts);
  // ID da plataforma atualmente selecionada (null = todas)
  const selectedPlatformId = useGameStockStore((state) => state.selectedPlatformId);
  // Atualiza a plataforma selecionada no store (null limpa o filtro)
  const setSelectedPlatformId = useGameStockStore((state) => state.setSelectedPlatformId);

  /**
   * Agrupa plataformas com jogos por categoria e ordena os grupos alfabeticamente.
   * Plataformas sem jogos são excluídas para não poluir a navegação.
   * Recalculado apenas quando a lista de plataformas mudar.
   */
  const grouped = useMemo(() => {
    // Filtra apenas plataformas com pelo menos um jogo
    const withGames = platforms.filter((p) => (p.gameCount ?? 0) > 0);
    const map = new Map<string, typeof withGames>();
    for (const p of withGames) {
      if (!map.has(p.category)) map.set(p.category, []);
      map.get(p.category)!.push(p);
    }
    // Retorna pares [categoria, plataformas] ordenados pelo nome da categoria
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [platforms]);

  // "Todos" limpa somente plataforma, preservando favoritos e demais filtros de coleção.
  const isAll = selectedPlatformId === null;

  return (
    <div className="platform-tree">
      {/* Botão "Todos": exibe o total geral e limpa a seleção de plataforma */}
      <button type="button" className={isAll ? "tree-item selected" : "tree-item"} onClick={() => setSelectedPlatformId(null)}>
        <span>Todos</span>
        <span>{sidebarCounts.all}</span>
      </button>

      {/* Grupos de plataformas por categoria */}
      {grouped.map(([category, items]) => (
        <div key={category}>
          {/* Botões de plataforma dentro de cada grupo */}
          {items.map((platform) => (
            <button
              type="button"
              key={platform.id}
              className={selectedPlatformId === platform.id ? "tree-item selected" : "tree-item"}
              onClick={() => setSelectedPlatformId(platform.id)}
            >
              <span>{platform.name}</span>
              {/* Contagem de jogos da plataforma */}
              <span>{sidebarCounts.platforms[platform.id] ?? 0}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
