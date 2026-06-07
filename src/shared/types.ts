/**
 * Tipos compartilhados entre o processo principal (main), preload e renderer.
 *
 * Este arquivo centraliza todas as interfaces, tipos e constantes de domínio
 * usados na aplicação GameStock: jogos, plataformas, emuladores, importação
 * de ROMs, integração com LaunchBox e portabilidade de dados.
 *
 * Importado tanto pelo main (SQLite/IPC handlers) quanto pelo renderer (React/Zustand).
 */

// ---------------------------------------------------------------------------
// Enumerações e union types de UI
// ---------------------------------------------------------------------------

/** Modo de visualização da biblioteca: grade de capas ou lista detalhada. */
export type ViewMode = "grid" | "list";

/** Status de progresso de um jogo na coleção do usuário. */
export type PlayStatus = "unplayed" | "playing" | "completed";

/**
 * Filtro de coleção disponível na barra lateral da biblioteca.
 * "all" exibe todos os jogos; os demais filtram por status ou marcação.
 */
export type CollectionFilter = "all" | "favorites" | "playing" | "completed" | "unplayed" | "mostPlayed";

// ---------------------------------------------------------------------------
// Contagens e estatísticas da coleção
// ---------------------------------------------------------------------------

/** Contagens de jogos por status especial na coleção do usuário. */
export interface CollectionCounts {
  /** Total de jogos marcados como favorito. */
  favorites: number;
  /** Total de jogos com status "playing" (jogando). */
  playing: number;
  /** Total de jogos com status "completed" (concluído). */
  completed: number;
  /** Total de jogos que já foram executados ao menos uma vez. */
  mostPlayed: number;
}

/** Estatísticas agregadas do histórico de partidas da biblioteca. */
export interface GameLaunchStats {
  /** Soma total de partidas iniciadas em todos os jogos. */
  totalLaunches: number;
  /** Quantidade de jogos que possuem ao menos uma partida registrada. */
  playedGames: number;
}

/** Estatísticas sobre a situação das capas de jogos na biblioteca. */
export interface CoverSyncStats {
  /** Total de jogos na biblioteca. */
  total: number;
  /** Jogos que já possuem capa baixada. */
  downloaded: number;
  /** Jogos sem capa disponível. */
  missing: number;
  /** Jogos elegíveis para sincronização de capa (têm ID LaunchBox mas sem capa local). */
  syncable: number;
  /** Jogos cujos metadados do LaunchBox podem ser atualizados. */
  metadataSyncable: number;
  /** Data/hora do último download de metadados, ou null se nunca baixado. */
  metadataDownloadedAt: string | null;
}

/** Item de falha individual durante uma sincronização de capas. */
export interface CoverSyncFailureItem {
  /** ID interno do jogo no SQLite. */
  gameId: number;
  /** Título do jogo. */
  title: string;
  /** Nome da plataforma do jogo. */
  platformName: string;
  /** Motivo da falha no download da capa. */
  reason: string;
  /** ID do jogo no LaunchBox, ou null se não vinculado. */
  launchboxId: string | null;
}

/**
 * Resultado completo de uma operação de sincronização de capas.
 * Estende CoverSyncStats com contagens de tentativas e falhas individuais.
 */
export interface CoverSyncResult extends CoverSyncStats {
  /** Total de jogos nos quais o download foi tentado nesta execução. */
  attempted: number;
  /** Capas efetivamente baixadas nesta execução. */
  downloadedNow: number;
  /** Downloads que falharam nesta execução. */
  failed: number;
  /** Jogos ignorados (já possuíam capa ou sem ID LaunchBox). */
  skipped: number;
  /** Registros de metadados atualizados nesta execução. */
  metadataUpdated: number;
  /** Registros de metadados ignorados por já estarem atualizados. */
  metadataSkipped: number;
  /** Lista detalhada de falhas individuais. */
  failures: CoverSyncFailureItem[];
}

/** Critério de ordenação da lista de jogos na biblioteca. */
export type GameSortBy = "title" | "year" | "recent" | "mostPlayed";

/** Criterio de ordenacao da lista de itens do inventario de hardware. */
export type HardwareInventorySortBy = "name" | "type" | "recent";

// ---------------------------------------------------------------------------
// Emuladores
// ---------------------------------------------------------------------------

/** Registro de emulador cadastrado na biblioteca. */
export interface Emulator {
  /** ID interno no SQLite. */
  id: number;
  /** Nome de exibição do emulador. */
  name: string;
  /** Caminho completo para o executável do emulador. */
  executable: string;
  /** Argumentos de linha de comando passados ao executável (pode usar variáveis). */
  args: string;
  /** Flag indicando se é um emulador RetroArch (1 = sim, 0 = não). */
  is_retroarch: number;
  /** Data/hora de criação do registro. */
  created_at: string;
}

/**
 * Inventário de cores RetroArch instalados para um emulador configurado.
 * Retornado pelo canal IPC `emulators:listRetroArchCores`.
 */
