/**
 * Constante central com todos os nomes de canais IPC usados na comunicação
 * entre o processo principal (main) e o renderer via Electron IPC.
 *
 * Cada chave representa um canal registrado com `ipcMain.handle` no main
 * e invocado com `ipcRenderer.invoke` (ou `ipcRenderer.on` para eventos push)
 * através do preload exposto em `window.gameStockAPI`.
 *
 * Agrupados por domínio funcional para facilitar localização e manutenção.
 */
export const IPC_CHANNELS = {
  /** Operações sobre jogos cadastrados na biblioteca. */
  games: {
    /** Lista jogos com filtros opcionais (paginação, plataforma, busca). */
    list: "games:list",
    /** Retorna um jogo pelo ID. */
    get: "games:get",
    /** Lista os arquivos de mídia associados a um jogo (capas, screenshots etc.). */
    listMedia: "games:listMedia",
    /** Retorna contagens de favoritos, jogando e concluídos na coleção. */
    collectionCounts: "games:collectionCounts",
    /** Retorna estatísticas de capas (total, baixadas, faltando, sincronizáveis). */
    coverStats: "games:coverStats",
    /** Evento push do main para o renderer quando as estatísticas de capa são atualizadas. */
    coverStatsUpdated: "games:coverStatsUpdated",
    /** Inicia a sincronização de capas com o LaunchBox. */
    syncCovers: "games:syncCovers",
    /** Cria um novo jogo na biblioteca. */
    create: "games:create",
    /** Atualiza os dados de um jogo existente. */
    update: "games:update",
    /** Remove um jogo da biblioteca. */
    delete: "games:delete",
    /** Inicia o jogo com o emulador configurado para a plataforma. */
    launch: "games:launch"
  },

  /** Operações sobre emuladores cadastrados e seus vínculos com plataformas. */
  emulators: {
    /** Lista todos os emuladores cadastrados. */
    list: "emulators:list",
    /** Cria um novo emulador. */
    create: "emulators:create",
    /** Atualiza os dados de um emulador existente. */
    update: "emulators:update",
    /** Remove um emulador. */
    delete: "emulators:delete",
    /** Vincula um emulador a uma plataforma, com opção de definir como padrão. */
    linkPlatform: "emulators:linkPlatform",
    /** Remove o vínculo entre um emulador e uma plataforma. */
    unlinkPlatform: "emulators:unlinkPlatform",
    /** Lista emuladores vinculados a uma plataforma específica. */
    listByPlatform: "emulators:listByPlatform",
    /** Lista os cores RetroArch instalados no diretório configurado do emulador. */
    listRetroArchCores: "emulators:listRetroArchCores"
  },

  /** Operações sobre plataformas (consoles/sistemas) cadastradas. */
  platforms: {
    /** Lista todas as plataformas cadastradas. */
    list: "platforms:list",
    /** Cria uma nova plataforma. */
    create: "platforms:create",
    /** Atualiza os dados de uma plataforma existente. */
    update: "platforms:update",
    /** Remove uma plataforma. */
    delete: "platforms:delete",
    /** Retorna os mapeamentos (aliases e extensões de ROM) de uma plataforma. */
    getMappings: "platforms:getMappings",
    /** Salva os mapeamentos (aliases e extensões de ROM) de uma plataforma. */
    saveMappings: "platforms:saveMappings"
  },

  /** Diálogos nativos do sistema operacional para seleção de arquivos e pastas. */
  dialogs: {
    /** Abre diálogo para selecionar um único arquivo de ROM. */
    openRomFile: "dialogs:openRomFile",
    /** Abre diálogo para selecionar múltiplos arquivos de ROM. */
    openRomFiles: "dialogs:openRomFiles",
    /** Abre diálogo para selecionar um arquivo de imagem. */
    openImageFile: "dialogs:openImageFile",
    /** Abre diálogo para salvar um arquivo de imagem com nome sugerido. */
    saveImageFile: "dialogs:saveImageFile",
    /** Abre diálogo para selecionar uma única pasta de ROM. */
    openRomFolder: "dialogs:openRomFolder",
    /** Abre diálogo para selecionar múltiplas pastas de ROM. */
    openRomFolders: "dialogs:openRomFolders",
    /** Abre diálogo para selecionar um arquivo executável (emulador). */
    openExecutableFile: "dialogs:openExecutableFile",
    /** Abre diálogo para selecionar qualquer arquivo sem filtro de tipo. */
    openAnyFile: "dialogs:openAnyFile"
  },

  /** Integração com o shell do sistema operacional. */
  shell: {
    /** Abre um caminho no explorador de arquivos ou aplicativo padrão do SO. */
    openPath: "shell:openPath"
  },

  /** Informações gerais sobre a aplicação. */
  app: {
    /** Retorna a versão atual da aplicação (definida no package.json). */
    getVersion: "app:getVersion",
    /** Retorna estatísticas de armazenamento: total de jogos, tamanho e caminho do diretório de dados. */
    getStorageStats: "app:getStorageStats"
  },

  /**
   * Armazenamento chave-valor persistido de estado da aplicação (SQLite).
   * Usado para guardar configurações de UI e estado de jobs entre sessões.
   */
  appState: {
    /** Lê o valor de uma chave. */
    get: "appState:get",
    /** Lê os valores de múltiplas chaves de uma vez. */
    getMany: "appState:getMany",
    /** Grava ou sobrescreve o valor de uma chave. */
    set: "appState:set",
    /** Grava múltiplas entradas de uma vez, com opção de gravar somente se ausentes. */
    setMany: "appState:setMany",
    /** Remove uma entrada pelo nome da chave. */
    remove: "appState:remove"
  },

  /**
   * Fluxo de portabilidade de dados: exportação e importação de backups
   * no formato `.gamestock-backup` (zip).
   */
  dataPortability: {
    /** Inicia a exportação de um pacote de backup com as categorias selecionadas. */
    exportPackage: "dataPortability:exportPackage",
    /** Pré-visualiza o conteúdo de um pacote de backup antes de importar. */
    previewImport: "dataPortability:previewImport",
    /** Inicia a importação de um pacote de backup. */
    importPackage: "dataPortability:importPackage",
    /** Lista os jobs de portabilidade persistidos. */
    jobs: "dataPortability:jobs",
    /** Evento push com progresso do job de exportação/importação em andamento. */
    progress: "dataPortability:progress",
    /** Evento push emitido quando um job de portabilidade é concluído. */
    completed: "dataPortability:completed"
  },

  /** Integração com o banco de metadados LaunchBox para busca e importação de jogos. */
  launchbox: {
    /** Garante que os metadados do LaunchBox estão baixados e indexados; baixa se necessário. */
    ensureMetadata: "launchbox:ensureMetadata",
    /** Verifica se os metadados do LaunchBox já existem no disco. */
    metadataExists: "launchbox:metadataExists",
    /** Busca jogos no índice do LaunchBox por título e plataforma. */
    searchGames: "launchbox:searchGames",
    /** Baixa imagens do LaunchBox para um jogo específico. */
    downloadImages: "launchbox:downloadImages",
    /** Importa um jogo do LaunchBox para a biblioteca local. */
    importGame: "launchbox:importGame",
    /** Evento push com progresso do download/indexação do LaunchBox. */
    progress: "launchbox:progress",
    /** Evento push para abrir o modal do importador LaunchBox a partir do menu nativo. */
    openImporter: "launchbox:openImporter"
  },

  /**
   * Importação de ROMs a partir de pastas do sistema de arquivos.
   * Faz scan, match com LaunchBox e inserção em lote na biblioteca.
   */
  romFolderImport: {
    /** Escaneia pastas por arquivos de ROM e detecta plataforma. */
    scan: "romFolderImport:scan",
    /** Inicia o job de importação de ROMs das pastas escaneadas. */
    import: "romFolderImport:import",
    /** Lista jobs de importação de pastas persistidos. */
    jobs: "romFolderImport:jobs",
    /** Conta quantos registros de ROM foram importados de uma pasta/plataforma. */
    countFolderRecords: "romFolderImport:countFolderRecords",
    /** Remove registros de ROMs importados de uma pasta (ou filtrados por plataforma). */
    deleteFolderRecords: "romFolderImport:deleteFolderRecords",
    /** Evento push com progresso do job de importação em andamento. */
    progress: "romFolderImport:progress",
    /** Evento push emitido quando um job de importação de pasta é concluído. */
    completed: "romFolderImport:completed",
    /** Evento push para abrir o modal do importador de pastas a partir do menu nativo. */
    openImporter: "romFolderImport:openImporter",
  },

  /**
   * Ações de UI da biblioteca de jogos disparadas pelo menu nativo ou atalhos.
   * Comunicam intenção do main para o renderer abrir modais ou alterar estado.
   */
  library: {
    /** Evento push para abrir o modal de criação de jogo manual. */
    openCreateGame: "library:openCreateGame",
    /** Evento push para abrir o gerenciador de plataformas. */
    openPlatformManager: "library:openPlatformManager",
    /** Evento push para alterar o critério de ordenação da biblioteca. */
    setSort: "library:setSort"
  },

  /** Controle do modo de visualização da biblioteca (grade ou lista). */
  view: {
    /** Evento push para alternar entre os modos de visualização disponíveis. */
    set: "view:set"
  },

  /**
   * Inventário físico de hardware: consoles, controles, cabos, acessórios e outros itens.
   * Inclui CRUD de itens, tipos de item, estados de conservação e galeria de fotos.
   */
  hardwareInventory: {
    /** Lista itens com filtros opcionais (plataforma, tipo, estado, busca). */
    itemsList:   "hardwareInventory:items:list",
    /** Retorna um item pelo ID. */
    itemsGet:    "hardwareInventory:items:get",
    /** Cria um novo item de hardware. */
    itemsCreate: "hardwareInventory:items:create",
    /** Atualiza os dados de um item existente. */
    itemsUpdate: "hardwareInventory:items:update",
    /** Remove um item e seus arquivos de foto do disco. */
    itemsDelete: "hardwareInventory:items:delete",

    /** Lista todos os tipos de item cadastrados. */
    typesList:   "hardwareInventory:types:list",
    /** Lista tipos com contagem de itens associados. */
    typesListWithCounts: "hardwareInventory:types:listWithCounts",
    /** Cria um novo tipo de item personalizado. */
    typesCreate: "hardwareInventory:types:create",
    /** Remove um tipo de item pelo ID. */
    typesDelete: "hardwareInventory:types:delete",

    /** Lista todos os estados de conservação cadastrados. */
    statesList:   "hardwareInventory:states:list",
    /** Lista estados com contagem de itens associados. */
    statesListWithCounts: "hardwareInventory:states:listWithCounts",
    /** Cria um novo estado de conservação personalizado. */
    statesCreate: "hardwareInventory:states:create",
    /** Remove um estado de conservação pelo ID. */
    statesDelete: "hardwareInventory:states:delete",

    /** Lista as fotos de um item. */
    photosList:   "hardwareInventory:photos:list",
    /** Adiciona uma foto ao item: copia o arquivo para userData e cria o registro. */
    photosAdd:    "hardwareInventory:photos:add",
    /** Remove uma foto pelo ID e exclui o arquivo do disco. */
    photosRemove: "hardwareInventory:photos:remove",
    /** Troca a ordem de duas fotos na galeria de um item. */
    photosReorder: "hardwareInventory:photos:reorder",

    /** Lista plataformas que possuem ao menos um item de hardware cadastrado. */
    platformsWithItems: "hardwareInventory:platforms:withItems"
  }
} as const;
