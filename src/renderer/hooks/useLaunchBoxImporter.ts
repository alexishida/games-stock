import { useState } from "react";
import { LaunchBoxGame, LaunchBoxImageType, LaunchBoxProgress } from "../../shared/types";
import { useGameStockStore } from "../store";

const defaultImageTypes: LaunchBoxImageType[] = [
  "Box - Back",
  "Box - Front",
  "Cart - Front",
  "Fanart - Background",
  "Screenshot - Gameplay"
];

export function useLaunchBoxImporter() {
  const reloadGames = useGameStockStore((state) => state.reloadGames);
  const reloadPlatforms = useGameStockStore((state) => state.reloadPlatforms);
  const [query, setQuery] = useState("");
  const [platformKey, setPlatformKey] = useState("");
  const [results, setResults] = useState<LaunchBoxGame[]>([]);
  const [selectedGame, setSelectedGame] = useState<LaunchBoxGame | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<LaunchBoxImageType[]>(defaultImageTypes);
  const [progress, setProgress] = useState<LaunchBoxProgress | null>(null);
  const [loading, setLoading] = useState(false);

  async function ensure(): Promise<void> {
    setLoading(true);
    try {
      await window.gameStockAPI.launchbox.ensureMetadata();
    } finally {
      setLoading(false);
    }
  }

  async function search(): Promise<void> {
    setLoading(true);
    try {
      const found = await window.gameStockAPI.launchbox.searchGames({ query, platformKey: platformKey || null });
      setResults(found);
    } finally {
      setLoading(false);
    }
  }

  async function importSelected(): Promise<void> {
    if (!selectedGame) return;
    setLoading(true);
    try {
      await window.gameStockAPI.launchbox.importGame({ launchboxGameId: selectedGame.id, imageTypes: selectedTypes });
      reloadGames();
      reloadPlatforms();
    } finally {
      setLoading(false);
    }
  }

  return {
    query,
    setQuery,
    platformKey,
    setPlatformKey,
    results,
    selectedGame,
    setSelectedGame,
    selectedTypes,
    setSelectedTypes,
    progress,
    setProgress,
    loading,
    ensure,
    search,
    importSelected
  };
}