export interface RetroArchCoreInventory {
  /** Caminho do diretório de cores configurado (ou null se não configurado). */
  coresDir: string | null;
  /** Indica se o diretório de cores existe no sistema de arquivos. */
  coresDirExists: boolean;
  /** Indica se o executável do emulador está configurado. */
  executableConfigured: boolean;
  /** Lista de nomes de arquivos de cores encontrados no diretório. */
  installedCores: string[];
}

// ---------------------------------------------------------------------------
// Plataformas e seus vínculos com emuladores
// ---------------------------------------------------------------------------

/** Vínculo entre uma plataforma e um emulador, com configurações de uso. */
export interface PlatformEmulator {
  /** ID da plataforma vinculada. */
  platform_id: number;
  /** ID do emulador vinculado. */
  emulator_id: number;
  /** Flag indicando se este é o emulador padrão para a plataforma (1 = sim). */
  is_default: number;
  /** Caminho do core RetroArch a usar para esta plataforma, ou null para emulador standalone. */
  core_path: string | null;
  /** Dados completos do emulador, quando carregados via JOIN. */
  emulator?: Emulator;
}

/** Registro de plataforma (console/sistema) cadastrada na biblioteca. */
export interface Platform {
  /** ID interno no SQLite. */
  id: number;
  /** Nome canônico da plataforma. */
  name: string;
  /** Categoria de agrupamento (ex.: "Console", "Portable", "Arcade"). */
  category: string;
  /** Flag indicando se é uma plataforma padrão do sistema (1 = sim, não pode ser removida). */
  is_default: number;
  /** Data/hora de criação do registro. */
  created_at: string;
  /** Quantidade de jogos desta plataforma na biblioteca (opcional, preenchido em queries específicas). */
  gameCount?: number;
}

/** Alias alternativo de nome para correspondência de plataforma com o LaunchBox. */
export interface PlatformLaunchBoxAlias {
  /** ID interno no SQLite (opcional em criação). */
  id?: number;
  /** ID da plataforma à qual o alias pertence. */
  platform_id: number;
  /** Nome da plataforma (opcional, preenchido via JOIN). */
  platform_name?: string;
  /** Texto do alias (ex.: "NES", "Famicom"). */
  alias: string;
}

/** Extensão de arquivo ROM associada a uma plataforma. */
export interface PlatformRomExtension {
  /** ID interno no SQLite (opcional em criação). */
  id?: number;
  /** ID da plataforma à qual a extensão pertence. */
  platform_id: number;
  /** Nome da plataforma (opcional, preenchido via JOIN). */
  platform_name?: string;
  /** Extensão sem ponto (ex.: "sfc", "zip"). */
  extension: string;
  /** Tipo do arquivo (ex.: "rom", "disc"). */
  kind: string;
  /** Flag indicando se é a extensão primária da plataforma (1 = sim). */
  is_primary: number;
}

/** Conjunto completo de mapeamentos de uma plataforma (aliases + extensões de ROM). */
export interface PlatformMappings {
  /** Lista de aliases LaunchBox da plataforma. */
  aliases: PlatformLaunchBoxAlias[];
  /** Lista de extensões de ROM da plataforma. */
  romExtensions: PlatformRomExtension[];
}

/** Payload para salvar mapeamentos de uma plataforma via IPC. */
export interface PlatformMappingsInput {
  /** Strings de aliases a associar. */
  aliases: string[];
  /** Extensões a associar com seus metadados. */
  romExtensions: Array<{
    /** Extensão sem ponto. */
    extension: string;
    /** Tipo do arquivo. */
    kind: string;
    /** Indica se é a extensão primária. */
    is_primary: boolean;
  }>;
}

// ---------------------------------------------------------------------------
// Inventário físico de hardware
// ---------------------------------------------------------------------------

/** Tipo de item de hardware (ex: Console, Controle, Cabo). */
export interface HardwareItemType {
  id: number;
  name: string;
  /** 1 = padrão do sistema; 0 = criado pelo usuário */
  is_default: number;
  created_at: string;
}

/** Estado de conservação de um item de hardware (ex: Novo, Bom, Ruim). */
export interface ConservationState {
  id: number;
  name: string;
  /** 1 = padrão do sistema; 0 = criado pelo usuário */
  is_default: number;
  created_at: string;
}

/** Foto associada a um item de hardware. */
export interface HardwareItemPhoto {
  id: number;
  item_id: number;
  file_path: string;
  sort_order: number;
  created_at: string;
}

/** Item físico de hardware cadastrado no inventário. */
export interface HardwareItem {
  id: number;
  name: string;
  platform_id: number | null;
  /** 1 = item serve varias plataformas; 0 = usa plataforma real da biblioteca. */
  is_multiplatform: number;
  platform_name: string | null;
  item_type_id: number | null;
  item_type_name: string | null;
  conservation_state_id: number | null;
  conservation_state_name: string | null;
  description: string;
  acquisition_date: string | null;
  acquisition_url: string | null;
  color: string | null;
  value: number | null;
  serial_number: string | null;
  region: string | null;
  storage_location: string | null;
  loan_to: string | null;
  created_at: string;
  updated_at: string;
  /** Caminho da foto de capa (menor sort_order), ou null se sem fotos. */
  cover_photo_path: string | null;
}

