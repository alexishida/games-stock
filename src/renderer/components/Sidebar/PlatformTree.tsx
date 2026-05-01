import { useMemo } from "react";
import { useGameStockStore } from "../../store";

export function PlatformTree() {
  const platforms = useGameStockStore((state) => state.platforms);
  const selectedCategory = useGameStockStore((state) => state.selectedCategory);
  const selectedPlatformId = useGameStockStore((state) => state.selectedPlatformId);
  const setSelectedPlatformId = useGameStockStore((state) => state.setSelectedPlatformId);

  const filtered = useMemo(
    () => platforms.filter((p) => !selectedCategory || p.category === selectedCategory),
    [platforms, selectedCategory]
  );

  return (
    <div className="platform-tree">
      <button type="button" className={selectedPlatformId === null ? "tree-item selected" : "tree-item"} onClick={() => setSelectedPlatformId(null)}>
        <span>Todos</span>
        <span>{platforms.reduce((sum, p) => sum + (p.gameCount ?? 0), 0)}</span>
      </button>
      {filtered.map((platform) => (
        <button
          type="button"
          key={platform.id}
          className={selectedPlatformId === platform.id ? "tree-item selected" : "tree-item"}
          onClick={() => setSelectedPlatformId(platform.id)}
        >
          <span>{platform.name}</span>
          <span>{platform.gameCount ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
