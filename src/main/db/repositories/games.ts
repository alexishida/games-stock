/**
 * Repositório de jogos da biblioteca.
 *
 * Fachada fina sobre o GameDao. Expõe operações CRUD para a tabela `games`,
 * além de operações especializadas como upsert via LaunchBox ID, contagem por pasta de ROM,
 * estatísticas de capa e listagens filtradas.
 *
 * Código fora de `src/main/db` deve acessar jogos exclusivamente por meio deste repositório.
 */

import { getDatabase } from "../database";
import { GameDao } from "../dao/gameDao";
import { CollectionCounts, CoverSyncStats, Game, GameCreateInput, GameFilters, GameListResult, GameUpdateInput } from "../../../shared/types";

/**
 * Cria uma instância do GameDao conectada ao banco de dados ativo.
 */
function gameDao(): GameDao {
  return new GameDao(getDatabase());
}

/**
 * Retorna uma página de jogos da biblioteca com suporte a filtros e paginação.
 *
 * @param filters - Filtros opcionais (plataforma, status, favorito, texto, paginação).
 * @returns Resultado paginado com lista de jogos e total encontrado.
 */
export function listGames(filters: GameFilters = {}): GameListResult {
  return gameDao().list(filters);
}

/**
 * Retorna um jogo pelo ID, ou `null` se não encontrado.
 *
 * @param id - ID do jogo no banco.
 */
export function getGame(id: number): Game | null {
  return gameDao().get(id);
}

/**
 * Cria um novo jogo na biblioteca.
 *
 * @param data - Dados do jogo (parcial; campos obrigatórios validados no DAO).
 * @returns O jogo criado com o `id` gerado pelo banco.
 */
export function createGame(data: Partial<GameCreateInput>): Game {
  return gameDao().create(data);
}

/**
 * Atualiza os dados de um jogo existente.
 *
 * @param id   - ID do jogo a ser atualizado.
 * @param data - Campos a serem atualizados.
 * @returns O jogo com os dados atualizados.
 */
export function updateGame(id: number, data: GameUpdateInput): Game {
  return gameDao().update(id, data);
}

/**
 * Remove um jogo do banco de dados pelo ID.
 *
 * @param id - ID do jogo a ser removido.
 */
export function deleteGame(id: number): { success: true } {
  return gameDao().delete(id);
}

/**
 * Remove todos os jogos cujo `rom_path` começa com o `folderPath` informado.
 * Opcionalmente filtra por `platformId` para remover apenas jogos de uma plataforma.
 *
 * Usado ao desvincular uma pasta de ROM da biblioteca.
 *
 * @param folderPath - Caminho raiz da pasta de ROM.
 * @param platformId - (opcional) Restringe a exclusão a uma plataforma específica.
 * @returns Número de jogos removidos.
 */
export function deleteGamesByRomFolder(folderPath: string, platformId?: number): { success: true; deleted: number } {
  return gameDao().deleteByRomFolder(folderPath, platformId);
}

/**
 * Conta jogos cujo `rom_path` começa com o `folderPath` informado.
 * Opcionalmente filtra por `platformId`.
 *
 * @param folderPath - Caminho raiz da pasta de ROM.
 * @param platformId - (opcional) Restringe a contagem a uma plataforma específica.
 */
export function countGamesByRomFolder(folderPath: string, platformId?: number): number {
  return gameDao().countByRomFolder(folderPath, platformId);
}

/**
 * Remove jogos sem `rom_path` de uma plataforma específica cujos títulos estejam na lista.
 * Usado para limpar entradas de metadados sem ROM associada durante re-importações.
 *
 * @param platformId - ID da plataforma.
 * @param titles     - Lista de títulos a serem removidos.
 * @returns Número de jogos removidos.
 */
export function deleteGamesWithoutRomPathByPlatformAndTitles(platformId: number, titles: string[]): { success: true; deleted: number } {
  return gameDao().deleteWithoutRomPathByPlatformAndTitles(platformId, titles);
}

/**
 * Realiza upsert de um jogo importado via LaunchBox.
 *
 * - Se já existir um jogo com o mesmo `launchbox_id` e `platform_id`, atualiza os campos.
 * - Caso contrário, insere um novo registro.
 *
 * @param data - Dados do jogo com `title` e `platform_id` obrigatórios.
 * @returns O jogo resultante e se foi criado (`created: true`) ou atualizado (`created: false`).
 */
export function upsertLaunchBoxGame(data: Partial<GameCreateInput> & { title: string; platform_id: number }): { game: Game; created: boolean } {
  return gameDao().upsertLaunchBox(data);
}

/**
 * Retorna contadores agregados da coleção (total de jogos, por plataforma, por status, etc.).
 * Usado nos cards de resumo da tela inicial.
 */
export function getCollectionCounts(): CollectionCounts {
  return gameDao().collectionCounts();
}

/**
 * Retorna estatísticas de sincronização de capas (total, com capa, sem capa).
 * Usado na tela de configurações e no job de sincronização de mídia.
 */
export function getCoverStats(): CoverSyncStats {
  return gameDao().coverStats();
}

/**
 * Lista todos os jogos sem capa associada (`box_art_path` nulo ou vazio).
 * Usado pelo job de sincronização de mídia para priorizar downloads.
 */
export function listGamesMissingCovers(): Game[] {
  return gameDao().listMissingCovers();
}

/**
 * Lista todos os jogos vinculados ao LaunchBox (com `launchbox_id` preenchido).
 * Usado para sincronização de metadados e detecção de atualizações.
 */
export function listLaunchBoxLinkedGames(): Game[] {
  return gameDao().listLaunchBoxLinked();
}
