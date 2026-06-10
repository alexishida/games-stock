/**
 * Declarações de tipo para a API do GameStock exposta ao renderer via contextBridge.
 *
 * Define a interface `GameStockAPI` com todas as assinaturas de método disponíveis
 * em `window.gameStockAPI`. Garante tipagem forte no renderer sem importar Electron.
 *
 * Também estende a interface global `Window` para que `window.gameStockAPI`
 * seja reconhecida pelo TypeScript em qualquer arquivo do renderer.
 */

import type { AppStateEntry } from "../shared/appState";
import type { UpdaterAppInfo, UpdaterStatus } from "../shared/updater";
import {
  CollectionCounts,
  ConservationState,
  CoverSyncResult,
  CoverSyncStats,
  DataPortabilityExportRequest,
  DataPortabilityJob,
  DataPortabilityProgress,
  DataPortabilityRomFolderEntry,
  DataPortabilityStartResult,
  DataPortabilityImportPreview,
  DataPortabilityImportRequest,
  Emulator,
  Game,
  GameCreateInput,
  GameFilters,
  GameLaunchStats,
  GameListResult,
  GameMediaItem,
  GameSortBy,
  GameUpdateInput,
  GameVersionOption,
  HardwareItem,
  HardwareItemCreateInput,
  HardwareItemFilters,
  HardwareItemListResult,
  HardwareItemPhoto,
  HardwareItemType,
  HardwareItemUpdateInput,
  LaunchBoxDownloadParams,
  LaunchBoxDownloadResult,
  LaunchBoxGame,
  LaunchBoxImportParams,
  LaunchBoxImportResult,
  LaunchBoxProgress,
  LaunchBoxSearchParams,
  Platform,
  PlatformEmulator,
  PlatformMappings,
  PlatformMappingsInput,
  RetroArchCoreInventory,
  RomFolderImportJob,
  RomFolderImportProgress,
  RomFolderImportRequest,
  RomFolderImportResult,
  RomFolderRecordCountRequest,
  RomFolderRecordCountResult,
  RomFolderScanRequest,
  RomFolderScanResult,
  ViewMode
} from "../shared/types";

/**
 * Interface completa da API GameStock disponível em `window.gameStockAPI`.
 * Cada método corresponde a um canal IPC definido em `src/shared/ipc-channels.ts`
 * e implementado em `src/preload/index.ts`.
 *
 * Métodos `on*` registram listeners para eventos push do main e retornam
 * uma função de cleanup (para uso em `useEffect` → return cleanup).
 */
export interface GameStockAPI {
  /** Operações sobre jogos da biblioteca. */
  games: {
    /** Lista jogos com filtros opcionais (plataforma, busca, status, paginação). */
    list(filters?: GameFilters): Promise<GameListResult>;
    /** Lista categorias/gêneros únicos para o filtro da biblioteca. */
    listGenres(): Promise<string[]>;
    /** Retorna um jogo pelo ID, ou null se não encontrado. */
    get(id: number): Promise<Game | null>;
    /** Lista os arquivos de mídia associados a um jogo. */
    listMedia(id: number): Promise<GameMediaItem[]>;
    /** Retorna contagens de favoritos, jogando e concluídos. */
    collectionCounts(): Promise<CollectionCounts>;
    /** Retorna estatísticas agregadas do histórico de partidas. */
    launchStats(): Promise<GameLaunchStats>;
    /** Retorna estatísticas sobre capas baixadas e disponíveis. */
    coverStats(): Promise<CoverSyncStats>;
    /**
     * Registra listener para atualizações de estatísticas de capa.
     * @returns Função de cleanup para remover o listener.
     */
    onCoverStatsUpdated(callback: (stats: CoverSyncStats) => void): () => void;
    /** Inicia sincronização de capas e retorna o resultado completo. */
    syncCovers(options?: { jobId?: string }): Promise<CoverSyncResult>;
    /** Cria um novo jogo na biblioteca. */
    create(data: Partial<GameCreateInput>): Promise<Game>;
    /** Atualiza dados de um jogo existente. */
    update(id: number, data: GameUpdateInput): Promise<Game>;
    /** Remove um jogo da biblioteca. */
    delete(id: number): Promise<{ success: true }>;
    /** Lista versões relacionadas de um mesmo jogo-base antes do launch. */
    listVersions(id: number): Promise<GameVersionOption[]>;
    /** Zera manualmente todos os contadores de partidas. */
    resetLaunchStats(): Promise<{ success: true; updated: number }>;
    /** Inicia o jogo com o emulador padrão da plataforma. */
    launch(id: number): Promise<{ success: true }>;
  };

