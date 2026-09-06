/**
 * Store global da aplicação via Zustand.
 *
 * Centraliza todo o estado compartilhado entre componentes:
 * jogos, plataformas, filtros, jobs de importação de ROM,
 * sincronização de mídia (LaunchBox) e portabilidade de dados (backup/restore).
 *
 * Regra de persistência de jobs:
 * - Ticks de progresso atualizam apenas o estado em memória (Zustand).
 * - Escritas no SQLite ocorrem somente em transições de estado terminal
 *   (início, conclusão, falha e descarte), nunca a cada tick.
 */
import { create } from "zustand";
import {
  CollectionCounts,
  CoverSyncFailureItem,
  CollectionFilter,
  CoverSyncStats,
  DataPortabilityJob,
  DataPortabilityProgress,
  Game,
  GameListResult,
  GameSortBy,
  GameVersionOption,
  HardwareInventorySortBy,
  LibrarySidebarCounts,
  LaunchBoxProgress,
  Platform,
  RomFolderImportJob,
  RomFolderImportProgress,
  RomFolderImportResult,
  ViewMode
} from "../../shared/types";
import {
  setPersistedDataPortabilityJobs,
  setPersistedLastRomImportJob,
  setPersistedLibraryFilters,
  setPersistedMediaSyncJobs,
  setPersistedRomFolderEntries,
  type PersistedLibraryFilters,
  type PersistedRomFolderEntry
} from "../lib/appStatePersistence";
import { timestamp } from "../lib/time";

/** Número máximo de jobs de portabilidade mantidos no store (os mais recentes). */
const MAX_PORTABILITY_JOBS = 5;

/** Seções disponíveis no modal de configurações. */
export type SettingsSection = "backup" | "biblioteca" | "plataformas" | "covers" | "emuladores" | "partidas" | "logs" | "sobre";

/** Permite que setters aceitem tanto um valor direto quanto uma função de atualização (padrão functional update). */
type SetterValue<T> = T | ((current: T) => T);

/**
 * Representa um job de sincronização de mídia (download de metadados ou capas do LaunchBox).
 * Mantido em memória no store e persistido no SQLite apenas em estados terminais.
 */
export interface MediaSyncJob {
  jobId: string;
  title: string;
  subtitle: string;
  status: "running" | "completed" | "failed" | "interrupted";
  detail: string;
  progressLabel: string;
  percent: number;
  startedAt: string;
  indeterminate?: boolean;
  failures?: CoverSyncFailureItem[];
}

/** Parâmetros necessários para iniciar um novo MediaSyncJob. */
interface StartMediaSyncJobInput {
  jobId: string;
  title: string;
  subtitle?: string;
  detail?: string;
  progressLabel?: string;
  percent?: number;
  startedAt?: string;
  indeterminate?: boolean;
}

/** Parâmetros para finalizar um MediaSyncJob com sucesso ou falha. */
interface FinishMediaSyncJobInput {
  title: string;
  detail?: string;
  progressLabel?: string;
  status?: "completed" | "failed";
  failures?: CoverSyncFailureItem[];
}

/**
 * Interface completa do estado e das ações do store Zustand da aplicação.
 * Cada campo de estado tem um setter correspondente ou uma ação semântica.
 */
interface GameStockState {
  // --- Estado de UI ---
  /** ID da plataforma selecionada no sidebar (null = todas). */
  selectedPlatformId: number | null;
  /** Texto da busca atual na biblioteca. */
  searchQuery: string;
  /** Categoria/gênero selecionado no filtro da biblioteca. */
  selectedCategory: string;
  /** Modo de exibição da biblioteca: grade ou lista. */
  viewMode: ViewMode;
  /** Filtro de coleção ativo (todos, favoritos, jogando, concluído). */
  collectionFilter: CollectionFilter;
  /** Define se jogos sem capa aparecem na biblioteca. */
  showGamesWithoutCover: boolean;
  /** Critério de ordenação da lista de jogos. */
  sortBy: GameSortBy;

  // --- Estado de dados ---
  /** Lista de jogos carregados na página atual. */
  games: Game[];
  /** Total de jogos sem filtro de busca/coleção. */
  total: number;
  /** Total de jogos após aplicar os filtros ativos. */
  filtered: number;
  /** Página atual da lista paginada (base 1). */
  currentPage: number;
  /** Lista de plataformas disponíveis. */
  platforms: Platform[];
  /** Indica se há carregamento de dados em andamento. */
  loading: boolean;
  /** ID do jogo atualmente selecionado para exibir detalhes. */
  selectedGameId: number | null;
  /** Objeto completo do jogo selecionado. */
  selectedGame: Game | null;

