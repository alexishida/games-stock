/**
 * Script de preload do Electron.
 *
 * Executado em contexto isolado antes do renderer carregar.
 * Constrói o objeto `api` com todos os métodos IPC e o expõe ao renderer
 * via `contextBridge.exposeInMainWorld("gameStockAPI", api)`.
 *
 * Padrões usados:
 * - `ipcRenderer.invoke` para chamadas request/response (retornam Promise).
 * - `ipcRenderer.on` + retorno de função de cleanup para eventos push do main.
 *
 * O renderer acessa tudo via `window.gameStockAPI`, sem importar Electron diretamente.
 */

import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../shared/ipc-channels";
import type { AppStateEntry } from "../shared/appState";
import type { UpdaterAppInfo, UpdaterStatus } from "../shared/updater";
import {
  CoverSyncOptions,
  CoverSyncStats,
  DataPortabilityExportRequest,
  DataPortabilityRomFolderEntry,
  DataPortabilityJob,
  DataPortabilityProgress,
  DataPortabilityStartResult,
  DataPortabilityImportPreview,
  DataPortabilityImportRequest,
  GameCreateInput,
  GameFilters,
  GameLaunchStats,
  GameUpdateInput,
  GameVersionOption,
  HardwareItemCreateInput,
  HardwareItemFilters,
  HardwareItemUpdateInput,
  PlatformMappings,
  PlatformMappingsInput,
  LaunchBoxDownloadParams,
  LaunchBoxImportParams,
  LaunchBoxProgress,
  LaunchBoxSearchParams,
  GameSortBy,
  RomFolderImportProgress,
  RomFolderImportRequest,
  RomFolderImportResult,
  RomFolderRecordCountRequest,
  RomFolderScanRequest,
  ViewMode
} from "../shared/types";

