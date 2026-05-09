import { useMemo } from "react";
import { useGameStockStore } from "../../store";

export function PlatformTree() {
  const platforms = useGameStockStore((state) => state.platforms);
  const total = useGameStockStore((state) => state.total);
  const selectedPlatformId = useGameStockStore((state) => state.selectedPlatformId);
  const collectionFilter = useGameStockStore((state) => state.collectionFilter);
  const setSelectedPlatformId = useGameStockStore((state) => state.setSelectedPlatformId);

  const grouped = useMemo(() => {
    const withGames = platforms.filter((p) => (p.gameCount ?? 0) > 0);
    const map = new Map<string, typeof withGames>();
    for (const p of withGames) {
      if (!map.has(p.category)) map.set(p.category, []);
      map.get(p.category)!.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [platforms]);

  const isAll = selectedPlatformId === null && collectionFilter === "all";

  return (
    <div className="platform-tree">
      <button type="button" className={isAll ? "tree-item selected" : "tree-item"} onClick={() => setSelectedPlatformId(null)}>
        <span>Todos</span>
        <span>{total}</span>
      </button>
      {grouped.map(([category, items]) => (
        <div key={category}>
          {items.map((platform) => (
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
      ))}
    </div>
  );
}