  // --- Estado de modais ---
  /** Controla a visibilidade do modal do LaunchBox Importer. */
  importerOpen: boolean;
  /** Controla a visibilidade do modal de configurações. */
  settingsOpen: boolean;
  /** Seção ativa dentro do modal de configurações. */
  settingsSection: SettingsSection;
  /** Controla a visibilidade do modal de criação manual de jogo. */
  createGameOpen: boolean;
  /** Controla o modal de seleção de versões antes do launch. */
  launchSelection: { sourceGameId: number; options: GameVersionOption[] } | null;

  // --- Tokens de recarga (incrementados para forçar re-fetch) ---
  /** Token que, ao mudar, força recarga dos jogos nos hooks. */
  reloadToken: number;
  /** Token que, ao mudar, força recarga das plataformas nos hooks. */
  platformsReloadToken: number;

  // --- Contagens da coleção ---
  /** Contagens de jogos por coleção especial (favoritos, jogando, concluído). */
  collectionCounts: CollectionCounts;
  /** Contagens facetadas usadas pelos menus da sidebar da biblioteca. */
  librarySidebarCounts: LibrarySidebarCounts;

  // --- Estado de importação de ROMs ---
  /** Entradas de pastas de ROM configuradas e persistidas. */
  romFolderEntries: PersistedRomFolderEntry[];
  /** Último job de importação de ROM (ativo ou histórico). */
  lastRomImportJob: RomFolderImportJob | null;

  // --- Jobs de sincronização de mídia (LaunchBox) ---
  mediaSyncJobs: MediaSyncJob[];

  // --- Jobs de portabilidade de dados (backup/restore) ---
  dataPortabilityJobs: DataPortabilityJob[];

  // --- Modo da sidebar ---
  /** Modo de navegação da sidebar: 'library' (padrão) ou 'inventory'. */
  sidebarMode: "library" | "inventory";
  /** Sinaliza abertura do formulário de criação do inventário. */
  inventoryCreateOpen: boolean;
  /** Modo de exibicao do inventario: cards ou lista. */
  inventoryViewMode: ViewMode;
  /** Criterio de ordenacao dos itens do inventario. */
  inventorySortBy: HardwareInventorySortBy;

  // --- Filtros do inventário de hardware ---
  /** Filtros ativos no módulo de inventário. */
  inventoryFilters: {
    platformId: number | null;
    itemTypeId: number | null;
    conservationStateId: number | null;
    search: string | null;
  };

  // --- Flags de estado global ---
  /** Indica se o download inicial do Metadata.zip está em andamento. */
  metadataStartupRunning: boolean;
  /** Estatísticas de capas (total, com capa, sem capa). */
  coverStats: CoverSyncStats | null;

