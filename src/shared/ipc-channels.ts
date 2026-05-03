export const IPC_CHANNELS = {
  games: {
    list: "games:list",
    get: "games:get",
    listMedia: "games:listMedia",
    collectionCounts: "games:collectionCounts",
    coverStats: "games:coverStats",
    syncCovers: "games:syncCovers",
    create: "games:create",
    update: "games:update",
    delete: "games:delete"
  },
  platforms: {
    list: "platforms:list",
    create: "platforms:create",
    update: "platforms:update",
    delete: "platforms:delete"
  },
  dialogs: {
    openRomFile: "dialogs:openRomFile",
    openRomFiles: "dialogs:openRomFiles",
    openImageFile: "dialogs:openImageFile",
    saveImageFile: "dialogs:saveImageFile",
    openRomFolder: "dialogs:openRomFolder",
    openRomFolders: "dialogs:openRomFolders"
  },
  shell: {
    openPath: "shell:openPath"
  },
  launchbox: {
    ensureMetadata: "launchbox:ensureMetadata",
    metadataExists: "launchbox:metadataExists",
    searchGames: "launchbox:searchGames",
    downloadImages: "launchbox:downloadImages",
    importGame: "launchbox:importGame",
    progress: "launchbox:progress",
    openImporter: "launchbox:openImporter"
  },
  romFolderImport: {
    scan: "romFolderImport:scan",
    import: "romFolderImport:import",
    jobs: "romFolderImport:jobs",
    deleteFolderRecords: "romFolderImport:deleteFolderRecords",
    progress: "romFolderImport:progress",
    completed: "romFolderImport:completed",
    openImporter: "romFolderImport:openImporter",
  },
  library: {
    openCreateGame: "library:openCreateGame",
    openPlatformManager: "library:openPlatformManager",
    setSort: "library:setSort"
  },
  view: {
    set: "view:set"
  }
} as const;
