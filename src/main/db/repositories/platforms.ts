/**
 * Repositório de plataformas de jogos.
 *
 * Fachada fina sobre o PlatformDao. Expõe operações CRUD para plataformas,
 * além de funções de resolução de alias LaunchBox, extensões de ROM e mapeamentos.
 *
 * Código fora de `src/main/db` deve acessar plataformas exclusivamente por meio deste repositório.
 */

import { getDatabase } from "../database";
import { PlatformDao, PlatformInput } from "../dao/platformDao";
import { Platform, PlatformMappings, PlatformMappingsInput, PlatformRomExtension } from "../../../shared/types";

// Re-exporta PlatformInput para que consumidores externos não precisem importar do DAO diretamente.
export type { PlatformInput };

/**
 * Cria uma instância do PlatformDao conectada ao banco de dados ativo.
 */
function platformDao(): PlatformDao {
  return new PlatformDao(getDatabase());
}

/**
 * Normaliza um nome de plataforma para comparação sem distinção de acentos,
 * maiúsculas/minúsculas e caracteres especiais.
 *
 * Passos:
 * 1. Converte para minúsculas.
 * 2. Decompõe acentos via NFD e remove marcas diacríticas (U+0300–U+036F).
 * 3. Substitui qualquer sequência de caracteres não alfanuméricos por espaço.
 * 4. Colapsa espaços múltiplos e remove espaços nas bordas.
 */
function normalizePlatformName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Retorna a lista de todas as plataformas cadastradas no banco.
 */
export function listPlatforms(): Platform[] {
  return platformDao().list();
}

/**
 * Cria uma nova plataforma no banco de dados.
 *
 * @param data - Dados da plataforma (nome e categoria obrigatórios).
 * @returns A plataforma criada com o `id` gerado pelo banco.
 */
export function createPlatform(data: PlatformInput): Platform {
  return platformDao().create(data);
}

/**
 * Atualiza os dados de uma plataforma existente.
 *
 * @param id   - ID da plataforma a ser atualizada.
 * @param data - Campos a serem atualizados (parcial).
 * @returns A plataforma com os dados atualizados.
 */
export function updatePlatform(id: number, data: Partial<PlatformInput>): Platform {
  return platformDao().update(id, data);
}

/**
 * Remove uma plataforma do banco de dados.
 * Só é permitido se não houver jogos vinculados (RESTRICT na FK de games).
 *
 * @param id - ID da plataforma a ser removida.
 */
export function deletePlatform(id: number): { success: true } {
  return platformDao().delete(id);
}

/**
 * Busca uma plataforma pelo nome ou cria uma nova caso não exista.
 * Útil durante importações onde a plataforma pode não estar no catálogo padrão.
 *
 * @param name     - Nome da plataforma.
 * @param category - Categoria usada caso a plataforma seja criada (padrão: "Importadas").
 * @returns A plataforma existente ou recém-criada.
 */
export function findOrCreatePlatform(name: string, category = "Importadas"): Platform {
  return platformDao().findOrCreate(name, category);
}

/**
 * Retorna todos os aliases LaunchBox de uma plataforma pelo seu ID.
 *
 * Garante que o nome canônico da plataforma esteja sempre incluído na lista,
 * mesmo que não tenha sido registrado explicitamente como alias.
 *
 * @param platformId - ID da plataforma.
 * @returns Lista de aliases (inclui o nome canônico se ausente).
 */
export function getLaunchBoxAliasesForPlatformId(platformId: number): string[] {
  const aliases = platformDao().listLaunchBoxAliases(platformId).map((entry) => entry.alias);
  const platform = listPlatforms().find((entry) => entry.id === platformId);
  // Insere o nome canônico no início da lista se ele ainda não estiver presente (comparação normalizada).
  if (platform && !aliases.some((alias) => normalizePlatformName(alias) === normalizePlatformName(platform.name))) {
    aliases.unshift(platform.name);
  }
  return aliases;
}

/**
 * Retorna todos os aliases LaunchBox de uma plataforma pelo seu nome.
 * Usa `normalizePlatformName` para encontrar a plataforma mesmo com variações de grafia.
 *
 * @param name - Nome da plataforma (não precisa ser exato).
 * @returns Lista de aliases, ou apenas `[name]` se a plataforma não for encontrada.
 */