/** Implementação da API exposta ao renderer, organizada por domínio funcional. */
const api = {
  /** Operações sobre jogos da biblioteca. */
  games: {
    /** Lista jogos com filtros opcionais (plataforma, busca, status, paginação). */
    list: (filters?: GameFilters) => ipcRenderer.invoke(IPC_CHANNELS.games.list, filters),
    /** Lista categorias/gêneros únicos para o filtro da biblioteca. */
    listGenres: () => ipcRenderer.invoke(IPC_CHANNELS.games.listGenres) as Promise<string[]>,
    /** Busca um jogo pelo ID. */
    get: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.games.get, id),
    /** Lista os arquivos de mídia associados a um jogo. */
    listMedia: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.games.listMedia, id),
    /** Retorna contagens de favoritos, jogando e concluídos. */
    collectionCounts: () => ipcRenderer.invoke(IPC_CHANNELS.games.collectionCounts),
    /** Retorna contagens sincronizadas dos filtros da sidebar da biblioteca. */
    sidebarCounts: (filters: GameFilters) => ipcRenderer.invoke(IPC_CHANNELS.games.sidebarCounts, filters),
    /** Retorna estatísticas agregadas do histórico de partidas. */
    launchStats: () => ipcRenderer.invoke(IPC_CHANNELS.games.launchStats) as Promise<GameLaunchStats>,
    /** Retorna estatísticas sobre capas baixadas e disponíveis. */
    coverStats: () => ipcRenderer.invoke(IPC_CHANNELS.games.coverStats),
    /**
     * Registra listener para atualizações de estatísticas de capa emitidas pelo main.
     * Retorna função de cleanup para remover o listener quando o componente desmontar.
     */
    onCoverStatsUpdated: (callback: (stats: CoverSyncStats) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, stats: CoverSyncStats) => callback(stats);
      ipcRenderer.on(IPC_CHANNELS.games.coverStatsUpdated, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.games.coverStatsUpdated, listener);
    },
    /** Inicia a sincronização de capas com o LaunchBox. */
    syncCovers: (options?: CoverSyncOptions) => ipcRenderer.invoke(IPC_CHANNELS.games.syncCovers, options),
    /** Cria um novo jogo na biblioteca. */
    create: (data: Partial<GameCreateInput>) => ipcRenderer.invoke(IPC_CHANNELS.games.create, data),
    /** Atualiza dados de um jogo existente. */
    update: (id: number, data: GameUpdateInput) => ipcRenderer.invoke(IPC_CHANNELS.games.update, id, data),
    /** Remove um jogo da biblioteca. */
    delete: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.games.delete, id),
    /** Lista versões relacionadas de um jogo antes do launch. */
    listVersions: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.games.listVersions, id) as Promise<GameVersionOption[]>,
    /** Zera manualmente todos os contadores de partidas. */
    resetLaunchStats: () => ipcRenderer.invoke(IPC_CHANNELS.games.resetLaunchStats) as Promise<{ success: true; updated: number }>,
    /** Inicia o jogo com o emulador padrão configurado para a plataforma. */
    launch: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.games.launch, id)
  },

  /** Operações sobre emuladores cadastrados. */
  emulators: {
    /** Lista todos os emuladores cadastrados. */
    list: () => ipcRenderer.invoke(IPC_CHANNELS.emulators.list),
    /** Cria um novo emulador. */
    create: (data: { name: string; executable: string; args: string; is_retroarch: number }) =>
      ipcRenderer.invoke(IPC_CHANNELS.emulators.create, data),
    /** Atualiza dados de um emulador existente. */
    update: (id: number, data: { name?: string; executable?: string; args?: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.emulators.update, id, data),
    /** Remove um emulador. */
    delete: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.emulators.delete, id),
    /** Lista emuladores vinculados a uma plataforma específica. */
    listByPlatform: (platformId: number) => ipcRenderer.invoke(IPC_CHANNELS.emulators.listByPlatform, platformId),
    /** Lista vínculos de várias plataformas em uma única chamada IPC. */
    listByPlatforms: (platformIds: number[]) => ipcRenderer.invoke(IPC_CHANNELS.emulators.listByPlatforms, platformIds),
    /** Lista os cores RetroArch instalados para o emulador informado. */
    listRetroArchCores: (emulatorId: number) => ipcRenderer.invoke(IPC_CHANNELS.emulators.listRetroArchCores, emulatorId),
    /** Vincula um emulador a uma plataforma, definindo se é padrão e o core a usar. */
    linkPlatform: (emulatorId: number, platformId: number, isDefault: boolean, corePath?: string | null) =>
      ipcRenderer.invoke(IPC_CHANNELS.emulators.linkPlatform, emulatorId, platformId, isDefault, corePath),
    /** Remove o vínculo entre um emulador e uma plataforma. */
    unlinkPlatform: (emulatorId: number, platformId: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.emulators.unlinkPlatform, emulatorId, platformId),
    /** Aplica vários vínculos em uma transação SQLite. */
    savePlatformLinks: (changes: import("../shared/types").PlatformEmulatorLinkInput[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.emulators.savePlatformLinks, changes)
  },

  /** Operações sobre plataformas cadastradas. */
  platforms: {
    /** Lista todas as plataformas cadastradas. */
    list: () => ipcRenderer.invoke(IPC_CHANNELS.platforms.list),
    /** Cria uma nova plataforma. */
    create: (data: { name: string; category: string }) => ipcRenderer.invoke(IPC_CHANNELS.platforms.create, data),
    /** Atualiza dados de uma plataforma existente. */
    update: (id: number, data: { name?: string; category?: string }) => ipcRenderer.invoke(IPC_CHANNELS.platforms.update, id, data),
    /** Remove uma plataforma. */
    delete: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.platforms.delete, id),
    /** Retorna os mapeamentos (aliases e extensões de ROM) de uma plataforma. */
    getMappings: (platformId: number) => ipcRenderer.invoke(IPC_CHANNELS.platforms.getMappings, platformId) as Promise<PlatformMappings>,
    /** Salva os mapeamentos de uma plataforma. */
    saveMappings: (platformId: number, data: PlatformMappingsInput) =>
      ipcRenderer.invoke(IPC_CHANNELS.platforms.saveMappings, platformId, data) as Promise<PlatformMappings>
  },

  /** Diálogos nativos de seleção de arquivos e pastas. */
  dialogs: {
    /** Abre diálogo para selecionar um arquivo ROM. */
    openRomFile: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openRomFile),
    /** Abre diálogo para selecionar múltiplos arquivos ROM. */
    openRomFiles: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openRomFiles),
    /** Abre diálogo para selecionar uma imagem. */
    openImageFile: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openImageFile),
    /** Abre diálogo para salvar uma imagem com nome sugerido. */
    saveImageFile: (sourcePath: string, suggestedName: string) => ipcRenderer.invoke(IPC_CHANNELS.dialogs.saveImageFile, sourcePath, suggestedName),
    /** Abre diálogo para selecionar uma pasta de ROM. */
    openRomFolder: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openRomFolder),
    /** Abre diálogo para selecionar múltiplas pastas de ROM. */
    openRomFolders: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openRomFolders),
    /** Abre diálogo para selecionar um executável. */
    openExecutableFile: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openExecutableFile),
    /** Abre diálogo para selecionar qualquer arquivo. */
    openAnyFile: () => ipcRenderer.invoke(IPC_CHANNELS.dialogs.openAnyFile)
  },

  /** Integração com o shell do sistema operacional. */
  shell: {
    /** Abre um caminho no explorador de arquivos ou aplicativo padrão do SO. */
    openPath: (targetPath: string) => ipcRenderer.invoke(IPC_CHANNELS.shell.openPath, targetPath)
  },

  /** Informações gerais sobre a aplicação. */
  app: {
    /** Retorna a versão atual da aplicação. */
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.app.getVersion) as Promise<string>,
    /** Retorna apenas o caminho da pasta de dados, sem calcular tamanho em disco. */
    getDataDirPath: () => ipcRenderer.invoke(IPC_CHANNELS.app.getDataDirPath) as Promise<string>,
    /** Retorna estatísticas de armazenamento: total de jogos, tamanho e caminho do diretório de dados. */
    getStorageStats: () => ipcRenderer.invoke(IPC_CHANNELS.app.getStorageStats) as Promise<{ totalGames: number; dataDirSizeMb: number; dataDirPath: string }>,
    /** Remove o cache temporário de ROMs extraídas para forçar nova extração no próximo launch. */
    clearExtractedRomCache: () =>
      ipcRenderer.invoke(IPC_CHANNELS.app.clearExtractedRomCache) as Promise<{ rootDir: string; removedEntries: number }>,
    /** Lista o histórico persistido de eventos e erros do aplicativo. */
    listLogs: () => ipcRenderer.invoke(IPC_CHANNELS.app.listLogs) as Promise<import("../shared/logs").AppLogListResult>,
    /** Remove o histórico persistido de logs. */
    clearLogs: () => ipcRenderer.invoke(IPC_CHANNELS.app.clearLogs) as Promise<void>
  },

  /** Fluxo dedicado do updater consumido pela splash screen. */
  updater: {
    /** Escuta mudanças de status/progresso emitidas pelo processo principal. */
    onStatus: (callback: (status: UpdaterStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: UpdaterStatus) => callback(status);
      ipcRenderer.on(IPC_CHANNELS.updater.status, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.updater.status, listener);
    },
    /** Dispara uma verificação manual de update a partir do renderer. */
    checkNow: () => ipcRenderer.invoke(IPC_CHANNELS.updater.checkNow) as Promise<void>,
    /** Solicita continuação em modo offline quando não há conectividade. */
    skip: () => ipcRenderer.invoke(IPC_CHANNELS.updater.skip) as Promise<void>,
    /** Retorna versão local e identificador da build instalada. */
    getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.updater.getAppInfo) as Promise<UpdaterAppInfo>
  },

  /**
   * Armazenamento chave-valor persistido (SQLite via processo principal).
   * Usado para guardar estado de UI e configurações entre sessões.
   */
  appState: {
    /** Lê o valor de uma chave. Retorna null se não existir. */
    get: <T>(key: string) => ipcRenderer.invoke(IPC_CHANNELS.appState.get, key) as Promise<T | null>,
    /** Lê os valores de múltiplas chaves de uma vez. Chaves ausentes não aparecem no retorno. */
    getMany: (keys: string[]) => ipcRenderer.invoke(IPC_CHANNELS.appState.getMany, keys) as Promise<Record<string, unknown>>,
    /** Grava ou sobrescreve o valor de uma chave. */
    set: (key: string, value: unknown) => ipcRenderer.invoke(IPC_CHANNELS.appState.set, key, value) as Promise<void>,
    /**
     * Grava múltiplas entradas de uma vez.
     * @param onlyIfMissing - Quando true, ignora entradas cujas chaves já existem.
     */
    setMany: (entries: AppStateEntry[], onlyIfMissing = false) =>
      ipcRenderer.invoke(IPC_CHANNELS.appState.setMany, entries, onlyIfMissing) as Promise<void>,
    /** Remove uma entrada pelo nome da chave. */
    remove: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.appState.remove, key) as Promise<void>
  },

  /** Fluxo de portabilidade de dados: exportação e importação de backups. */
  dataPortability: {
    /** Inicia a exportação de um pacote de backup. Pode abrir diálogo nativo de salvar arquivo. */
    exportPackage: (request: DataPortabilityExportRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.dataPortability.exportPackage, request) as Promise<DataPortabilityStartResult>,
    /** Lê e valida um pacote de backup sem importar — retorna preview para exibição ao usuário. */
    previewImport: (packagePath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.dataPortability.previewImport, packagePath) as Promise<DataPortabilityImportPreview>,
    /** Inicia a importação de um pacote de backup. */
    importPackage: (request: DataPortabilityImportRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.dataPortability.importPackage, request) as Promise<DataPortabilityJob>,
    /** Retorna os jobs de portabilidade persistidos (incluindo interrompidos). */
    jobs: () => ipcRenderer.invoke(IPC_CHANNELS.dataPortability.jobs) as Promise<DataPortabilityJob[]>,
    /**
     * Registra listener para progresso em tempo real de jobs de portabilidade.
     * Retorna função de cleanup para remover o listener.
     */
    onProgress: (callback: (progress: DataPortabilityProgress) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: DataPortabilityProgress) => callback(progress);
      ipcRenderer.on(IPC_CHANNELS.dataPortability.progress, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.dataPortability.progress, listener);
    },
    /**
     * Registra listener para conclusão de jobs de portabilidade.
     * Retorna função de cleanup para remover o listener.
     */
    onCompleted: (callback: (job: DataPortabilityJob) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, job: DataPortabilityJob) => callback(job);
      ipcRenderer.on(IPC_CHANNELS.dataPortability.completed, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.dataPortability.completed, listener);
    }
  },

  /** Integração com o banco de metadados LaunchBox. */
  launchbox: {
    /** Garante que os metadados LaunchBox estão disponíveis, baixando se necessário. */
    ensureMetadata: (options?: { force?: boolean; jobId?: string }) => ipcRenderer.invoke(IPC_CHANNELS.launchbox.ensureMetadata, options),
    /** Verifica se os metadados LaunchBox já foram baixados. */
    metadataExists: () => ipcRenderer.invoke(IPC_CHANNELS.launchbox.metadataExists) as Promise<boolean>,
    /** Busca jogos no índice LaunchBox por título e plataforma. */
    searchGames: (params: LaunchBoxSearchParams) => ipcRenderer.invoke(IPC_CHANNELS.launchbox.searchGames, params),
    /** Baixa imagens do LaunchBox para um jogo específico. */
    downloadImages: (params: LaunchBoxDownloadParams) => ipcRenderer.invoke(IPC_CHANNELS.launchbox.downloadImages, params),
    /** Importa um jogo do LaunchBox para a biblioteca local. */
    importGame: (params: LaunchBoxImportParams) => ipcRenderer.invoke(IPC_CHANNELS.launchbox.importGame, params),
    /**
     * Registra listener para progresso de download/indexação do LaunchBox.
     * Retorna função de cleanup para remover o listener.
     */
    onProgress: (callback: (progress: LaunchBoxProgress) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: LaunchBoxProgress) => callback(progress);
      ipcRenderer.on(IPC_CHANNELS.launchbox.progress, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.launchbox.progress, listener);
    },
    /**
     * Registra listener para o evento de abertura do importador LaunchBox
     * (disparado pelo menu nativo). Retorna função de cleanup.
     */
    onOpenImporter: (callback: () => void) => {
      ipcRenderer.on(IPC_CHANNELS.launchbox.openImporter, callback);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.launchbox.openImporter, callback);
    }
  },

  /** Importação de ROMs por pasta do sistema de arquivos. */
  romFolderImport: {
    /** Escaneia pastas por arquivos de ROM e detecta plataforma automaticamente. */
    scan: (params: RomFolderScanRequest) => ipcRenderer.invoke(IPC_CHANNELS.romFolderImport.scan, params),
    /** Inicia o job de importação de ROMs das pastas informadas. */
    import: (params: RomFolderImportRequest) => ipcRenderer.invoke(IPC_CHANNELS.romFolderImport.import, params),
    /** Faz sync incremental das pastas configuradas, importando apenas ROMs novas. */
    syncConfiguredFolders: (entries: DataPortabilityRomFolderEntry[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.romFolderImport.syncConfiguredFolders, entries) as Promise<void>,
    /** Retorna os jobs de importação de pastas persistidos. */
    jobs: () => ipcRenderer.invoke(IPC_CHANNELS.romFolderImport.jobs),
    /** Conta registros de ROM importados de pastas/plataformas específicas. */
    countFolderRecords: (params: RomFolderRecordCountRequest[]) => ipcRenderer.invoke(IPC_CHANNELS.romFolderImport.countFolderRecords, params),
    /**
     * Remove registros de ROM importados de uma pasta (opcionalmente filtrados por plataforma).
     * Aceita string (caminho da pasta) ou objeto com folderPath e platformId opcional.
     */
    deleteFolderRecords: (params: string | { folderPath: string; platformId?: number }) => ipcRenderer.invoke(IPC_CHANNELS.romFolderImport.deleteFolderRecords, params),
    /**
     * Registra listener para progresso em tempo real do job de importação de pastas.
     * Retorna função de cleanup para remover o listener.
     */
    onProgress: (callback: (progress: RomFolderImportProgress) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: RomFolderImportProgress) => callback(progress);
      ipcRenderer.on(IPC_CHANNELS.romFolderImport.progress, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.romFolderImport.progress, listener);
    },
    /**
     * Registra listener para conclusão de job de importação de pastas.
     * Retorna função de cleanup para remover o listener.
     */
    onCompleted: (callback: (result: RomFolderImportResult) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, result: RomFolderImportResult) => callback(result);
      ipcRenderer.on(IPC_CHANNELS.romFolderImport.completed, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.romFolderImport.completed, listener);
    },
    /**
     * Registra listener para o evento de abertura do importador de pastas
     * (disparado pelo menu nativo). Retorna função de cleanup.
     */
    onOpenImporter: (callback: () => void) => {
      ipcRenderer.on(IPC_CHANNELS.romFolderImport.openImporter, callback);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.romFolderImport.openImporter, callback);
    }
  },

  /** Controle do modo de visualização da biblioteca. */
  view: {
    /**
     * Registra listener para mudanças de modo de visualização (grade/lista)
     * disparadas pelo menu nativo. Retorna função de cleanup.
     */
    onSet: (callback: (mode: ViewMode) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, mode: ViewMode) => callback(mode);
      ipcRenderer.on(IPC_CHANNELS.view.set, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.view.set, listener);
    }
  },

  /** Inventário físico de hardware: CRUD de itens, tipos, estados e fotos. */
  hardwareInventory: {
    /** Lista itens com filtros opcionais. */
    itemsList:   (filters?: HardwareItemFilters) => ipcRenderer.invoke(IPC_CHANNELS.hardwareInventory.itemsList, filters),
    /** Retorna um item pelo ID. */
    itemsGet:    (id: number) => ipcRenderer.invoke(IPC_CHANNELS.hardwareInventory.itemsGet, id),
    /** Cria um novo item de hardware. */
    itemsCreate: (data: HardwareItemCreateInput) => ipcRenderer.invoke(IPC_CHANNELS.hardwareInventory.itemsCreate, data),
    /** Atualiza um item de hardware existente. */
    itemsUpdate: (id: number, data: HardwareItemUpdateInput) => ipcRenderer.invoke(IPC_CHANNELS.hardwareInventory.itemsUpdate, id, data),
    /** Remove um item e seus arquivos de foto. */
    itemsDelete: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.hardwareInventory.itemsDelete, id),

    /** Lista todos os tipos de item cadastrados. */
    typesList:   () => ipcRenderer.invoke(IPC_CHANNELS.hardwareInventory.typesList),
    /** Lista tipos com contagem de itens associados. */
    typesListWithCounts: () => ipcRenderer.invoke(IPC_CHANNELS.hardwareInventory.typesListWithCounts),
    /** Cria um novo tipo de item. */
    typesCreate: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.hardwareInventory.typesCreate, name),
    /** Remove um tipo de item. */
    typesDelete: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.hardwareInventory.typesDelete, id),

    /** Lista todos os estados de conservação. */
    statesList:   () => ipcRenderer.invoke(IPC_CHANNELS.hardwareInventory.statesList),
    /** Lista estados com contagem de itens associados. */
    statesListWithCounts: () => ipcRenderer.invoke(IPC_CHANNELS.hardwareInventory.statesListWithCounts),
    /** Cria um novo estado de conservação. */
    statesCreate: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.hardwareInventory.statesCreate, name),
    /** Remove um estado de conservação. */
    statesDelete: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.hardwareInventory.statesDelete, id),

    /** Lista as fotos de um item. */
    photosList:   (itemId: number) => ipcRenderer.invoke(IPC_CHANNELS.hardwareInventory.photosList, itemId),
    /** Adiciona uma foto ao item a partir de um caminho de arquivo local. */
    photosAdd:    (itemId: number, sourcePath: string) => ipcRenderer.invoke(IPC_CHANNELS.hardwareInventory.photosAdd, itemId, sourcePath),
    /** Remove uma foto pelo ID. */
    photosRemove: (photoId: number) => ipcRenderer.invoke(IPC_CHANNELS.hardwareInventory.photosRemove, photoId),
    /** Troca a ordem de duas fotos na galeria. */
    photosReorder: (idA: number, idB: number) => ipcRenderer.invoke(IPC_CHANNELS.hardwareInventory.photosReorder, idA, idB),

    /** Lista plataformas com ao menos um item de hardware cadastrado. */
    platformsWithItems: () => ipcRenderer.invoke(IPC_CHANNELS.hardwareInventory.platformsWithItems)
  },

  /** Ações de UI da biblioteca disparadas pelo menu nativo. */
  library: {
    /**
     * Registra listener para o evento de abertura do modal de criação de jogo.
     * Retorna função de cleanup.
     */
    onOpenCreateGame: (callback: () => void) => {
      ipcRenderer.on(IPC_CHANNELS.library.openCreateGame, callback);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.library.openCreateGame, callback);
    },
    /**
     * Registra listener para o evento de abertura do gerenciador de plataformas.
     * Retorna função de cleanup.
     */
    onOpenPlatformManager: (callback: () => void) => {
      ipcRenderer.on(IPC_CHANNELS.library.openPlatformManager, callback);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.library.openPlatformManager, callback);
    },
    /**
     * Registra listener para mudanças de critério de ordenação da biblioteca
     * disparadas pelo menu nativo. Retorna função de cleanup.
     */
    onSetSort: (callback: (sortBy: GameSortBy) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, sortBy: GameSortBy) => callback(sortBy);
      ipcRenderer.on(IPC_CHANNELS.library.setSort, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.library.setSort, listener);
    }
  }
};

/**
 * Expõe o objeto `api` como `window.gameStockAPI` no renderer.
 * O contextBridge garante o isolamento: o renderer não tem acesso direto ao Node.js.
 */
contextBridge.exposeInMainWorld("gameStockAPI", api);