  // --- Setters e ações ---
  setSelectedPlatformId(value: number | null): void;
  setSearchQuery(value: string): void;
  setSelectedCategory(value: string): void;
  setViewMode(value: ViewMode): void;
  setCollectionFilter(value: CollectionFilter): void;
  setShowGamesWithoutCover(value: boolean): void;
  setSortBy(value: GameSortBy): void;
  /** Hidrata os filtros da biblioteca persistidos no SQLite (sem persistir de volta). */
  hydrateLibraryFilters(value: PersistedLibraryFilters): void;
  setCurrentPage(value: number): void;
  setGames(value: GameListResult): void;
  setPlatforms(value: Platform[]): void;
  setLoading(value: boolean): void;
  setSelectedGameId(value: number | null): void;
  setSelectedGame(value: Game | null): void;
  /** Atualiza um jogo existente na lista (sem reload completo). */
  upsertGame(value: Game): void;
  /** Remove um jogo da lista pelo ID. */
  removeGame(value: number): void;
  setImporterOpen(value: boolean): void;
  setSettingsOpen(value: boolean): void;
  setSettingsSection(value: SettingsSection): void;
  /** Abre o modal de configurações já na seção indicada. */
  openSettings(section: SettingsSection): void;
  setCreateGameOpen(value: boolean): void;
  /** Abre o modal de seleção de versões para um jogo com múltiplas variantes. */
  openLaunchSelection(sourceGameId: number, options: GameVersionOption[]): void;
  /** Fecha o modal de seleção de versões. */
  closeLaunchSelection(): void;
  setCollectionCounts(value: CollectionCounts): void;
  /** Atualiza as contagens facetadas da sidebar da biblioteca. */
  setLibrarySidebarCounts(value: LibrarySidebarCounts): void;
  /** Hidrata entradas de pastas de ROM a partir do SQLite (sem persistir de volta). */
  hydrateRomFolderEntries(value: PersistedRomFolderEntry[]): void;
  /** Atualiza entradas de pastas de ROM e persiste no SQLite. */
  setRomFolderEntries(value: SetterValue<PersistedRomFolderEntry[]>): void;
  /** Hidrata o último job de importação de ROM a partir do SQLite. */
  hydratePersistedLastRomImportJob(value: RomFolderImportJob | null): void;
  /** Atualiza o último job de importação de ROM e persiste no SQLite. */
  setLastRomImportJob(value: SetterValue<RomFolderImportJob | null>): void;
  /** Hidrata a lista de MediaSyncJobs a partir do SQLite. */
  hydrateMediaSyncJobs(value: MediaSyncJob[]): void;
  /** Hidrata jobs de importação de ROM do SQLite; detecta jobs com status "running" como interrompidos. */
  hydrateRomImportJobs(value: RomFolderImportJob[]): void;
  /** Atualiza progresso de um job de importação de ROM em memória (sem persistir). */
  updateRomImportProgress(value: RomFolderImportProgress): void;
  /** Marca um job de importação de ROM como concluído e persiste no SQLite. */
  completeRomImportJob(value: RomFolderImportResult): void;
  /** Inicia um novo MediaSyncJob e persiste no SQLite. */
  startMediaSyncJob(value: StartMediaSyncJobInput): void;
  /** Atualiza progresso de um MediaSyncJob em memória (sem persistir). */
  updateMediaSyncProgress(value: LaunchBoxProgress): void;
  /** Finaliza um MediaSyncJob com sucesso e persiste no SQLite. */
  finishMediaSyncJob(jobId: string, value: FinishMediaSyncJobInput): void;
  /** Finaliza um MediaSyncJob com falha e persiste no SQLite. */
  failMediaSyncJob(jobId: string, message: string): void;
  /** Remove um MediaSyncJob do store e persiste a lista atualizada. */
  dismissMediaSyncJob(jobId: string): void;
  /** Hidrata jobs de portabilidade a partir do SQLite, mesclando com o estado existente. */
  hydrateDataPortabilityJobs(value: DataPortabilityJob[]): void;
  /** Adiciona ou atualiza um job de portabilidade no store e persiste. */
  startDataPortabilityJob(value: DataPortabilityJob): void;
  /** Atualiza progresso de portabilidade em memória (sem persistir). */
  updateDataPortabilityProgress(value: DataPortabilityProgress): void;
  /** Marca job de portabilidade como concluído e persiste no SQLite. */
  completeDataPortabilityJob(value: DataPortabilityJob): void;
  /** Remove job de portabilidade do store e persiste a lista atualizada. */
  dismissDataPortabilityJob(jobId: string): void;
  /** Define o modo de navegação da sidebar. */
  setSidebarMode(value: "library" | "inventory"): void;
  /** Abre/fecha o formulário de criação de item do inventário. */
  setInventoryCreateOpen(value: boolean): void;
  /** Altera entre visualizacao em cards e lista no inventario. */
  setInventoryViewMode(value: ViewMode): void;
  /** Atualiza a ordenacao do inventario. */
  setInventorySortBy(value: HardwareInventorySortBy): void;
  /** Atualiza os filtros do inventário de hardware. */
  setInventoryFilters(value: { platformId?: number | null; itemTypeId?: number | null; conservationStateId?: number | null; search?: string | null }): void;
  setMetadataStartupRunning(value: boolean): void;
  setCoverStats(value: CoverSyncStats): void;
  /** Incrementa reloadToken para forçar recarga dos jogos. */
  reloadGames(): void;
  /** Incrementa platformsReloadToken para forçar recarga das plataformas. */
  reloadPlatforms(): void;
}

