/**
 * TopBar.tsx
 *
 * Barra superior da área principal de conteúdo da biblioteca.
 * Contém o campo de busca, controles de ordenação, alternância de modo de
 * visualização (grade / lista) e o contador de jogos exibidos.
 *
 * Os controles de ordenação e visualização ficam ocultos quando um jogo
 * está selecionado (painel de detalhes aberto), para não poluir o layout.
 */

import { useEffect, useState } from "react";
import { ArrowUpDown, Grid2X2, List, Search } from "lucide-react";
import { useGameStockStore } from "../../store";
import "./TopBar.css";

/** Atraso curto para evitar consulta ao banco a cada tecla digitada na busca. */
const SEARCH_DEBOUNCE_MS = 180;

/**
 * Barra de ferramentas superior da biblioteca.
 * Lê e atualiza searchQuery, viewMode e sortBy do store.
 * A ordenação alterna ciclicamente: title → year → recent → title.
 */
export function TopBar() {
  // Texto atual do campo de busca
  const storeSearchQuery = useGameStockStore((state) => state.searchQuery);
  // Total de jogos após aplicar filtros (busca + plataforma + coleção)
  const filtered = useGameStockStore((state) => state.filtered);
  // Total geral de jogos na biblioteca (sem filtros)
  const total = useGameStockStore((state) => state.total);
  // Modo de visualização atual: "grid" ou "list"
  const viewMode = useGameStockStore((state) => state.viewMode);
  // Critério de ordenação atual: "title", "year" ou "recent"
  const sortBy = useGameStockStore((state) => state.sortBy);
  // ID do jogo selecionado; quando definido, oculta controles secundários
  const selectedGameId = useGameStockStore((state) => state.selectedGameId);
  // Atualiza o texto de busca no store
  const setSearchQuery = useGameStockStore((state) => state.setSearchQuery);
  // Alterna o modo de visualização no store
  const setViewMode = useGameStockStore((state) => state.setViewMode);
  // Altera o critério de ordenação no store
  const setSortBy = useGameStockStore((state) => state.setSortBy);

  // Próximo critério de ordenação no ciclo: title → year → recent → title
  const nextSort = sortBy === "title" ? "year" : sortBy === "year" ? "recent" : "title";
  // Rascunho local mantem digitacao fluida enquanto o store recebe update com debounce
  const [draftSearchQuery, setDraftSearchQuery] = useState(storeSearchQuery);

  /** Sincroniza o campo quando a busca muda por fora do TopBar. */
  useEffect(() => {
    setDraftSearchQuery(storeSearchQuery);
  }, [storeSearchQuery]);

  /**
   * Envia a busca ao store apos pequena pausa na digitacao.
   * Isso reduz re-render amplo e chamadas IPC durante busca na tela principal.
   */
  useEffect(() => {
    if (draftSearchQuery === storeSearchQuery) return undefined;
    const timer = window.setTimeout(() => setSearchQuery(draftSearchQuery), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draftSearchQuery, setSearchQuery, storeSearchQuery]);

  return (
    <header className="topbar">
      {/* Campo de busca da biblioteca */}
      <div className="topbar-search">
        <Search aria-hidden="true" size={18} />
        <input
          value={draftSearchQuery}
          onChange={(event) => setDraftSearchQuery(event.target.value)}
          placeholder="Buscar biblioteca"
        />
      </div>

      {/* Controles de ordenação e visualização: ocultos quando um jogo está selecionado */}
      {!selectedGameId && (
        <>
          <nav className="topbar-menu" aria-label="Visualizacao da biblioteca">
            {/* Botão de ordenação: alterna ciclicamente entre os critérios disponíveis */}
            <button type="button" className="topbar-icon" title="Ordenar" onClick={() => setSortBy(nextSort)}>
              <ArrowUpDown aria-hidden="true" size={18} />
            </button>

            {/* Alternância de visualização: grade ou lista */}
            <div className="view-switch">
              <button
                type="button"
                className={viewMode === "grid" ? "active" : ""}
                onClick={() => setViewMode("grid")}
                title="Grade"
              >
                <Grid2X2 aria-hidden="true" size={18} />
              </button>
              <button
                type="button"
                className={viewMode === "list" ? "active" : ""}
                onClick={() => setViewMode("list")}
                title="Lista"
              >
                <List aria-hidden="true" size={18} />
              </button>
            </div>
          </nav>

          {/* Contador de jogos: mostra filtrados vs total */}
          <div className="topbar-count">Exibindo {filtered} de {total} jogos</div>
        </>
      )}
    </header>
  );
}
