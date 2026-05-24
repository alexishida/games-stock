/**
 * Cache compartilhado de emuladores padrão por plataforma no renderer.
 *
 * Evita que cards, detalhes e telas de configuração disparem várias chamadas IPC
 * iguais para a mesma plataforma durante a mesma versão de recarga.
 */
import type { PlatformEmulator } from "../../shared/types";

/** Registro em cache do emulador padrão de uma plataforma. */
interface CachedDefaultEmulator {
  reloadToken: number;
  value: PlatformEmulator | null;
}

/** Requisição em andamento para evitar IPC duplicado enquanto a primeira resposta não chegou. */
interface PendingDefaultEmulator {
  reloadToken: number;
  promise: Promise<PlatformEmulator | null>;
}

/** Cache por ID de plataforma; o reloadToken invalida valores antigos sem precisar limpar tudo. */
const defaultEmulatorCache = new Map<number, CachedDefaultEmulator>();

/** Promises compartilhadas por ID de plataforma para deduplicar chamadas simultâneas. */
const pendingDefaultEmulatorRequests = new Map<number, PendingDefaultEmulator>();

/**
 * Busca o emulador padrão de uma plataforma, reutilizando cache e requisições em andamento.
 *
 * @param platformId ID da plataforma consultada.
 * @param reloadToken Token do store que muda quando vínculos/plataformas são recarregados.
 * @returns Emulador padrão da plataforma, ou null se não houver configuração.
 */
export function getDefaultPlatformEmulator(platformId: number, reloadToken: number): Promise<PlatformEmulator | null> {
  const cached = defaultEmulatorCache.get(platformId);
  if (cached?.reloadToken === reloadToken) return Promise.resolve(cached.value);

  const pending = pendingDefaultEmulatorRequests.get(platformId);
  if (pending?.reloadToken === reloadToken) return pending.promise;

  const promise = window.gameStockAPI.emulators
    .listByPlatform(platformId)
    .then((items) => items.find((item) => item.is_default === 1) ?? null)
    .catch(() => null)
    .then((value) => {
      defaultEmulatorCache.set(platformId, { reloadToken, value });
      return value;
    })
    .finally(() => {
      const current = pendingDefaultEmulatorRequests.get(platformId);
      if (current?.promise === promise) pendingDefaultEmulatorRequests.delete(platformId);
    });

  pendingDefaultEmulatorRequests.set(platformId, { reloadToken, promise });
  return promise;
}

/**
 * Carrega emuladores padrão para várias plataformas com deduplicação e cache.
 *
 * @param platformIds Lista de IDs; valores nulos/duplicados são ignorados.
 * @param reloadToken Token do store usado para invalidar cache.
 * @returns Mapa platformId -> emulador padrão ou null.
 */
export async function loadDefaultPlatformEmulators(
  platformIds: Array<number | null | undefined>,
  reloadToken: number
): Promise<Record<number, PlatformEmulator | null>> {
  const uniquePlatformIds = Array.from(new Set(platformIds.filter(isValidPlatformId)));
  const entries = await Promise.all(
    uniquePlatformIds.map(async (platformId) => [
      platformId,
      await getDefaultPlatformEmulator(platformId, reloadToken)
    ] as const)
  );

  return Object.fromEntries(entries) as Record<number, PlatformEmulator | null>;
}

/** Verifica se o valor pode ser usado como ID de plataforma. */
function isValidPlatformId(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