/** Filtros opcionais para listagem de itens de hardware. */
export interface HardwareItemFilters {
  platformId?: number | null;
  itemTypeId?: number | null;
  conservationStateId?: number | null;
  search?: string | null;
  /** Ordenacao aplicada no SQLite para manter paginas consistentes. */
  sortBy?: HardwareInventorySortBy;
  page?: number;
  pageSize?: number;
}

/** Resultado paginado da listagem de itens de hardware. */
export interface HardwareItemListResult {
  items: HardwareItem[];
  total: number;
  filtered: number;
}

/** Campos para criação de um item de hardware. */
export interface HardwareItemCreateInput {
  name: string;
  platform_id?: number | null;
  /** Mantem "Multiplataforma" restrito ao inventario, sem aparecer na biblioteca. */
  is_multiplatform?: boolean | number | null;
  item_type_id?: number | null;
  conservation_state_id?: number | null;
  description: string;
  acquisition_date?: string | null;
  acquisition_url?: string | null;
  color?: string | null;
  value?: number | null;
  serial_number?: string | null;
  region?: string | null;
  storage_location?: string | null;
  loan_to?: string | null;
}

/** Campos para atualização de um item de hardware (todos opcionais). */
export type HardwareItemUpdateInput = Partial<HardwareItemCreateInput>;

// ---------------------------------------------------------------------------
// Portabilidade de dados (exportação / importação de backup)
// ---------------------------------------------------------------------------

/**
 * Categorias de dados suportadas no pacote de backup.
 * Cada categoria é independente e pode ser incluída/excluída individualmente.
 */
export type DataPortabilityCategory = "metadata" | "images" | "platforms" | "romLocations" | "inventoryImages";

/** Array com todas as categorias disponíveis, na ordem padrão de exportação. */
export const DATA_PORTABILITY_CATEGORIES: DataPortabilityCategory[] = [
  "metadata",
  "images",
  "platforms",
  "romLocations",
  "inventoryImages"
];

/** Severidade de um aviso ou erro gerado durante exportação/importação. */
export type DataPortabilityWarningSeverity = "info" | "warning" | "error";

/** Mensagem de aviso ou erro gerada durante um fluxo de portabilidade de dados. */
export interface DataPortabilityWarning {
  /** Nível de severidade da mensagem. */
  severity: DataPortabilityWarningSeverity;
  /** Código de máquina identificando o tipo de aviso (ex.: "MISSING_IMAGE"). */
  code: string;
  /** Mensagem legível por humano descrevendo o aviso. */
  message: string;
  /** Informação adicional de contexto (ex.: nome do arquivo afetado). */
  detail?: string;
}

/** Contagens de registros por entidade incluídos em um pacote de backup. */
export interface DataPortabilityCounts {
  /** Total de jogos exportados/importados. */
  games: number;
  /** Total de plataformas exportadas/importadas. */
  platforms: number;
  /** Total de imagens exportadas/importadas. */
  images: number;
  /** Total de caminhos de ROM exportados/importados. */
  romLocations: number;
  /** Total de entradas de pastas de ROM exportadas/importadas. */
  romFolderEntries: number;
  /** Total de emuladores exportados/importados. */
  emulators: number;
  /** Total de itens de hardware do inventário exportados/importados. */
  inventoryItems: number;
  /** Total de fotos do inventário exportadas/importadas. */
  inventoryPhotos: number;
}

/** Manifesto incluído no pacote de backup com metadados da exportação. */
export interface DataPortabilityManifest {
  /** Versão do schema do pacote (para compatibilidade futura). */
  schemaVersion: number;
  /** Versão do app que gerou o pacote. */
  appVersion: string;
  /** Data/hora ISO de criação do pacote. */
  createdAt: string;
  /** Categorias incluídas neste pacote. */
  categories: DataPortabilityCategory[];
  /** Contagens parciais de registros por categoria incluída. */
  counts: Partial<DataPortabilityCounts>;
}

/** Entrada de pasta de ROM incluída no backup para restaurar configurações de importação. */
export interface DataPortabilityRomFolderEntry {
  /** Caminho da pasta de ROM no sistema de origem. */
  folderPath: string;
  /** ID da plataforma associada no sistema de origem. */
  platformId: number;
  /** Nome da plataforma (chave estável para match na importação). */
  platformName: string;
  /** Quantidade de ROMs indexadas nesta pasta. */
  indexedCount: number;
  /** Indica se subpastas eram incluídas no scan. */
  includeSubfolders?: boolean;
}

/** Parâmetros para iniciar uma exportação de backup. */
export interface DataPortabilityExportRequest {
  /** Categorias a incluir no pacote. */
  categories: DataPortabilityCategory[];
  /** Caminho de destino do arquivo (null abre diálogo nativo de salvar). */
  targetPath?: string | null;
  /** Entradas de pastas de ROM a incluir na categoria romLocations. */
  romFolderEntries?: DataPortabilityRomFolderEntry[];
}

