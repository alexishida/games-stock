import { getDatabase } from "../database";
import { GameDao } from "../dao/gameDao";
import { CollectionCounts, CoverSyncStats, Game, GameCreateInput, GameFilters, GameListResult, GameUpdateInput } from "../../../shared/types";

function gameDao(): GameDao {
  return new GameDao(getDatabase());
}

export function listGames(filters: GameFilters = {}): GameListResult {
  return gameDao().list(filters);
}

export function getGame(id: number): Game | null {
  return gameDao().get(id);
}

export function createGame(data: Partial<GameCreateInput>): Game {
  return gameDao().create(data);
}

export function updateGame(id: number, data: GameUpdateInput): Game {
  return gameDao().update(id, data);
}

export function deleteGame(id: number): { success: true } {
  return gameDao().delete(id);
}

export function deleteGamesByRomFolder(folderPath: string): { success: true; deleted: number } {
  return gameDao().deleteByRomFolder(folderPath);
}

export function deleteGamesWithoutRomPathByPlatformAndTitles(platformId: number, titles: string[]): { success: true; deleted: number } {
  return gameDao().deleteWithoutRomPathByPlatformAndTitles(platformId, titles);
}

export function upsertLaunchBoxGame(data: Partial<GameCreateInput> & { title: string; platform_id: number }): { game: Game; created: boolean } {
  return gameDao().upsertLaunchBox(data);
}

export function getCollectionCounts(): CollectionCounts {
  return gameDao().collectionCounts();
}

export function getCoverStats(): CoverSyncStats {
  return gameDao().coverStats();
}

export function listGamesMissingCovers(): Game[] {
  return gameDao().listMissingCovers();
}

export function listLaunchBoxLinkedGames(): Game[] {
  return gameDao().listLaunchBoxLinked();
}