export const useGameStockStore = create<GameStockState>((set) => ({
  // Valores iniciais do estado
  selectedPlatformId: null,
  searchQuery: "",
  selectedCategory: "",
  viewMode: "grid",
  collectionFilter: "all",
  showGamesWithoutCover: true,
  sortBy: "title",
  games: [],
  total: 0,
  filtered: 0,
  currentPage: 1,
  platforms: [],
  loading: false,
  selectedGameId: null,
  selectedGame: null,
  importerOpen: false,
  settingsOpen: false,
  settingsSection: "biblioteca",
  createGameOpen: false,
  launchSelection: null,
  reloadToken: 0,
  platformsReloadToken: 0,
  collectionCounts: { favorites: 0, playing: 0, completed: 0, mostPlayed: 0 },
  librarySidebarCounts: { all: 0, collections: { favorites: 0, playing: 0, completed: 0, mostPlayed: 0 }, platforms: {} },
  romFolderEntries: [],
  lastRomImportJob: null,
  mediaSyncJobs: [],
  dataPortabilityJobs: [],
  metadataStartupRunning: false,
  coverStats: null,
  sidebarMode: "library",
  inventoryCreateOpen: false,
  inventoryViewMode: "grid",
  inventorySortBy: "name",
  inventoryFilters: { platformId: null, itemTypeId: null, conservationStateId: null, search: null },

  // Plataforma compõe com filtros de coleção, permitindo favoritos por console.
  setSelectedPlatformId: (selectedPlatformId) => set({ selectedPlatformId, currentPage: 1, selectedGameId: null, selectedGame: null }),
  // Busca sempre consulta biblioteca inteira, sem restringir por console, coleção ou categoria.
  setSearchQuery: (searchQuery) => set({
    searchQuery,
    selectedPlatformId: null,
    selectedCategory: "",
    collectionFilter: "all",
    currentPage: 1,
    selectedGameId: null,
    selectedGame: null
  }),
  // Ao trocar categoria/gênero, reinicia a paginação para evitar página vazia.
  setSelectedCategory: (selectedCategory) => set((state) => {
    void setPersistedLibraryFilters(buildLibraryFilters(state, { selectedCategory }));
    return { selectedCategory, currentPage: 1 };
  }),
  setViewMode: (viewMode) => set((state) => {
    void setPersistedLibraryFilters(buildLibraryFilters(state, { viewMode }));
    return { viewMode };
  }),
  // Filtro de coleção compõe com plataforma selecionada e volta à página 1.
  setCollectionFilter: (collectionFilter) => set((state) => {
    void setPersistedLibraryFilters(buildLibraryFilters(state, { collectionFilter }));
    return { collectionFilter, currentPage: 1, selectedGameId: null, selectedGame: null };
  }),
  // Ao alternar visibilidade de jogos sem capa, reinicia paginação para evitar página vazia.
  setShowGamesWithoutCover: (showGamesWithoutCover) => set((state) => {
    void setPersistedLibraryFilters(buildLibraryFilters(state, { showGamesWithoutCover }));
    return { showGamesWithoutCover, currentPage: 1 };
  }),
  setSortBy: (sortBy) => set((state) => {
    void setPersistedLibraryFilters(buildLibraryFilters(state, { sortBy }));
    return { sortBy, currentPage: 1 };
  }),
  // Restaura filtros da biblioteca vindos do SQLite (defaults nos valores não persistidos).
  hydrateLibraryFilters: (value) => set({
    selectedCategory: value.selectedCategory,
    collectionFilter: value.collectionFilter,
    showGamesWithoutCover: value.showGamesWithoutCover,
    sortBy: value.sortBy,
    viewMode: value.viewMode
  }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  // Atualiza lista de jogos e mantém o jogo selecionado sincronizado com os novos dados
  setGames: ({ items, total, filtered }) => set((state) => ({
    games: items,
    total,
    filtered,
    selectedGame: state.selectedGameId
      ? items.find((item) => item.id === state.selectedGameId) ?? state.selectedGame
      : null
  })),
  setPlatforms: (platforms) => set({ platforms }),
  setLoading: (loading) => set({ loading }),
  // Ao selecionar um jogo por ID, tenta encontrar o objeto na lista atual
  setSelectedGameId: (selectedGameId) => set((state) => ({
    selectedGameId,
    selectedGame: selectedGameId
      ? state.games.find((item) => item.id === selectedGameId) ?? (state.selectedGame?.id === selectedGameId ? state.selectedGame : null)
      : null
  })),
  setSelectedGame: (selectedGame) => set({
    selectedGame,
    selectedGameId: selectedGame?.id ?? null
  }),
  // Atualiza dados de um jogo na lista sem recarregar toda a coleção
  upsertGame: (game) => set((state) => ({
    games: state.games.map((item) => item.id === game.id ? game : item),
    selectedGame: state.selectedGameId === game.id ? game : state.selectedGame
  })),
  // Remove jogo e limpa seleção caso o jogo removido fosse o selecionado
  removeGame: (gameId) => set((state) => ({
    games: state.games.filter((item) => item.id !== gameId),
    selectedGameId: state.selectedGameId === gameId ? null : state.selectedGameId,
    selectedGame: state.selectedGameId === gameId ? null : state.selectedGame
  })),
  setImporterOpen: (importerOpen) => set({ importerOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setSettingsSection: (settingsSection) => set({ settingsSection }),
  openSettings: (settingsSection) => set({ settingsOpen: true, settingsSection }),
  setCreateGameOpen: (createGameOpen) => set({ createGameOpen }),
  openLaunchSelection: (sourceGameId, options) => set({ launchSelection: { sourceGameId, options } }),
  closeLaunchSelection: () => set({ launchSelection: null }),
  setCollectionCounts: (collectionCounts) => set({ collectionCounts }),
  setLibrarySidebarCounts: (librarySidebarCounts) => set({ librarySidebarCounts }),

  // Hidrata sem persistir (dados já vieram do SQLite)
  hydrateRomFolderEntries: (romFolderEntries) => set({ romFolderEntries }),
  // Atualiza e persiste (usuário fez alteração)
  setRomFolderEntries: (romFolderEntries) => set((state) => {
    const nextEntries = resolveSetterValue(romFolderEntries, state.romFolderEntries);
    void setPersistedRomFolderEntries(nextEntries);
    return { romFolderEntries: nextEntries };
  }),

  hydratePersistedLastRomImportJob: (lastRomImportJob) => set({ lastRomImportJob }),
  setLastRomImportJob: (lastRomImportJob) => set((state) => {
    const nextJob = resolveSetterValue(lastRomImportJob, state.lastRomImportJob);
    void setPersistedLastRomImportJob(nextJob);
    return { lastRomImportJob: nextJob };
  }),

  // Se houver job com status "running" vindo do SQLite, ele foi interrompido por crash
  hydrateRomImportJobs: (jobs) => set((state) => {
    const runningJob = jobs.find((job) => job.status === "running") ?? null;
    const nextJob = runningJob ?? state.lastRomImportJob;
    return { lastRomImportJob: nextJob };
  }),

  // Tick de progresso: atualiza apenas memória, sem write no SQLite.
  // Exceção única: stage "error" é transição terminal — persiste o job falho
  // para ele sobreviver a restart (regra de persistência de terminal states).
  updateRomImportProgress: (progress) => set((state) => {
    if (!progress.jobId) return {};
    const nextJob = buildRomImportJobFromProgress(state.lastRomImportJob, progress);
    if (progress.stage === "error" && state.lastRomImportJob?.status !== "failed") {
      void setPersistedLastRomImportJob(nextJob);
    }
    return { lastRomImportJob: nextJob };
  }),

  // Conclusão: persiste estado final no SQLite
  completeRomImportJob: (result) => set((state) => {
    if (!result.jobId) return {};
    const nextJob = buildCompletedRomImportJob(state.lastRomImportJob, result);
    void setPersistedLastRomImportJob(nextJob);
    return { lastRomImportJob: nextJob };
  }),

  hydrateMediaSyncJobs: (mediaSyncJobs) => set({ mediaSyncJobs }),

  // Inicia novo job de sincronização e persiste lista atualizada
  startMediaSyncJob: (job) => set((state) => {
    const newJob: MediaSyncJob = {
      jobId: job.jobId,
      title: job.title,
      subtitle: job.subtitle ?? "Biblioteca",
      status: "running",
      detail: job.detail ?? "Preparando",
      progressLabel: job.progressLabel ?? "Iniciando",
      percent: job.percent ?? 0,
      startedAt: job.startedAt ?? new Date().toISOString(),
      indeterminate: job.indeterminate,
      failures: []
    };
    const updated = [...state.mediaSyncJobs, newJob];
    void setPersistedMediaSyncJobs(updated);
    return { mediaSyncJobs: updated };
  }),

  // Tick de progresso do LaunchBox: atualiza apenas memória
  updateMediaSyncProgress: (progress) => set((state) => {
    const running = state.mediaSyncJobs.filter((j) => j.status === "running");
    if (!running.length) return {};
    // Usa jobId quando existir; fallback preserva compatibilidade com eventos legados sem identificação.
    const target = routeProgressToJob(progress, running);
    if (!target) return {};
    const updated = state.mediaSyncJobs.map((j) =>
      j.jobId === target.jobId ? buildMediaJobFromProgress(j, progress) : j
    );
    return { mediaSyncJobs: updated };
  }),

  // Finaliza job com sucesso e persiste
  finishMediaSyncJob: (jobId, result) => set((state) => {
    const current = state.mediaSyncJobs.find((j) => j.jobId === jobId) ?? null;
    const nextJob = buildTerminalMediaJob(current, jobId, {
      title: result.title,
      status: result.status ?? "completed",
      detail: result.detail,
      progressLabel: result.progressLabel,
      failures: result.failures
    });
    const updated = state.mediaSyncJobs.map((j) => j.jobId === jobId ? nextJob : j);
    void setPersistedMediaSyncJobs(updated);
    return { mediaSyncJobs: updated };
  }),

  // Finaliza job com falha e persiste
  failMediaSyncJob: (jobId, message) => set((state) => {
    const current = state.mediaSyncJobs.find((j) => j.jobId === jobId) ?? null;
    const nextJob = buildTerminalMediaJob(current, jobId, {
      title: current?.title ? `${current.title} falhou` : "Sincronizacao falhou",
      status: "failed",
      detail: message
    });
    const updated = state.mediaSyncJobs.map((j) => j.jobId === jobId ? nextJob : j);
    void setPersistedMediaSyncJobs(updated);
    return { mediaSyncJobs: updated };
  }),

  // Remove job da lista e persiste
  dismissMediaSyncJob: (jobId) => set((state) => {
    const updated = state.mediaSyncJobs.filter((j) => j.jobId !== jobId);
    void setPersistedMediaSyncJobs(updated);
    return { mediaSyncJobs: updated };
  }),

  // Mescla jobs de portabilidade vindos do SQLite com os já existentes em memória
  hydrateDataPortabilityJobs: (jobs) => set((state) => {
    const known = new Map(state.dataPortabilityJobs.map((job) => [job.jobId, job]));
    for (const job of jobs) known.set(job.jobId, normalizeDataPortabilityJob(job));
    // Ordena do mais recente para o mais antigo
    const updated = Array.from(known.values()).sort((a, b) => timestamp(b.startedAt) - timestamp(a.startedAt));
    return { dataPortabilityJobs: updated };
  }),

  // Adiciona ou atualiza job de portabilidade preservando progresso já existente se mais avançado
  startDataPortabilityJob: (job) => set((state) => {
    const existing = state.dataPortabilityJobs.find((item) => item.jobId === job.jobId);
    const nextJob = existing && existing.progress.current > job.progress.current
      ? { ...job, status: existing.status, progress: existing.progress, exportResult: existing.exportResult, importResult: existing.importResult, error: existing.error }
      : job;
    const updated = upsertDataPortabilityJob(state.dataPortabilityJobs, normalizeDataPortabilityJob(nextJob));
    void setPersistedDataPortabilityJobs(updated);
    return { dataPortabilityJobs: updated };
  }),

  // Tick de progresso de portabilidade: atualiza apenas memória
  updateDataPortabilityProgress: (progress) => set((state) => {
    if (!progress.jobId) return {};
    const existing = state.dataPortabilityJobs.find((job) => job.jobId === progress.jobId);
    // Ticks atrasados/duplicados não podem "ressuscitar" job em estado terminal
    // (completed/failed/interrupted) de volta para running.
    if (existing && existing.status !== "running") return {};
    const next: DataPortabilityJob = normalizeDataPortabilityJob({
      jobId: progress.jobId,
      kind: progress.kind,
      status: progress.stage === "error" ? "failed" : "running",
      startedAt: existing?.startedAt ?? new Date().toISOString(),
      progress,
      packagePath: existing?.packagePath,
      exportResult: existing?.exportResult,
      importResult: existing?.importResult,
      error: progress.stage === "error" ? progress.message : existing?.error
    });
    const updated = upsertDataPortabilityJob(state.dataPortabilityJobs, next);
    return { dataPortabilityJobs: updated };
  }),

  // Conclusão de portabilidade: persiste estado final
  completeDataPortabilityJob: (job) => set((state) => {
    const updated = upsertDataPortabilityJob(state.dataPortabilityJobs, normalizeDataPortabilityJob(job));
    void setPersistedDataPortabilityJobs(updated);
    return { dataPortabilityJobs: updated };
  }),

  // Remove job de portabilidade e persiste lista
  dismissDataPortabilityJob: (jobId) => set((state) => {
    const updated = state.dataPortabilityJobs.filter((job) => job.jobId !== jobId);
    void setPersistedDataPortabilityJobs(updated);
    return { dataPortabilityJobs: updated };
  }),

  setSidebarMode: (sidebarMode) => set({ sidebarMode }),
  setInventoryCreateOpen: (inventoryCreateOpen) => set({ inventoryCreateOpen }),
  setInventoryViewMode: (inventoryViewMode) => set({ inventoryViewMode }),
  setInventorySortBy: (inventorySortBy) => set({ inventorySortBy }),
  // Mescla os filtros fornecidos com os atuais (permite atualizar um campo por vez)
  setInventoryFilters: (filters) => set((state) => ({
    inventoryFilters: { ...state.inventoryFilters, ...filters }
  })),
  setMetadataStartupRunning: (metadataStartupRunning) => set({ metadataStartupRunning }),
  setCoverStats: (coverStats) => set({ coverStats }),
  // Incrementar token força useEffect nos hooks a buscar dados novamente
  reloadGames: () => set((state) => ({ reloadToken: state.reloadToken + 1 })),
  reloadPlatforms: () => set((state) => ({ platformsReloadToken: state.platformsReloadToken + 1 }))
}));

/**
 * Resolve um SetterValue: se for função, aplica ao valor atual; caso contrário retorna diretamente.
 * Equivalente ao padrão de functional update do React.setState.
 */
function resolveSetterValue<T>(value: SetterValue<T>, current: T): T {
  return typeof value === "function" ? (value as (current: T) => T)(current) : value;
}

/**
 * Monta o snapshot dos filtros da biblioteca para persistência,
 * aplicando os overrides do setter sobre o estado atual do store.
 */
function buildLibraryFilters(state: GameStockState, overrides: Partial<PersistedLibraryFilters>): PersistedLibraryFilters {
  return {
    selectedCategory: overrides.selectedCategory ?? state.selectedCategory,
    collectionFilter: overrides.collectionFilter ?? state.collectionFilter,
    showGamesWithoutCover: overrides.showGamesWithoutCover ?? state.showGamesWithoutCover,
    sortBy: overrides.sortBy ?? state.sortBy,
    viewMode: overrides.viewMode ?? state.viewMode
  };
}

/**
 * Constrói um RomFolderImportJob a partir de um tick de progresso,
 * preservando metadados do job anterior quando o jobId coincide.
 */
function buildRomImportJobFromProgress(current: RomFolderImportJob | null, progress: RomFolderImportProgress): RomFolderImportJob {
  const previous = current?.jobId === progress.jobId ? current : null;
  // Ticks tardios ("done" reentrando) não podem regredir um job já terminal.
  const status = previous && previous.status !== "running"
    ? previous.status
    : (progress.stage === "error" ? "failed" : "running");
  return {
    jobId: progress.jobId!,
    folderPaths: previous?.folderPaths ?? [],
    romFilePaths: previous?.romFilePaths ?? [],
    platformId: previous?.platformId ?? null,
    platformName: previous?.platformName ?? "Biblioteca",
    detectionMode: previous?.detectionMode ?? "manual",
    detectedPlatforms: previous?.detectedPlatforms ?? [],
    includeSubfolders: previous?.includeSubfolders ?? false,
    status,
    startedAt: previous?.startedAt ?? new Date().toISOString(),
    progress,
    result: previous?.result,
    error: progress.stage === "error" ? progress.message : previous?.error
  };
}

/**
 * Constrói um RomFolderImportJob no estado "completed" a partir do resultado final,
 * preenchendo o progresso com os totais do resumo.
 */
function buildCompletedRomImportJob(current: RomFolderImportJob | null, result: RomFolderImportResult): RomFolderImportJob {
  const previous = current?.jobId === result.jobId ? current : null;
  return {
    jobId: result.jobId!,
    folderPaths: result.folderPaths,
    romFilePaths: result.romFilePaths,
    platformId: result.platformId,
    platformName: result.platformName,
    detectionMode: result.detectionMode,
    detectedPlatforms: result.detectedPlatforms,
    includeSubfolders: result.includeSubfolders,
    status: "completed",
    startedAt: previous?.startedAt ?? new Date().toISOString(),
    progress: {
      jobId: result.jobId,
      current: result.summary.processed,
      total: result.summary.processed,
      stage: "done",
      message: "Importacao concluida"
    },
    result
  };
}

/**
 * Aplica um tick de progresso do LaunchBox a um MediaSyncJob existente,
 * atualizando detalhe, rótulo de progresso, percentual e flag de indeterminado.
 *
 * O status "error" aqui representa falha de download de um item individual
 * (não-terminal): o job permanece em "running" e o terminal só é definido
 * pelos eventos `finishMediaSyncJob`/`failMediaSyncJob`. Marcar o job como
 * falho por item congelava o progresso e impedia ticks subsequentes.
 */
function buildMediaJobFromProgress(current: MediaSyncJob, progress: LaunchBoxProgress): MediaSyncJob {
  return {
    ...current,
    status: "running",
    detail: mediaProgressDetail(progress, current.detail),
    progressLabel: mediaProgressLabel(progress),
    percent: mediaProgressPercent(progress, current.percent),
    // Extração e indexação não têm percentual real, exibem barra indeterminada
    indeterminate: progress.status === "extracting" || progress.status === "indexing"
  };
}

/** Retorna o texto de detalhe a exibir na notificação conforme o status do progresso. */
function mediaProgressDetail(progress: LaunchBoxProgress, fallback: string): string {
  if (progress.status === "extracting") return "Extraindo Metadata.zip";
  if (progress.status === "indexing") return "Construindo índice";
  return progress.filename ?? fallback;
}

/** Retorna o rótulo de progresso (ex.: "1,2 MB de 5,0 MB" ou "Extraindo"). */
function mediaProgressLabel(progress: LaunchBoxProgress): string {
  if (progress.status === "extracting") return "Extraindo";
  if (progress.status === "indexing") return "Construindo índice";
  if (progress.status === "done") return "Concluído";
  // Metadata.zip é grande o suficiente para exibir em MB
  if (isMetadataProgress(progress)) return `${formatMegabytes(progress.current)} de ${formatMegabytes(progress.total)}`;
  return progress.total ? `${progress.current} de ${progress.total}` : "Processando";
}

/** Calcula o percentual de progresso normalizado entre 0 e 100. */
function mediaProgressPercent(progress: LaunchBoxProgress, fallback: number): number {
  if (progress.status === "done") return 100;
  if (progress.status === "extracting" || progress.status === "indexing") return 100;
  if (!progress.total) return fallback;
  return Math.min(100, Math.round((progress.current / progress.total) * 100));
}

/** Verifica se o progresso se refere ao download do Metadata.zip. */
function isMetadataProgress(progress: LaunchBoxProgress): boolean {
  return progress.filename?.toLowerCase() === "metadata.zip";
}

/** Formata bytes em string legível em MB com uma casa decimal. */
function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Constrói um MediaSyncJob em estado terminal (completed ou failed),
 * preservando dados do job atual quando disponíveis.
 */
function buildTerminalMediaJob(
  current: MediaSyncJob | null,
  jobId: string,
  overrides: {
    title: string;
    status: "completed" | "failed";
    detail?: string;
    progressLabel?: string;
    failures?: CoverSyncFailureItem[];
  }
): MediaSyncJob {
  return {
    jobId,
    title: overrides.title,
    subtitle: current?.subtitle ?? "Biblioteca",
    status: overrides.status,
    detail: overrides.detail ?? current?.detail ?? overrides.title,
    progressLabel: overrides.progressLabel ?? (overrides.status === "failed" ? "Erro" : "Concluído"),
    percent: 100,
    startedAt: current?.startedAt ?? new Date().toISOString(),
    indeterminate: false,
    failures: overrides.failures ?? current?.failures ?? []
  };
}

/**
 * Insere ou substitui um job de portabilidade na lista,
 * mantendo ordenação por data e respeitando o limite máximo de jobs.
 */
function upsertDataPortabilityJob(jobs: DataPortabilityJob[], nextJob: DataPortabilityJob): DataPortabilityJob[] {
  return [nextJob, ...jobs.filter((job) => job.jobId !== nextJob.jobId)]
    .sort((a, b) => timestamp(b.startedAt) - timestamp(a.startedAt))
    .slice(0, MAX_PORTABILITY_JOBS);
}

/**
 * Normaliza os campos de progresso de um DataPortabilityJob para evitar
 * valores inválidos (total mínimo 1, current clampado entre 0 e total).
 */
function normalizeDataPortabilityJob(job: DataPortabilityJob): DataPortabilityJob {
  return {
    ...job,
    progress: {
      ...job.progress,
      total: Math.max(1, job.progress.total),
      current: Math.max(0, Math.min(job.progress.current, Math.max(1, job.progress.total)))
    }
  };
}

/**
 * Determina qual MediaSyncJob em execução deve receber um evento de progresso do LaunchBox,
 * baseando-se no prefixo do jobId (metadata- ou media-sync-).
 */
function routeProgressToJob(progress: LaunchBoxProgress, running: MediaSyncJob[]): MediaSyncJob | null {
  // Eventos novos carregam jobId explícito; evita que um job de mídia sobrescreva outro.
  if (progress.jobId) {
    return running.find((job) => job.jobId === progress.jobId) ?? null;
  }
  const isMetadata = progress.status === "extracting" || progress.status === "indexing" || isMetadataProgress(progress);
  return running.find((j) => isMetadata ? j.jobId.startsWith("metadata-") : j.jobId.startsWith("media-sync-")) ?? running[0];
}