/** Resultado de uma operação de exportação de backup. */
export interface DataPortabilityExportResult {
  /** Indica se o usuário cancelou o diálogo de salvar arquivo. */
  canceled: boolean;
  /** Caminho do arquivo gerado, ou null se cancelado. */
  filePath: string | null;
  /** Manifesto do pacote gerado (presente quando não cancelado). */
  manifest?: DataPortabilityManifest;
  /** Avisos gerados durante a exportação (ex.: imagens faltando). */
  warnings: DataPortabilityWarning[];
}

/** Contagens de conflitos por tipo de operação na importação de uma entidade. */
export interface DataPortabilityConflictCounts {
  /** Registros que serão criados (não existem localmente). */
  create: number;
  /** Registros que serão atualizados (existem mas diferem). */
  update: number;
}

/** Pré-visualização do conteúdo de um pacote antes da importação efetiva. */
export interface DataPortabilityImportPreview {
  /** Caminho do arquivo de backup a importar. */
  packagePath: string;
  /** Manifesto lido do pacote. */
  manifest: DataPortabilityManifest;
  /** Categorias disponíveis neste pacote (pode ser subconjunto das suportadas). */
  availableCategories: DataPortabilityCategory[];
  /** Contagens de registros por categoria no pacote. */
  counts: Partial<DataPortabilityCounts>;
  /** Avisos não-críticos encontrados na validação do pacote. */
  warnings: DataPortabilityWarning[];
  /** Erros críticos que impediriam a importação (ex.: versão incompatível). */
  errors: DataPortabilityWarning[];
  /** Resumo de conflitos por entidade (criações vs. atualizações esperadas). */
  conflicts: {
    games: DataPortabilityConflictCounts;
    platforms: DataPortabilityConflictCounts;
    emulators: DataPortabilityConflictCounts;
  };
}

/** Parâmetros para iniciar uma importação de backup. */
export interface DataPortabilityImportRequest {
  /** Caminho do arquivo de backup a importar. */
  packagePath: string;
  /** Categorias a processar (subset do que está disponível no pacote). */
  categories: DataPortabilityCategory[];
}

/** Resumo detalhado do resultado de uma importação de backup concluída com sucesso. */
export interface DataPortabilityImportSummary {
  /** Contagens de jogos processados na importação de metadados. */
  metadata: {
    /** Jogos novos criados. */
    created: number;
    /** Jogos existentes atualizados. */
    updated: number;
    /** Jogos ignorados por já estarem idênticos. */
    skipped: number;
  };
  /** Contagens de plataformas e vínculos processados. */
  platforms: {
    /** Plataformas novas criadas. */
    created: number;
    /** Plataformas existentes atualizadas. */
    updated: number;
    /** Mapeamentos (aliases/extensões) importados. */
    mappings: number;
    /** Emuladores importados. */
    emulators: number;
    /** Vínculos plataforma-emulador criados. */
    links: number;
  };
  /** Contagens de imagens processadas. */
  images: {
    /** Imagens copiadas com sucesso. */
    imported: number;
    /** Imagens ignoradas por já existirem localmente. */
    skipped: number;
    /** Imagens referenciadas no pacote mas ausentes do arquivo zip. */
    missing: number;
  };
  /** Contagens de localizações de ROM processadas. */
  romLocations: {
    /** Caminhos de ROM atualizados. */
    updated: number;
    /** Caminhos de ROM ignorados (jogo não encontrado localmente). */
    skipped: number;
    /** Entradas de pasta de ROM importadas. */
    romFolderEntries: number;
  };
  /** Contagens de itens de inventário de hardware processados. */
  inventoryImages?: {
    /** Itens de hardware criados. */
    itemsCreated: number;
    /** Itens de hardware atualizados. */
    itemsUpdated: number;
    /** Fotos de inventário copiadas. */
    photosImported: number;
  };
  /** Avisos gerados durante a importação. */
  warnings: DataPortabilityWarning[];
  /** Entradas de pasta de ROM efetivamente importadas. */
  romFolderEntries: DataPortabilityRomFolderEntry[];
}

/** Resultado de uma importação de backup concluída com sucesso. */
export interface DataPortabilityImportResult {
  /** Sempre true — indica que não houve erro fatal. */
  success: true;
  /** Resumo detalhado das operações realizadas. */
  summary: DataPortabilityImportSummary;
}

/** Tipo do job de portabilidade: exportação ou importação. */
export type DataPortabilityJobKind = "export" | "import";

/** Status atual de um job de portabilidade de dados. */
export type DataPortabilityJobStatus = "running" | "completed" | "failed" | "interrupted";

/**
 * Estágio atual de processamento dentro de um job de portabilidade.
 * Usado para exibir progresso granular na UI.
 */
export type DataPortabilityStage =
  | "preparing"    // Inicializando o job
  | "metadata"     // Processando metadados de jogos
  | "platforms"    // Processando plataformas e emuladores
  | "images"       // Copiando/importando imagens
  | "rom_locations" // Processando caminhos de ROM
  | "writing"      // Gravando o arquivo zip (exportação)
  | "validating"   // Validando o pacote (importação)
  | "importing"    // Importando registros no SQLite
  | "done"         // Concluído com sucesso
  | "error";       // Encerrado com erro

