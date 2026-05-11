/**
 * Repositório de estado persistido da aplicação (app_state).
 *
 * Fachada fina sobre o AppStateDao. Fornece funções de leitura e escrita de valores
 * genéricos chave-valor serializados como JSON na tabela `app_state` do SQLite.
 *
 * Usado para persistir estado da UI e configurações que precisam sobreviver a reinicializações,
 * como jobs de importação, progresso de sincronização e preferências do usuário.
 */

import { getDatabase } from "../database";
import { AppStateDao } from "../dao/appStateDao";

/**
 * Cria uma instância do AppStateDao conectada ao banco de dados ativo.
 * Sempre obtém a conexão singleton via `getDatabase()`.
 */
function appStateDao(): AppStateDao {
  return new AppStateDao(getDatabase());
}

/**
 * Lê um valor do estado persistido pelo `key` informado.
 * Retorna `null` se a chave não existir.
 *
 * @param key - Chave de identificação do estado.
 * @returns O valor deserializado do JSON armazenado, ou `null`.
 */
export function getAppState<T>(key: string): T | null {
  return appStateDao().get(key) as T | null;
}

/**
 * Lê múltiplos valores do estado persistido de uma vez.
 *
 * @param keys - Lista de chaves a serem lidas.
 * @returns Objeto com as chaves encontradas e seus valores; chaves ausentes não aparecem no resultado.
 */
export function getAppStateMany(keys: string[]): Record<string, unknown> {
  return appStateDao().getMany(keys);
}

/**
 * Grava (insert ou update) um único valor no estado persistido.
 *
 * @param key - Chave de identificação do estado.
 * @param value - Valor a ser serializado como JSON e armazenado.
 */
export function setAppState(key: string, value: unknown): void {
  appStateDao().set(key, value);
}

/**
 * Grava múltiplos pares chave-valor no estado persistido em uma única operação.
 *
 * @param entries - Array de objetos `{ key, value }` a serem persistidos.
 * @param onlyIfMissing - Se `true`, ignora entradas cujas chaves já existem no banco.
 *                        Útil para inicializar valores padrão sem sobrescrever dados existentes.
 */
export function setAppStateMany(entries: Array<{ key: string; value: unknown }>, onlyIfMissing = false): void {
  appStateDao().setMany(entries, onlyIfMissing);
}

/**
 * Remove uma entrada do estado persistido pelo `key` informado.
 * Não falha se a chave não existir.
 *
 * @param key - Chave de identificação do estado a ser removido.
 */
export function removeAppState(key: string): void {
  appStateDao().remove(key);
}
