/**
 * SearchInput.tsx
 *
 * Campo de busca de jogos na sidebar.
 * Sincroniza o valor com `searchQuery` no store, disparando o filtro
 * de jogos a cada caractere digitado.
 * O botão de filtro avançado (ícone de sliders) está presente na UI
 * mas ainda não implementa funcionalidade.
 */

import { Search, SlidersHorizontal } from "lucide-react";
import { useGameStockStore } from "../../store";

/**
 * Input de busca com ícone de lupa e botão de filtro avançado.
 * O valor é controlado pelo store (searchQuery) para que outros componentes
 * (TopBar, lista de jogos) possam reagir à busca sem prop drilling.
 */
export function SearchInput() {
  // Texto atual da busca
  const searchQuery = useGameStockStore((state) => state.searchQuery);
  // Atualiza o texto de busca no store a cada mudança no input
  const setSearchQuery = useGameStockStore((state) => state.setSearchQuery);

  return (
    <div className="search-input">
      {/* Ícone decorativo de lupa */}
      <Search size={16} aria-hidden="true" />
      <input
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Buscar jogos"
      />
      {/* Botão de filtros avançados (funcionalidade a implementar) */}
      <button type="button" title="Filtro" aria-label="Filtro">
        <SlidersHorizontal size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