  /** Operações sobre emuladores cadastrados. */
  emulators: {
    /** Lista todos os emuladores cadastrados. */
    list(): Promise<Emulator[]>;
    /** Cria um novo emulador. */
    create(data: { name: string; executable: string; args: string; is_retroarch: number }): Promise<Emulator>;
    /** Atualiza dados de um emulador existente. */
    update(id: number, data: { name?: string; executable?: string; args?: string }): Promise<Emulator>;
    /** Remove um emulador. */
    delete(id: number): Promise<{ success: true }>;
    /** Lista emuladores vinculados a uma plataforma específica. */
    listByPlatform(platformId: number): Promise<PlatformEmulator[]>;
    /** Lista os cores RetroArch instalados para o emulador informado. */
    listRetroArchCores(emulatorId: number): Promise<RetroArchCoreInventory>;
    /** Vincula um emulador a uma plataforma, definindo se é padrão e o core a usar. */
    linkPlatform(emulatorId: number, platformId: number, isDefault: boolean, corePath?: string | null): Promise<PlatformEmulator>;
    /** Remove o vínculo entre um emulador e uma plataforma. */
    unlinkPlatform(emulatorId: number, platformId: number): Promise<{ success: true }>;
  };

  /** Operações sobre plataformas cadastradas. */
  platforms: {
    /** Lista todas as plataformas cadastradas. */
    list(): Promise<Platform[]>;
    /** Cria uma nova plataforma. */
    create(data: { name: string; category: string }): Promise<Platform>;
    /** Atualiza dados de uma plataforma existente. */
    update(id: number, data: { name?: string; category?: string }): Promise<Platform>;
    /** Remove uma plataforma. */
    delete(id: number): Promise<{ success: true }>;
    /** Retorna os mapeamentos (aliases e extensões de ROM) de uma plataforma. */
    getMappings(platformId: number): Promise<PlatformMappings>;
    /** Salva os mapeamentos de uma plataforma. */
    saveMappings(platformId: number, data: PlatformMappingsInput): Promise<PlatformMappings>;
  };

  /** Diálogos nativos de seleção de arquivos e pastas. */
  dialogs: {
    /** Abre diálogo para selecionar um arquivo ROM. Retorna o caminho ou null se cancelado. */
    openRomFile(): Promise<string | null>;
    /** Abre diálogo para selecionar múltiplos arquivos ROM. */
    openRomFiles(): Promise<string[]>;
    /** Abre diálogo para selecionar uma imagem. Retorna o caminho ou null se cancelado. */
    openImageFile(): Promise<string | null>;
    /** Abre diálogo para salvar uma imagem; retorna o caminho escolhido ou null. */
    saveImageFile(sourcePath: string, suggestedName: string): Promise<{ canceled: boolean; path: string | null }>;
    /** Abre diálogo para selecionar uma pasta de ROM. Retorna o caminho ou null. */
    openRomFolder(): Promise<string | null>;
    /** Abre diálogo para selecionar múltiplas pastas de ROM. */
    openRomFolders(): Promise<string[]>;
    /** Abre diálogo para selecionar um executável. Retorna o caminho ou null. */
    openExecutableFile(): Promise<string | null>;
    /** Abre diálogo para selecionar qualquer arquivo. Retorna o caminho ou null. */
    openAnyFile(): Promise<string | null>;
  };

  /** Integração com o shell do sistema operacional. */
  shell: {
    /**
     * Abre um caminho no explorador de arquivos ou aplicativo padrão.
     * @returns String de erro do Electron (vazia se bem-sucedido).
     */
    openPath(path: string): Promise<string>;
  };

  /** Informações gerais sobre a aplicação. */
  app: {
    /** Retorna a versão atual da aplicação. */
    getVersion(): Promise<string>;
    /** Retorna apenas o caminho da pasta de dados, sem calcular tamanho em disco. */
    getDataDirPath(): Promise<string>;
    /** Retorna estatísticas de armazenamento: total de jogos, tamanho e caminho do diretório de dados. */
    getStorageStats(): Promise<{ totalGames: number; dataDirSizeMb: number; dataDirPath: string }>;
    /** Remove o cache temporário de ROMs extraídas do launch. */
    clearExtractedRomCache(): Promise<{ rootDir: string; removedEntries: number }>;
  };

  /** Fluxo do updater usado pela splash screen. */
  updater: {
    /**
     * Registra listener para mudanças de fase/progresso do updater.
     * @returns Função de cleanup para remover o listener.
     */
    onStatus(callback: (status: UpdaterStatus) => void): () => void;
    /** Dispara uma verificação manual de update na janela principal. */
    checkNow(): Promise<void>;
    /** Solicita continuação do boot sem verificar update. */
    skip(): Promise<void>;
    /** Retorna versão semântica e identificador de build local. */
    getAppInfo(): Promise<UpdaterAppInfo>;
  };