/** Progresso em tempo real de um job de portabilidade, emitido via evento IPC push. */
export interface DataPortabilityProgress {
  /** ID do job ao qual este progresso pertence. */
  jobId?: string;
  /** Tipo do job (exportação ou importação). */
  kind: DataPortabilityJobKind;
  /** Item atual sendo processado (numerador). */
  current: number;
  /** Total de itens a processar (denominador). */
  total: number;
  /** Estágio atual do processamento. */
  stage: DataPortabilityStage;
  /** Mensagem descritiva do que está sendo feito no momento. */
  message: string;
}

/** Representação completa de um job de portabilidade de dados. */
export interface DataPortabilityJob {
  /** Identificador único do job (UUID). */
  jobId: string;
  /** Tipo do job. */
  kind: DataPortabilityJobKind;
  /** Status atual do job. */
  status: DataPortabilityJobStatus;
  /** Data/hora ISO de início do job. */
  startedAt: string;
  /** Último progresso recebido para este job. */
  progress: DataPortabilityProgress;
  /** Caminho do arquivo de backup gerado/lido (quando disponível). */
  packagePath?: string | null;
  /** Resultado da exportação (presente quando kind="export" e status="completed"). */
  exportResult?: DataPortabilityExportResult;
  /** Resultado da importação (presente quando kind="import" e status="completed"). */
  importResult?: DataPortabilityImportResult;
  /** Mensagem de erro (presente quando status="failed"). */
  error?: string;
}

/**
 * Resultado do início de um job de portabilidade.
 * Pode ser um job iniciado normalmente ou indicar que o usuário cancelou o diálogo.
 */
export type DataPortabilityStartResult = DataPortabilityJob | { canceled: true; filePath: null; warnings: DataPortabilityWarning[] };

// ---------------------------------------------------------------------------
// Jogos
// ---------------------------------------------------------------------------

/** Registro completo de um jogo na biblioteca. */
export interface Game {
  /** ID interno no SQLite. */
  id: number;
  /** Título do jogo. */
  title: string;
  /** ID da plataforma à qual o jogo pertence. */
  platform_id: number;
  /** Nome da plataforma (preenchido via JOIN em queries específicas). */
  platform_name?: string;
  /** Nome do publicador/distribuidor, ou null. */
  publisher: string | null;
  /** Ano de lançamento, ou null se desconhecido. */
  year: number | null;
  /** Gênero(s) do jogo, ou null. */
  genre: string | null;
  /** Classificação etária (ex.: "E", "T", "M"), ou null. */
  rating: string | null;
  /** Caminho local da imagem de capa (box art), ou null. */
  box_art_path: string | null;
  /** Caminho local da imagem de plano de fundo, ou null. */
  background_path: string | null;
  /** Caminho local de uma screenshot, ou null. */
  screenshot_path: string | null;
  /** Caminho local do arquivo ROM, ou null se não vinculado. */
  rom_path: string | null;
  /** Indica se o jogo está marcado como favorito. */
  favorite: boolean;
  /** Status de progresso do jogo na coleção do usuário. */
  play_status: PlayStatus;
  /** Notas pessoais do usuário sobre o jogo. */
  notes: string | null;
  /** ID do jogo no banco de dados LaunchBox, ou null se não vinculado. */
  launchbox_id: string | null;
  /** Quantidade total de vezes que o usuário iniciou este jogo. */
  launch_count: number;
  /** Data/hora ISO de criação do registro. */
  created_at: string;
  /** Data/hora ISO da última atualização do registro. */
  updated_at: string;
}

/** Parâmetros de filtro para listagem de jogos na biblioteca. */
export interface GameFilters {
  /** Filtra por plataforma específica (null = todas). */
  platformId?: number | null;
  /** Texto de busca livre (aplicado no título). */
  search?: string;
  /** Filtro de coleção (favoritos, status de jogo etc.). */
  collectionFilter?: CollectionFilter;
  /** Critério de ordenação. */
  sortBy?: GameSortBy;
  /** Página atual para paginação (base 1). */
  page?: number;
  /** Quantidade de itens por página. */
  pageSize?: number;
}

/**
 * Tipo para criação de um jogo: exclui campos gerados automaticamente pelo banco.
 * (`id`, `platform_name`, `created_at`, `updated_at`)
 */
export type GameCreateInput = Omit<Game, "id" | "platform_name" | "created_at" | "updated_at">;

/** Tipo para atualização parcial de um jogo: todos os campos de criação são opcionais. */
export type GameUpdateInput = Partial<GameCreateInput>;

/** Resultado paginado da listagem de jogos. */
export interface GameListResult {
  /** Jogos da página atual. */
  items: Game[];
  /** Total de jogos sem filtros (apenas plataforma). */
  total: number;
  /** Total de jogos após aplicar todos os filtros ativos. */
  filtered: number;
}

/** Opção de versão disponível para iniciar um jogo antes do launch efetivo. */
export interface GameVersionOption {
  /** ID do jogo/variante no SQLite. */
  id: number;
  /** Título salvo na biblioteca para a variante. */
  title: string;
  /** Nome da plataforma para exibição contextual. */
  platformName: string | null;
  /** Quantidade de vezes que esta variante já foi iniciada. */
  launchCount: number;
  /** Nome completo do arquivo ROM para diferenciar variantes. */
  romFileName: string;
  /** Título-base usado para agrupar versões relacionadas. */
  baseTitle: string;
  /** Rótulo de região detectado automaticamente (JAP/USA/EUR etc.). */
  regionLabel: string | null;
  /** Rótulo de tipo detectado automaticamente (Hack/Translation/Revision etc.). */
  typeLabel: string | null;
  /** Resumo curto já pronto para a UI diferenciar a versão. */
  variantLabel: string;
}

