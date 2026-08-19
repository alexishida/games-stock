/**
 * Regras compartilhadas de agrupamento visual e filtro de gêneros da biblioteca.
 *
 * Mantém a chave persistida no SQLite idêntica ao agrupamento usado pela biblioteca,
 * permitindo paginação SQL sem alterar quais variantes aparecem em cada card.
 */

import path from "node:path";

/** Dados mínimos necessários para calcular a chave visual de uma variante de jogo. */
export interface LibraryGroupSource {
  /** Título exibido na biblioteca. */
  title: string;
  /** Caminho opcional da ROM que pode conter subtítulo mais específico. */
  rom_path: string | null;
}

/**
 * Calcula chave persistível para jogos com ROM.
 * Jogos manuais retornam `null`, pois permanecem independentes pelo próprio ID SQLite.
 */
export function buildStoredLibraryGroupKey(game: LibraryGroupSource): string | null {
  if (!game.rom_path?.trim()) return null;
  return buildVersionGroupKey(game);
}

/**
 * Verifica se campo de gêneros composto contém exatamente gênero selecionado.
 * Replica semântica anterior, aceitando os delimitadores usados pelos importadores.
 */
export function matchesLibraryGenre(value: string | null | undefined, selectedGenre: string | null | undefined): boolean {
  const normalizedSelectedGenre = normalizeGenre(selectedGenre);
  if (!normalizedSelectedGenre) return true;
  return splitGenres(value).some((genre) => normalizeGenre(genre) === normalizedSelectedGenre);
}

/** Divide campo composto de gêneros em tokens individuais. */
function splitGenres(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[;,/|]+/g)
    .map((genre) => genre.trim())
    .filter(Boolean);
}

/** Normaliza gênero somente para comparação, preservando rótulo armazenado. */
function normalizeGenre(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase("pt-BR") ?? "";
}

/** Gera chave de grupo priorizando título salvo, exceto quando ROM tem subtítulo relevante. */
function buildVersionGroupKey(game: LibraryGroupSource): string {
  if (game.rom_path && detectVariantDescriptor(path.basename(game.rom_path), game.title)) {
    return buildVersionBaseTitle(game);
  }
  const normalizedTitleBase = normalizeTitleForMatch(stripVersionTags(game.title));
  return normalizedTitleBase || buildVersionBaseTitle(game);
}

/** Gera título-base usando ROM quando ela representa melhor variante que título salvo. */
function buildVersionBaseTitle(game: LibraryGroupSource): string {
  const romFileName = game.rom_path ? path.basename(game.rom_path, path.extname(game.rom_path)) : "";
  const romBase = stripVersionTags(romFileName);
  const titleBase = stripVersionTags(game.title);
  const candidate = romBase.length >= Math.max(6, titleBase.length - 4) ? romBase : titleBase;
  return normalizeTitleForMatch(candidate);
}

/** Remove tags de região, revisão e versão que não definem jogo-base. */
function stripVersionTags(value: string): string {
  return value
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, " ")
    .replace(/\b(?:rev(?:ision)?\.?\s*[a-z0-9.]+|v\d[\w.]*)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normaliza título para matching estável case-insensitive. */
function normalizeTitleForMatch(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Detecta subtítulo real no nome da ROM que distingue edição ou continuação. */
function detectVariantDescriptor(romFileName: string, title: string): string | null {
  const romStem = stripVersionTags(path.basename(romFileName, path.extname(romFileName)));
  const titleStem = stripVersionTags(title);
  if (!romStem || !titleStem) return null;
  if (normalizeTitleForMatch(romStem) === normalizeTitleForMatch(titleStem)) return null;

  const prefixPattern = new RegExp(`^${escapeRegExp(titleStem)}(?:\\s*[-:]+\\s*|\\s+)`, "i");
  const descriptor = romStem.replace(prefixPattern, "").trim();
  return descriptor && normalizeTitleForMatch(descriptor) !== normalizeTitleForMatch(romStem) ? descriptor : null;
}

/** Escapa texto para uso seguro na expressão regular de subtítulo. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
