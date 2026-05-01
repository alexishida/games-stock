import { useMemo, useState } from "react";
import { Platform } from "../../../shared/types";
import { useGameStockStore } from "../../store";

export function PlatformTree() {
  const platforms = useGameStockStore((state) => state.platforms);
  const selectedCategory = useGameStockStore((state) => state.selectedCategory);
  const selectedPlatformId = useGameStockStore((state) => state.selectedPlatformId);
  const setSelectedPlatformId = useGameStockStore((state) => state.setSelectedPlatformId);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const grouped = useMemo(() => groupPlatforms(platforms, selectedCategory), [platforms, selectedCategory]);

  return (
    <div className="platform-tree">
      <button type="button" className={selectedPlatformId === null ? "tree-item selected" : "tree-item"} onClick={() => setSelectedPlatformId(null)}>
        <span>Todos</span>
        <span>{platforms.reduce((sum, platform) => sum + (platform.gameCount ?? 0), 0)}</span>
      </button>
      {Object.entries(grouped).map(([category, items]) => (
        <section key={category}>
          <button type="button" className="tree-category" onClick={() => setCollapsed((state) => ({ ...state, [category]: !state[category] }))}>
            <span>{collapsed[category] ? "+" : "-"} {category}</span>
          </button>
          {!collapsed[category] && items.map((platform) => (
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
        </section>
      ))}
    </div>
  );
}

function groupPlatforms(platforms: Platform[], selectedCategory: string): Record<string, Platform[]> {
  return platforms
    .filter((platform) => !selectedCategory || platform.category === selectedCategory)
    .reduce<Record<string, Platform[]>>((groups, platform) => {
      groups[platform.category] ??= [];
      groups[platform.category].push(platform);
      return groups;
    }, {});
}