/** Item de mídia associado a um jogo (capa, screenshot, plano de fundo etc.). */
export interface GameMediaItem {
  /** Caminho local do arquivo de mídia. */
  path: string;
  /** Rótulo de exibição para o tipo de mídia. */
  label: string;
  /** Tipo semântico do arquivo de mídia. */
  kind: "box-art" | "cart" | "background" | "screenshot" | "cover" | "other";
}

// ---------------------------------------------------------------------------
// Integração com LaunchBox
// ---------------------------------------------------------------------------

/**
 * Tipos de imagem suportados pelo LaunchBox.
 * Usados para filtrar quais imagens baixar durante a importação.
 */
export type LaunchBoxImageType =
  | "Box - 3D"
  | "Box - Front"
  | "Box - Front - Reconstructed"
  | "Box - Back"
  | "Box - Back - Reconstructed"
  | "Box - Spine"
  | "Screenshot - Gameplay"
  | "Fanart - Background"
  | "Banner"
  | "Clear Logo"
  | "Disc"
  | "Cart - Front"
  | "Screenshot - Game Title";

/** Imagem de um jogo no banco de dados LaunchBox. */
export interface LaunchBoxImage {
  /** Nome do arquivo da imagem no pacote LaunchBox. */
  filename: string;
  /** Tipo da imagem conforme classificação LaunchBox. */
  type: LaunchBoxImageType;
  /** Região da imagem (ex.: "North America", "Japan"), ou null se genérica. */
  region: string | null;
  /** URL de download da imagem (presente quando disponível via API). */
  url?: string;
}

/** Registro de jogo do banco de dados LaunchBox. */
export interface LaunchBoxGame {
  /** ID único do jogo no LaunchBox. */
  id: string;
  /** Título do jogo. */
  name: string;
  /** Nome da plataforma conforme o LaunchBox. */
  platform: string;
  /** Data de lançamento. */
  release: string;
  /** Nome do desenvolvedor. */
  developer: string;
  /** Nome do publicador. */
  publisher: string;
  /** Gêneros separados por ponto e vírgula. */
  genres: string;
  /** Sinopse/descrição do jogo. */
  overview: string;
  /** Número de jogadores suportados. */
  players: string;
  /** Classificação etária. */
  rating: string;
  /** Indica suporte a modo cooperativo. */
  cooperative: string;
  /** Lista de imagens disponíveis para o jogo. */
  images: LaunchBoxImage[];
}

/** Parâmetros para busca de jogos no índice LaunchBox. */
export interface LaunchBoxSearchParams {
  /** Texto de busca (título ou parte do título). */
  query: string;
  /** ID da plataforma local para restringir a busca com base nos aliases cadastrados. */
  platformId?: number | null;
  /** Nome da plataforma para restringir a busca (null = todas as plataformas). */
  platformName?: string | null;
}

/** Parâmetros para download de imagens de um jogo LaunchBox. */
export interface LaunchBoxDownloadParams {
  /** Jogo do qual as imagens serão baixadas. */
  game: LaunchBoxGame;
  /** Tipos de imagem a baixar. */
  types: LaunchBoxImageType[];
}

/** Resultado de um download de imagens LaunchBox. */
export interface LaunchBoxDownloadResult {
  /** Quantidade de imagens baixadas com sucesso. */
  success: number;
  /** Quantidade de imagens ignoradas (já existiam localmente). */
  skipped: number;
  /** Quantidade de imagens que falharam no download. */
  failed: number;
  /** Caminhos locais dos arquivos baixados com sucesso. */
  files: string[];
}

/** Progresso em tempo real de uma operação LaunchBox (download ou indexação). */
export interface LaunchBoxProgress {
  /** Item atual sendo processado. */
  current: number;
  /** Total de itens a processar. */
  total: number;
  /** Nome do arquivo sendo processado no momento. */
  filename?: string;
  /** Estágio atual da operação. */
  status: "downloading" | "extracting" | "indexing" | "skipped" | "done" | "error";
}

/** Parâmetros para importar um jogo do LaunchBox para a biblioteca local. */
export interface LaunchBoxImportParams {
  /** ID do jogo no LaunchBox a importar. */
  launchboxGameId: string;
  /** ID do jogo local a atualizar (null = criar novo jogo). */
  targetGameId?: number | null;
  /** ID da plataforma local a associar (null = detectar pelo nome da plataforma LaunchBox). */
  platformId?: number | null;
  /** Tipos de imagem a baixar durante a importação. */
  imageTypes: LaunchBoxImageType[];
}

