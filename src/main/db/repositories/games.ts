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
import { CollectionCounts, CoverSyncStats, Game, GameCreateInput, GameFilters, GameLaunchStats, GameListResult, GameUpdateInput, GameVersionOption } from "../../../shared/types";

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
 * Retorna categorias/gêneros únicos já cadastrados na biblioteca.
 * Usado pelo select de filtro da tela principal.
 */
export function listGameGenres(): string[] {
  return gameDao().listGenres();
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
 * Lista os caminhos de ROM já cadastrados dentro de uma pasta específica.
 * Opcionalmente filtra por plataforma.
 *
 * Usado pelo sync incremental das pastas configuradas para detectar apenas
 * arquivos novos desde a última importação.
 */
export function listRomPathsByFolder(folderPath: string, platformId?: number): string[] {
  return gameDao().listRomPathsByFolder(folderPath, platformId);
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
 * Busca um jogo já vinculado a um `launchbox_id` em uma plataforma específica.
 * Permite tratar importações de metadados repetidos como variantes locais.
 */
export function findGameByLaunchBoxId(launchboxId: string, platformId: number): Game | null {
  return gameDao().findByLaunchBoxId(launchboxId, platformId);
}

/**
 * Retorna contadores agregados da coleção (total de jogos, por plataforma, por status, etc.).
 * Usado nos cards de resumo da tela inicial.
 */
export function getCollectionCounts(): CollectionCounts {
  return gameDao().collectionCounts();
}

/**
 * Retorna estatísticas agregadas do histórico de partidas jogadas.
 * Usado na nova seção de Configurações dedicada ao contador de launches.
 */
export function getGameLaunchStats(): GameLaunchStats {
  return gameDao().launchStats();
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

/**
 * Incrementa o contador de partidas de um jogo após um launch bem-sucedido.
 *
 * @param id - ID do jogo lançado.
 * @returns O jogo atualizado com `launch_count` já incrementado.
 */
export function incrementGameLaunchCount(id: number): Game {
  return gameDao().incrementLaunchCount(id);
}

/**
 * Zera todos os contadores de partidas registrados na biblioteca.
 *
 * @returns Quantidade de jogos afetados pela limpeza.
 */
export function resetGameLaunchStats(): { success: true; updated: number } {
  return gameDao().resetLaunchCounts();
}

/**
 * Lista variantes relacionadas e jogáveis de um jogo base.
 *
 * @param id - ID do jogo que originou a tentativa de launch.
 */
export function listGameVersions(id: number): GameVersionOption[] {
  return gameDao().listVersions(id);
}