  /**
   * Armazenamento chave-valor persistido (SQLite via processo principal).
   * Usado para guardar estado de UI e configurações entre sessões.
   */
  appState: {
    /** Lê o valor tipado de uma chave. Retorna null se não existir. */
    get<T>(key: string): Promise<T | null>;
    /** Lê os valores de múltiplas chaves de uma vez. */
    getMany(keys: string[]): Promise<Record<string, unknown>>;
    /** Grava ou sobrescreve o valor de uma chave. */
    set(key: string, value: unknown): Promise<void>;
    /**
     * Grava múltiplas entradas de uma vez.
     * @param onlyIfMissing - Quando true, ignora entradas cujas chaves já existem.
     */
    setMany(entries: AppStateEntry[], onlyIfMissing?: boolean): Promise<void>;
    /** Remove uma entrada pelo nome da chave. */
    remove(key: string): Promise<void>;
  };

  /** Fluxo de portabilidade de dados: exportação e importação de backups. */
  dataPortability: {
    /** Inicia exportação de backup; pode abrir diálogo nativo de salvar arquivo. */
    exportPackage(request: DataPortabilityExportRequest): Promise<DataPortabilityStartResult>;
    /** Lê e valida um pacote sem importar — retorna preview para exibição ao usuário. */
    previewImport(packagePath: string): Promise<DataPortabilityImportPreview>;
    /** Inicia importação de backup. */
    importPackage(request: DataPortabilityImportRequest): Promise<DataPortabilityJob>;
    /** Retorna jobs de portabilidade persistidos. */
    jobs(): Promise<DataPortabilityJob[]>;
    /**
     * Registra listener para progresso em tempo real de jobs de portabilidade.
     * @returns Função de cleanup para remover o listener.
     */
    onProgress(callback: (progress: DataPortabilityProgress) => void): () => void;
    /**
     * Registra listener para conclusão de jobs de portabilidade.
     * @returns Função de cleanup para remover o listener.
     */
    onCompleted(callback: (job: DataPortabilityJob) => void): () => void;
  };

  /** Integração com o banco de metadados LaunchBox. */
  launchbox: {
    /**
     * Garante que os metadados LaunchBox estão disponíveis, baixando se necessário.
     * @returns Status indicando se os dados vieram do cache ou foram baixados agora.
     */
    ensureMetadata(options?: { force?: boolean; jobId?: string }): Promise<{ status: "cached" | "downloaded" }>;
    /** Verifica se os metadados LaunchBox já foram baixados. */
    metadataExists(): Promise<boolean>;
    /** Busca jogos no índice LaunchBox por título e plataforma. */
    searchGames(params: LaunchBoxSearchParams): Promise<LaunchBoxGame[]>;
    /** Baixa imagens do LaunchBox para um jogo específico. */
    downloadImages(params: LaunchBoxDownloadParams): Promise<LaunchBoxDownloadResult>;
    /** Importa um jogo do LaunchBox para a biblioteca local. */
    importGame(params: LaunchBoxImportParams): Promise<LaunchBoxImportResult>;
    /**
     * Registra listener para progresso de download/indexação do LaunchBox.
     * @returns Função de cleanup para remover o listener.
     */
    onProgress(callback: (progress: LaunchBoxProgress) => void): () => void;
    /**
     * Registra listener para o evento de abertura do importador LaunchBox
     * (disparado pelo menu nativo).
     * @returns Função de cleanup para remover o listener.
     */
    onOpenImporter(callback: () => void): () => void;
  };

  /** Importação de ROMs por pasta do sistema de arquivos. */
  romFolderImport: {
    /** Escaneia pastas por arquivos de ROM e detecta plataforma. */
    scan(params: RomFolderScanRequest): Promise<RomFolderScanResult>;
    /** Inicia o job de importação de ROMs das pastas informadas. */
    import(params: RomFolderImportRequest): Promise<RomFolderImportJob>;
    /** Faz sync incremental das pastas configuradas, importando apenas ROMs novas. */
    syncConfiguredFolders(entries: DataPortabilityRomFolderEntry[]): Promise<void>;
    /** Retorna jobs de importação de pastas persistidos. */
    jobs(): Promise<RomFolderImportJob[]>;
    /** Conta registros de ROM importados de pastas/plataformas específicas. */
    countFolderRecords(params: RomFolderRecordCountRequest[]): Promise<RomFolderRecordCountResult[]>;
    /**
     * Remove registros de ROM importados de uma pasta.
     * Aceita string (caminho) ou objeto com folderPath e platformId opcional.
     */
    deleteFolderRecords(params: string | { folderPath: string; platformId?: number }): Promise<{ success: true; deleted: number }>;
    /**
     * Registra listener para progresso em tempo real do job de importação de pastas.
     * @returns Função de cleanup para remover o listener.
     */
    onProgress(callback: (progress: RomFolderImportProgress) => void): () => void;
    /**
     * Registra listener para conclusão de job de importação de pastas.
     * @returns Função de cleanup para remover o listener.
     */
    onCompleted(callback: (result: RomFolderImportResult) => void): () => void;
    /**
     * Registra listener para o evento de abertura do importador de pastas
     * (disparado pelo menu nativo).
     * @returns Função de cleanup para remover o listener.
     */
    onOpenImporter(callback: () => void): () => void;
  };

