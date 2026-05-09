export const APP_STATE_KEYS = {
  romImport: {
    sources: "gamestock.romImport.sources",
    platformId: "gamestock.romImport.platformId",
    folderEntries: "gamestock.romImport.folderEntries"
  },
  media: {
    lastRomImportJob: "gamestock.media.lastRomImportJob",
    lastMediaSyncJob: "gamestock.media.lastMediaSyncJob",
    lastMediaSyncJobs: "gamestock.media.lastMediaSyncJobs"
  },
  dataPortability: {
    jobs: "gamestock.dataPortability.jobs"
  }
} as const;

export type AppStateKey = ValueOfNested<typeof APP_STATE_KEYS>;

export interface AppStateEntry {
  key: AppStateKey | string;
  value: unknown;
}

type ValueOfNested<T> = T extends string
  ? T
  : T extends Record<string, infer U>
    ? ValueOfNested<U>
    : never;