/** Resultado de uma importação de jogo do LaunchBox. */
export interface LaunchBoxImportResult {
  /** ID do jogo criado ou atualizado na biblioteca local. */
  gameId: number;
  /** Indica se um novo jogo foi criado (true) ou um existente atualizado (false). */
  created: boolean;
  /** Caminho da capa baixada, ou null se não disponível. */
  boxArtPath: string | null;
  /** Indica que os metadados foram aplicados como outra versão, sem reutilizar `launchbox_id` duplicado. */
  linkedAsVariant?: boolean;
}

// ---------------------------------------------------------------------------
// Importação de ROMs por pasta
// ---------------------------------------------------------------------------

/**
 * Estágio atual do job de importação de ROMs por pasta.
 * Emitido via evento IPC push para exibir progresso granular na UI.
 */
export type RomFolderImportStage =
  | "preparing_metadata" // Baixando/verificando metadados LaunchBox
  | "matching"           // Fazendo match de arquivos ROM com jogos LaunchBox
  | "downloading"        // Baixando imagens dos jogos encontrados
  | "skipped"            // Item ignorado (já existe ou sem match)
  | "saving"             // Salvando registros no SQLite
  | "done"               // Importação concluída
  | "error";             // Erro fatal durante o job

/** Status do match de um arquivo ROM contra o banco de dados LaunchBox. */
export type RomFolderMatchStatus = "matched" | "unmatched" | "ambiguous";

/**
 * Modo de detecção de plataforma durante o scan de pastas de ROM.
 * - "manual": usuário seleciona a plataforma explicitamente.
 * - "automatic": sistema detecta a plataforma pelas extensões dos arquivos.
 */
export type RomFolderPlatformDetectionMode = "manual" | "automatic";

/** Plataforma detectada automaticamente durante o scan de uma pasta de ROM. */
export interface RomFolderDetectedPlatform {
  /** ID da plataforma detectada. */
  platformId: number;
  /** Nome da plataforma detectada. */
  platformName: string;
  /** Quantidade de arquivos ROM que levaram à detecção desta plataforma. */
  count: number;
}

/** Candidato a importação: arquivo ROM encontrado no scan de uma pasta. */
export interface RomFolderImportCandidate {
  /** Caminho da pasta raiz do scan. */
  folderPath: string;
  /** Caminho completo do arquivo ROM. */
  romPath: string;
  /** Nome do arquivo ROM (sem o caminho). */
  filename: string;
  /** Título candidato extraído do nome do arquivo (após limpeza de tags). */
  titleCandidate: string;
  /** ID da plataforma associada a este candidato. */
  platformId: number;
  /** Nome da plataforma associada a este candidato. */
  platformName: string;
}

/** Item ignorado durante o scan por não se qualificar para importação. */
export interface RomFolderIgnoredItem {
  /** Caminho da pasta raiz do scan. */
  folderPath: string;
  /** Caminho completo do arquivo ignorado. */
  romPath: string;
  /** Nome do arquivo ignorado. */
  filename: string;
  /** Motivo pelo qual o arquivo foi ignorado (ex.: extensão não reconhecida). */
  reason: string;
}

/** Parâmetros para iniciar o scan de pastas de ROM. */
export interface RomFolderScanRequest {
  /** Caminhos das pastas a escanear. */
  folderPaths: string[];
  /** Caminhos de arquivos ROM individuais a incluir (adicional às pastas). */
  romFilePaths?: string[];
  /** Plataforma forçada para todos os arquivos (null = detecção automática). */
  platformId?: number | null;
  /** Modo de detecção de plataforma. */
  detectionMode?: RomFolderPlatformDetectionMode;
  /** Indica se subpastas devem ser incluídas no scan. */
  includeSubfolders?: boolean;
}

/** Resultado do scan de pastas de ROM, antes da importação efetiva. */
export interface RomFolderScanResult {
  /** Pastas escaneadas. */
  folderPaths: string[];
  /** Arquivos ROM individuais incluídos. */
  romFilePaths: string[];
  /** ID da plataforma resolvida (null se nenhuma). */
  platformId: number | null;
  /** Nome da plataforma resolvida. */
  platformName: string;
  /** Modo de detecção de plataforma usado. */
  detectionMode: RomFolderPlatformDetectionMode;
  /** Plataformas detectadas automaticamente (por extensão de arquivo). */
  detectedPlatforms: RomFolderDetectedPlatform[];
  /** Indica se subpastas foram incluídas. */
  includeSubfolders: boolean;
  /** Lista de candidatos encontrados e elegíveis para importação. */
  candidates: RomFolderImportCandidate[];
  /** Quantidade de arquivos ignorados durante o scan. */
  ignored: number;
  /** Lista detalhada de arquivos ignorados. */
  ignoredItems: RomFolderIgnoredItem[];
}

/**
 * Candidato de importação com resultado do match LaunchBox.
 * Estende RomFolderImportCandidate com o status e resultado do match.
 */
export interface RomFolderMatchedCandidate extends RomFolderImportCandidate {
  /** Status do match contra o LaunchBox. */
  status: RomFolderMatchStatus;
  /** Jogo LaunchBox encontrado com melhor match, ou null se sem match. */
  match: LaunchBoxGame | null;
  /** Outros jogos LaunchBox encontrados quando o match é ambíguo. */
  alternatives: LaunchBoxGame[];
}