export function getLaunchBoxAliasesForPlatformName(name: string): string[] {
  const platform = listPlatforms().find((entry) => normalizePlatformName(entry.name) === normalizePlatformName(name));
  return platform ? getLaunchBoxAliasesForPlatformId(platform.id) : [name];
}

/**
 * Resolve uma plataforma a partir de um nome LaunchBox (ex.: "Nintendo Entertainment System").
 *
 * Algoritmo de matching (por ordem de prioridade):
 * 1. Correspondência exata normalizada com algum alias cadastrado.
 * 2. Correspondência parcial: o alias (>4 chars) está contido no nome LaunchBox informado.
 *    Aliases mais longos têm prioridade (sorted desc por comprimento).
 * 3. Fallback: correspondência exata normalizada com o nome canônico da plataforma.
 *
 * @param launchBoxPlatform - Nome da plataforma vindo do LaunchBox.
 * @returns A plataforma correspondente, ou `null` se não encontrada.
 */
export function resolvePlatformByLaunchBoxName(launchBoxPlatform: string): Platform | null {
  const normalizedLaunchBox = normalizePlatformName(launchBoxPlatform);
  const aliases = platformDao().listLaunchBoxAliases();
  // Ordena aliases do maior para o menor para priorizar correspondências mais específicas.
  const sorted = aliases.sort((a, b) => b.alias.length - a.alias.length);

  for (const entry of sorted) {
    const normalizedAlias = normalizePlatformName(entry.alias);
    if (!normalizedAlias) continue;
    // Correspondência exata.
    if (normalizedLaunchBox === normalizedAlias) {
      return listPlatforms().find((platform) => platform.id === entry.platform_id) ?? null;
    }
    // Correspondência parcial: alias contido no nome LaunchBox (mínimo 5 chars para evitar falsos positivos).
    if (normalizedAlias.length > 4 && normalizedLaunchBox.includes(normalizedAlias)) {
      return listPlatforms().find((platform) => platform.id === entry.platform_id) ?? null;
    }
  }

  // Fallback: tenta match direto com o nome canônico.
  return listPlatforms().find((entry) => normalizePlatformName(entry.name) === normalizedLaunchBox) ?? null;
}

/**
 * Retorna a lista de extensões de ROM primárias de uma plataforma, em minúsculas.
 * Usado na detecção automática de plataforma ao escanear uma pasta de ROMs.
 *
 * @param platformId - ID da plataforma.
 * @returns Lista de extensões primárias (ex.: [".nes", ".fds"]).
 */
export function getPrimaryRomExtensionsForPlatform(platformId: number): string[] {
  return platformDao()
    .listRomExtensions(platformId, true)
    .map((entry) => entry.extension.toLowerCase());
}

/**
 * Retorna todos os mapeamentos de extensões de ROM primárias de todas as plataformas.
 * Usado para exibir a tabela de extensões suportadas nas configurações.
 */
export function listPrimaryRomExtensionMappings(): PlatformRomExtension[] {
  return platformDao().listRomExtensions(undefined, true);
}

/**
 * Retorna lista deduplicada e ordenada de todas as extensões de ROM primárias suportadas.
 * Usada em filtros de varredura de pastas para incluir apenas arquivos reconhecidos.
 */
export function listSupportedRomExtensions(): string[] {
  return Array.from(
    new Set(
      platformDao()
        .listRomExtensions(undefined, true)
        .map((entry) => entry.extension.toLowerCase())
    )
  ).sort((a, b) => a.localeCompare(b));
}

/**
 * Retorna os mapeamentos completos (aliases LaunchBox e extensões de ROM) de uma plataforma.
 * Usado na tela de configurações de plataforma para exibir e editar os mapeamentos.
 *
 * @param platformId - ID da plataforma.
 */
export function getPlatformMappings(platformId: number): PlatformMappings {
  return {
    aliases: platformDao().listLaunchBoxAliases(platformId),
    romExtensions: platformDao().listRomExtensions(platformId)
  };
}

/**
 * Persiste os mapeamentos (aliases e extensões de ROM) de uma plataforma e retorna
 * os mapeamentos atualizados após a gravação.
 *
 * @param platformId - ID da plataforma.
 * @param input      - Novos mapeamentos a serem salvos.
 * @returns Os mapeamentos atualizados relidos do banco.
 */
export function savePlatformMappings(platformId: number, input: PlatformMappingsInput): PlatformMappings {
  platformDao().saveMappings(platformId, input);
  return getPlatformMappings(platformId);
}
