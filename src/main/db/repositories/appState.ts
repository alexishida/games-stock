import { getDatabase } from "../database";
import { AppStateDao } from "../dao/appStateDao";

function appStateDao(): AppStateDao {
  return new AppStateDao(getDatabase());
}

export function getAppState<T>(key: string): T | null {
  return appStateDao().get(key) as T | null;
}

export function getAppStateMany(keys: string[]): Record<string, unknown> {
  return appStateDao().getMany(keys);
}

export function setAppState(key: string, value: unknown): void {
  appStateDao().set(key, value);
}

export function setAppStateMany(entries: Array<{ key: string; value: unknown }>, onlyIfMissing = false): void {
  appStateDao().setMany(entries, onlyIfMissing);
}

export function removeAppState(key: string): void {
  appStateDao().remove(key);
}