/** Parâmetros para iniciar o job de importação de ROMs por pasta. */
export interface RomFolderImportRequest {
  /** Caminhos das pastas a importar. */
  folderPaths: string[];
  /** Caminhos de arquivos ROM individuais a incluir. */
  romFilePaths?: string[];
  /** Plataforma forçada (null = detecção automática). */
  platformId?: number | null;
  /** Modo de detecção de plataforma. */
  detectionMode?: RomFolderPlatformDetectionMode;
  /** Indica se subpastas devem ser incluídas. */
  includeSubfolders?: boolean;
}

/** Parâmetros para contar registros de ROM importados de uma pasta/plataforma. */
export interface RomFolderRecordCountRequest {
  /** Caminho da pasta a consultar. */
  folderPath: string;
  /** Filtra por plataforma específica (opcional). */
  platformId?: number;
}

/** Resultado da contagem de registros de ROM de uma pasta/plataforma. */
export interface RomFolderRecordCountResult extends RomFolderRecordCountRequest {
  /** Total de registros de ROM encontrados para os critérios informados. */
  count: number;
}

/** Resultado do processamento de um candidato individual durante a importação. */
export interface RomFolderImportItemResult {
  /** Candidato que foi processado. */
  candidate: RomFolderImportCandidate;
  /** Status do resultado: criado, atualizado, sem match ou falha. */
  status: "created" | "updated" | "unmatched" | "failed";
  /** ID do jogo criado ou atualizado (presente quando status é "created" ou "updated"). */
  gameId?: number;
  /** ID do jogo LaunchBox vinculado (presente quando houve match). */
  launchboxGameId?: string;
  /** Mensagem de erro (presente quando status é "failed"). */
  error?: string;
  /** Quantidade de downloads de imagem que falharam para este item. */
  failedDownloads?: number;
}

/** Resumo agregado de uma importação de ROMs por pasta. */
export interface RomFolderImportSummary {
  /** Novos jogos criados. */
  created: number;
  /** Jogos existentes atualizados. */
  updated: number;
  /** Itens ignorados (já existiam sem alteração). */
  skipped: number;
  /** Arquivos ROM sem match no LaunchBox. */
  unmatched: number;
  /** Total de downloads de imagem que falharam. */
  failedDownloads: number;
  /** Total de candidatos processados. */
  processed: number;
}

/** Resultado completo de um job de importação de ROMs por pasta. */
export interface RomFolderImportResult {
  /** ID do job (presente quando persistido). */
  jobId?: string;
  /** Pastas importadas. */
  folderPaths: string[];
  /** Arquivos ROM individuais importados. */
  romFilePaths: string[];
  /** ID da plataforma resolvida. */
  platformId: number | null;
  /** Nome da plataforma resolvida. */
  platformName: string;
  /** Modo de detecção de plataforma usado. */
  detectionMode: RomFolderPlatformDetectionMode;
  /** Plataformas detectadas automaticamente durante o job. */
  detectedPlatforms: RomFolderDetectedPlatform[];
  /** Indica se subpastas foram incluídas. */
  includeSubfolders: boolean;
  /** Resultado individual de cada candidato processado. */
  items: RomFolderImportItemResult[];
  /** Resumo agregado do job. */
  summary: RomFolderImportSummary;
}

/** Progresso em tempo real de um job de importação de ROMs por pasta. */
export interface RomFolderImportProgress {
  /** ID do job ao qual este progresso pertence. */
  jobId?: string;
  /** Item atual sendo processado. */
  current: number;
  /** Total de itens a processar. */
  total: number;
  /** Pasta sendo processada no momento. */
  folderPath?: string;
  /** Nome do arquivo ROM sendo processado. */
  filename?: string;
  /** Nome do arquivo de imagem sendo baixado. */
  imageFilename?: string;
  /** Estágio atual do job. */
  stage: RomFolderImportStage;
  /** Mensagem descritiva do progresso atual. */
  message?: string;
}

/** Representação completa de um job de importação de ROMs por pasta. */
export interface RomFolderImportJob {
  /** Identificador único do job (UUID). */
  jobId: string;
  /** Pastas incluídas no job. */
  folderPaths: string[];
  /** Arquivos ROM individuais incluídos no job. */
  romFilePaths: string[];
  /** ID da plataforma resolvida para este job. */
  platformId: number | null;
  /** Nome da plataforma resolvida. */
  platformName: string;
  /** Modo de detecção de plataforma usado. */
  detectionMode: RomFolderPlatformDetectionMode;
  /** Plataformas detectadas automaticamente. */
  detectedPlatforms: RomFolderDetectedPlatform[];
  /** Indica se subpastas foram incluídas. */
  includeSubfolders: boolean;
  /** Status atual do job. */
  status: "running" | "completed" | "failed" | "interrupted";
  /** Data/hora ISO de início do job. */
  startedAt: string;
  /** Último progresso recebido para este job. */
  progress: RomFolderImportProgress;
  /** Resultado completo (presente quando status="completed"). */
  result?: RomFolderImportResult;
  /** Mensagem de erro (presente quando status="failed"). */
  error?: string;
}
