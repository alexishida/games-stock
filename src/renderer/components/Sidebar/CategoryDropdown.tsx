/**
 * CategoryDropdown.tsx
 *
 * Dropdown de filtro por categoria de plataforma na sidebar.
 * Deriva as categorias únicas das plataformas carregadas no store
 * e permite que o usuário filtre a lista de jogos por categoria
 * (ex.: "Console", "Portátil", "PC").
 */

import { useMemo } from "react";
import { useGameStockStore } from "../../store";

/**
 * Select de filtro por categoria de plataforma.
 * As opções são derivadas das categorias únicas das plataformas no store,
 * ordenadas alfabeticamente. A opção vazia representa "sem filtro".
 */
export function CategoryDropdown() {
  // Lista de todas as plataformas cadastradas
  const platforms = useGameStockStore((state) => state.platforms);
  // Categoria atualmente selecionada como filtro (string vazia = todas)
  const selectedCategory = useGameStockStore((state) => state.selectedCategory);
  // Atualiza o filtro de categoria no store
  const setSelectedCategory = useGameStockStore((state) => state.setSelectedCategory);

  // Extrai categorias únicas e ordena alfabeticamente
  // Recalculado apenas quando a lista de plataformas mudar
  const categories = useMemo(
    () => Array.from(new Set(platforms.map((platform) => platform.category))).sort(),
    [platforms]
  );

  return (
    <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
      {/* Opção padrão: sem filtro de categoria */}
      <option value="">Categoria da Plataforma</option>
      {categories.map((category) => (
        <option key={category} value={category}>{category}</option>
      ))}
    </select>
  );
}
