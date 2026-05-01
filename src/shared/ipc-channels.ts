export const IPC_CHANNELS = {
  games: {
    list: "games:list",
    get: "games:get",
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
    openImageFile: "dialogs:openImageFile"
  },
  shell: {
    openPath: "shell:openPath"
  },
  launchbox: {
    ensureMetadata: "launchbox:ensureMetadata",
    searchGames: "launchbox:searchGames",
    downloadImages: "launchbox:downloadImages",
    importGame: "launchbox:importGame",
    progress: "launchbox:progress",
    openImporter: "launchbox:openImporter"
  }
} as const;
