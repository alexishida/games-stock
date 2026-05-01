import { useMemo } from "react";
import { useGameStockStore } from "../../store";

export function CategoryDropdown() {
  const platforms = useGameStockStore((state) => state.platforms);
  const selectedCategory = useGameStockStore((state) => state.selectedCategory);
  const setSelectedCategory = useGameStockStore((state) => state.setSelectedCategory);
  const categories = useMemo(() => Array.from(new Set(platforms.map((platform) => platform.category))).sort(), [platforms]);

  return (
    <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
      <option value="">Categoria da Plataforma</option>
      {categories.map((category) => (
        <option key={category} value={category}>{category}</option>
      ))}
    </select>
  );
}
