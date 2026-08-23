/**
 * Hook responsável por carregar a lista de jogos do banco via IPC,
 * respeitando filtros, ordenação e paginação do store Zustand.
 *
 * Funcionalidades:
 * - Cache em memória por combinação de filtros + reloadToken para evitar flicker.
 * - Pré-carregamento (prefetch) das páginas adjacentes (anterior e próxima).
 * - Cancela requisições obsoletas via flag `cancelled` para evitar race conditions.
 * - Exibe estado de loading apenas quando a página ainda não está em cache.
 */
import { useEffect } from "react";
import { GameFilters, GameListResult } from "../../shared/types";
import { useGameStockStore } from "../store";

/** Número de jogos carregados por página. Exportado para uso no cálculo de borda de página em navegação. */
export const PAGE_SIZE = 36;

/**
 * Cache em memória de resultados de páginas já carregadas.
 * Chave: JSON serializado dos filtros + reloadToken.
 * Permite exibição instantânea ao navegar entre páginas já visitadas.
 */
const pageCache = new Map<string, GameListResult>();

/** Requisições em curso por chave; evita duplicar IPC entre tela e prefetch. */
const pendingPages = new Map<string, Promise<GameListResult>>();

/** Limite do cache para impedir crescimento indefinido após muitas buscas. */
const MAX_CACHED_PAGES = 40;

/**
 * Monta o objeto de filtros a partir dos parâmetros do store.
 */
function buildFilters(params: {
  selectedPlatformId: number | null;
  searchQuery: string;
  selectedCategory: string;
  collectionFilter: GameFilters["collectionFilter"];
  showGamesWithoutCover: boolean;
  sortBy: GameFilters["sortBy"];
  currentPage: number;
}): GameFilters {
  return {
    platformId: params.selectedPlatformId,
    search: params.searchQuery,
    genre: params.selectedCategory,
    collectionFilter: params.collectionFilter,
    includeMissingCovers: params.showGamesWithoutCover,
    sortBy: params.sortBy,
    page: params.currentPage,
    pageSize: PAGE_SIZE
  };
}

/**
 * Gera a chave de cache para um conjunto de filtros + token de recarga.
 * O reloadToken garante invalidação do cache após alterações na biblioteca.
 */
function cacheKey(filters: GameFilters, reloadToken: number): string {
  return JSON.stringify({ ...filters, reloadToken });
}

/** Guarda página no cache LRU simples, descartando entrada menos recente. */
function cachePage(key: string, result: GameListResult): void {
  pageCache.delete(key);
  pageCache.set(key, result);
  while (pageCache.size > MAX_CACHED_PAGES) {
    const oldestKey = pageCache.keys().next().value;
    if (!oldestKey) return;
    pageCache.delete(oldestKey);
  }
}

/** Retorna página cacheada ou compartilha uma única consulta IPC em andamento. */
function fetchPage(filters: GameFilters, reloadToken: number): Promise<GameListResult> {
  const key = cacheKey(filters, reloadToken);
  const cached = pageCache.get(key);
  if (cached) {
    // Renova posição LRU sem consultar SQLite novamente.
    cachePage(key, cached);
    return Promise.resolve(cached);
  }

  const pending = pendingPages.get(key);
  if (pending) return pending;

  const request = window.gameStockAPI.games.list(filters)
    .then((result) => {
      cachePage(key, result);
      return result;
    })
    .finally(() => {
      pendingPages.delete(key);
    });
  pendingPages.set(key, request);
  return request;
}

/** Timers de pré-carga em andamento, para cancelamento seguro no unmount/mudança de filtros. */
const pendingPrefetchTimers = new Set<ReturnType<typeof setTimeout>>();

/**
 * Pré-carrega uma página em background após um pequeno atraso,
 * armazenando o resultado no cache sem atualizar o store.
 * Não dispara nova requisição se a página já estiver em cache.
 * O timer é rastreado para ser cancelado quando o hook desmonta.
 */
function prefetchPage(filters: GameFilters, reloadToken: number): void {
  const key = cacheKey(filters, reloadToken);
  if (pageCache.has(key) || pendingPages.has(key)) return;

  // Pequeno atraso para não disputar banda com a requisição principal
  const timer = window.setTimeout(() => {
    pendingPrefetchTimers.delete(timer);
    void fetchPage(filters, reloadToken).catch(() => undefined);
  }, 250);
  pendingPrefetchTimers.add(timer);
}

/**
 * Cancela todos os timers de pré-carga pendentes.
 * Chamado no cleanup do efeito para evitar disparos após teardown do hook.
 */
function clearPendingPrefetchTimers(): void {
  for (const timer of pendingPrefetchTimers) {
    window.clearTimeout(timer);
  }
  pendingPrefetchTimers.clear();
}

/**
 * Carrega e mantém sincronizada a lista de jogos no store Zustand.
 * Reage a mudanças de plataforma, busca, filtro de coleção, ordenação, página e reloadToken.
 */
export function useGames(): void {
  const selectedPlatformId = useGameStockStore((state) => state.selectedPlatformId);
  const searchQuery = useGameStockStore((state) => state.searchQuery);
  const selectedCategory = useGameStockStore((state) => state.selectedCategory);
  const collectionFilter = useGameStockStore((state) => state.collectionFilter);
  const showGamesWithoutCover = useGameStockStore((state) => state.showGamesWithoutCover);
  const sortBy = useGameStockStore((state) => state.sortBy);
  const currentPage = useGameStockStore((state) => state.currentPage);
  const reloadToken = useGameStockStore((state) => state.reloadToken);
  const setGames = useGameStockStore((state) => state.setGames);
  const setLoading = useGameStockStore((state) => state.setLoading);

  useEffect(() => {
    let cancelled = false;
    // Inclui categoria/gênero na chave para cachear cada combinação de filtros corretamente.
    const filters = buildFilters({ selectedPlatformId, searchQuery, selectedCategory, collectionFilter, showGamesWithoutCover, sortBy, currentPage });
    const key = cacheKey(filters, reloadToken);
    const cached = pageCache.get(key);

    if (cached) {
      // Exibição imediata a partir do cache; sem spinner
      setGames(cached);
      setLoading(false);
    } else {
      // Primeira visita a esta página: mostra loading enquanto aguarda
      setLoading(true);
    }

    fetchPage(filters, reloadToken)
      .then((result) => {
        if (!cancelled) {
          setGames(result);

          // Pré-carrega páginas adjacentes para navegação instantânea
          const totalPages = Math.ceil(result.filtered / PAGE_SIZE);
          if (currentPage < totalPages) {
            prefetchPage({ ...filters, page: currentPage + 1 }, reloadToken);
          }
          if (currentPage > 1) {
            prefetchPage({ ...filters, page: currentPage - 1 }, reloadToken);
          }
        }
      })
      .catch((cause: unknown) => {
        // Mantém resultado cacheado quando possível, mas registra falha para diagnóstico no console do renderer.
        console.error("Falha ao carregar jogos", cause);
      })
      .finally(() => {
        // Garante que o loading seja removido mesmo em caso de erro
        if (!cancelled) setLoading(false);
      });

    return () => {
      // Cancela o efeito se os filtros mudarem antes da resposta chegar
      cancelled = true;
      // Cancela pré-cargas agendadas para não disparar IPC após o teardown do efeito
      clearPendingPrefetchTimers();
    };
  }, [selectedPlatformId, searchQuery, selectedCategory, collectionFilter, showGamesWithoutCover, sortBy, currentPage, reloadToken, setGames, setLoading]);
}