  /** Controle do modo de visualização da biblioteca. */
  view: {
    /**
     * Registra listener para mudanças de modo de visualização disparadas pelo menu nativo.
     * @returns Função de cleanup para remover o listener.
     */
    onSet(callback: (mode: ViewMode) => void): () => void;
  };

  /** Inventário físico de hardware: CRUD de itens, tipos, estados e fotos. */
  hardwareInventory: {
    /** Lista itens com filtros opcionais (plataforma, tipo, estado, busca). */
    itemsList(filters?: HardwareItemFilters): Promise<HardwareItemListResult>;
    /** Retorna um item pelo ID, ou null se não encontrado. */
    itemsGet(id: number): Promise<HardwareItem | null>;
    /** Cria um novo item de hardware. */
    itemsCreate(data: HardwareItemCreateInput): Promise<HardwareItem>;
    /** Atualiza um item de hardware existente. */
    itemsUpdate(id: number, data: HardwareItemUpdateInput): Promise<HardwareItem>;
    /** Remove um item e seus arquivos de foto do disco. */
    itemsDelete(id: number): Promise<{ success: true }>;

    /** Lista todos os tipos de item cadastrados. */
    typesList(): Promise<HardwareItemType[]>;
    /** Lista tipos com contagem de itens associados. */
    typesListWithCounts(): Promise<Array<{ id: number; name: string; count: number }>>;
    /** Cria um novo tipo de item personalizado. */
    typesCreate(name: string): Promise<HardwareItemType>;
    /** Remove um tipo de item pelo ID. */
    typesDelete(id: number): Promise<{ success: true }>;

    /** Lista todos os estados de conservação cadastrados. */
    statesList(): Promise<ConservationState[]>;
    /** Lista estados com contagem de itens associados. */
    statesListWithCounts(): Promise<Array<{ id: number; name: string; count: number }>>;
    /** Cria um novo estado de conservação personalizado. */
    statesCreate(name: string): Promise<ConservationState>;
    /** Remove um estado de conservação pelo ID. */
    statesDelete(id: number): Promise<{ success: true }>;

    /** Lista as fotos de um item, ordenadas por sort_order. */
    photosList(itemId: number): Promise<HardwareItemPhoto[]>;
    /** Adiciona uma foto ao item; copia o arquivo para userData e retorna o registro criado. */
    photosAdd(itemId: number, sourcePath: string): Promise<HardwareItemPhoto>;
    /** Remove uma foto pelo ID e exclui o arquivo do disco. */
    photosRemove(photoId: number): Promise<{ success: true }>;
    /** Troca a ordem de duas fotos na galeria. */
    photosReorder(idA: number, idB: number): Promise<{ success: true }>;

    /** Lista plataformas com ao menos um item de hardware cadastrado. */
    platformsWithItems(): Promise<Array<{ id: number; name: string; count: number }>>;
  };

  /** Ações de UI da biblioteca disparadas pelo menu nativo. */
  library: {
    /**
     * Registra listener para o evento de abertura do modal de criação de jogo.
     * @returns Função de cleanup para remover o listener.
     */
    onOpenCreateGame(callback: () => void): () => void;
    /**
     * Registra listener para o evento de abertura do gerenciador de plataformas.
     * @returns Função de cleanup para remover o listener.
     */
    onOpenPlatformManager(callback: () => void): () => void;
    /**
     * Registra listener para mudanças de critério de ordenação da biblioteca.
     * @returns Função de cleanup para remover o listener.
     */
    onSetSort(callback: (sortBy: GameSortBy) => void): () => void;
  };
}

/** Estende a interface global Window para incluir `gameStockAPI` como propriedade tipada. */
declare global {
  interface Window {
    /** API GameStock exposta pelo preload via contextBridge. */
    gameStockAPI: GameStockAPI;
  }
}
