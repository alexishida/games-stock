/**
 * Mapeamento entre plataformas de videogame e cores do RetroArch (libretro).
 *
 * Fornece:
 * - Lista estática de plataformas com core principal e cores de fallback.
 * - Aliases alternativos para correspondência de nomes de plataforma.
 * - Funções utilitárias para encontrar o core correto dado o nome de uma plataforma.
 *
 * Usado na detecção automática de plataforma durante a importação de pastas de ROM
 * e na configuração de emuladores RetroArch.
 */

/**
 * Representa a associação entre uma plataforma e seu(s) core(s) RetroArch.
 */
export interface RetroArchPlatformCore {
  /** Nome canônico da plataforma (ex.: "Nintendo Entertainment System"). */
  platformName: string;
  /** Nome do core libretro principal recomendado para esta plataforma. */
  coreName: string;
  /** Nomes alternativos pelos quais a plataforma pode ser referenciada. */
  aliases?: string[];
  /** Cores alternativos usados como fallback quando o core principal não está instalado. */
  fallbackCoreNames?: string[];
}

/**
 * Lista completa de plataformas suportadas com seus cores RetroArch correspondentes.
 * Ordenada aproximadamente por fabricante/família de hardware.
 * Usada como base para detecção automática e sugestão de core na UI.
 */
export const RETROARCH_PLATFORM_CORES: RetroArchPlatformCore[] = [
  { platformName: "Atari 2600", coreName: "stella_libretro" },
  { platformName: "Atari 5200", coreName: "a5200_libretro" },
  { platformName: "Atari 7800", coreName: "prosystem_libretro" },
  { platformName: "Atari Jaguar", coreName: "virtualjaguar_libretro" },
  { platformName: "Atari Lynx", coreName: "handy_libretro" },
  { platformName: "Atari ST", coreName: "hatari_libretro" },
  { platformName: "ColecoVision", coreName: "gearcoleco_libretro" },
  { platformName: "Commodore 128", coreName: "vice_x128_libretro" },
  { platformName: "Commodore 64", coreName: "vice_x64_libretro" },
  { platformName: "Commodore Amiga", coreName: "puae_libretro" },
  { platformName: "Commodore PET", coreName: "vice_xpet_libretro" },
  { platformName: "Commodore Plus 4", coreName: "vice_xplus4_libretro", aliases: ["Commodore Plus/4"] },
  { platformName: "Commodore VIC-20", coreName: "vice_xvic_libretro" },
  { platformName: "GCE Vectrex", coreName: "vecx_libretro", aliases: ["Vectrex"] },
  { platformName: "Magnavox Odyssey 2", coreName: "o2em_libretro", aliases: ["Philips Videopac+"] },
  { platformName: "Mattel Intellivision", coreName: "freeintv_libretro", aliases: ["Intellivision"] },
  { platformName: "Microsoft MSX", coreName: "fmsx_libretro", aliases: ["MSX"] },
  { platformName: "NEC PC-FX", coreName: "mednafen_pcfx_libretro", aliases: ["PC-FX"] },
  { platformName: "NEC TurboGrafx-16", coreName: "mednafen_pce_fast_libretro", aliases: ["TurboGrafx-16", "PC Engine"] },
  { platformName: "NEC TurboGrafx-CD", coreName: "mednafen_pce_fast_libretro", aliases: ["TurboGrafx-CD", "PC Engine CD"] },
  { platformName: "Nintendo 64", coreName: "mupen64plus_next_libretro", aliases: ["N64"], fallbackCoreNames: ["parallel_n64_libretro"] },
  { platformName: "Nintendo DS", coreName: "desmume_libretro", aliases: ["NDS"], fallbackCoreNames: ["melonds_libretro"] },
  { platformName: "Nintendo Entertainment System", coreName: "nestopia_libretro", aliases: ["NES"], fallbackCoreNames: ["fceumm_libretro", "mesen_libretro"] },
  { platformName: "Nintendo Famicom Disk System", coreName: "nestopia_libretro", aliases: ["Famicom Disk System"] },
  { platformName: "Nintendo Game & Watch", coreName: "gw_libretro", aliases: ["Game & Watch"] },
  { platformName: "Nintendo Game Boy", coreName: "gambatte_libretro", aliases: ["Game Boy"], fallbackCoreNames: ["sameboy_libretro", "mgba_libretro"] },
  { platformName: "Nintendo Game Boy Advance", coreName: "vba_next_libretro", aliases: ["Game Boy Advance", "GBA"], fallbackCoreNames: ["mgba_libretro", "gpsp_libretro", "vbam_libretro"] },
  { platformName: "Nintendo Game Boy Color", coreName: "gambatte_libretro", aliases: ["Game Boy Color", "GBC"], fallbackCoreNames: ["sameboy_libretro", "mgba_libretro"] },
  { platformName: "Nintendo Pokemon Mini", coreName: "pokemini_libretro", aliases: ["Pokemon Mini"] },
  { platformName: "Nintendo Virtual Boy", coreName: "mednafen_vb_libretro", aliases: ["Virtual Boy"] },
  { platformName: "PC Engine SuperGrafx", coreName: "mednafen_supergrafx_libretro", aliases: ["SuperGrafx"] },
  { platformName: "Philips CD-i", coreName: "same_cdi_libretro", aliases: ["CD-i"] },
  { platformName: "Sammy Atomiswave", coreName: "flycast_libretro", aliases: ["Atomiswave"] },
  { platformName: "Sega 32X", coreName: "picodrive_libretro", aliases: ["32X"] },
  { platformName: "Sega CD", coreName: "genesis_plus_gx_libretro", aliases: ["Mega-CD", "Mega CD"] },
  { platformName: "Sega Dreamcast", coreName: "flycast_libretro", aliases: ["Dreamcast"] },
  { platformName: "Sega Game Gear", coreName: "genesis_plus_gx_libretro", aliases: ["Game Gear"] },
  { platformName: "Sega Genesis", coreName: "genesis_plus_gx_libretro", aliases: ["Sega Mega Drive", "Mega Drive"], fallbackCoreNames: ["picodrive_libretro", "blastem_libretro"] },
  { platformName: "Sega Master System", coreName: "genesis_plus_gx_libretro", aliases: ["Master System"], fallbackCoreNames: ["smsplus_libretro", "picodrive_libretro"] },
  { platformName: "Sega Naomi", coreName: "flycast_libretro", aliases: ["Naomi"] },
  { platformName: "Sega Naomi 2", coreName: "flycast_libretro", aliases: ["Naomi 2"] },
  { platformName: "Sega Saturn", coreName: "yabause_libretro", aliases: ["Saturn"] },
  { platformName: "Sinclair ZX Spectrum", coreName: "fuse_libretro", aliases: ["ZX Spectrum"] },
  { platformName: "Sinclair ZX-81", coreName: "81_libretro", aliases: ["ZX-81", "ZX81"] },
  { platformName: "SNK Neo Geo AES", coreName: "fbalpha_libretro", aliases: ["Neo Geo AES"] },
  { platformName: "SNK Neo Geo MVS", coreName: "fbalpha_libretro", aliases: ["Neo Geo MVS", "Neo Geo"] },
  { platformName: "SNK Neo Geo Pocket", coreName: "mednafen_ngp_libretro", aliases: ["Neo Geo Pocket"] },
  { platformName: "SNK Neo Geo Pocket Color", coreName: "mednafen_ngp_libretro", aliases: ["Neo Geo Pocket Color"] },
  { platformName: "Sony Playstation", coreName: "swanstation_libretro", aliases: ["PlayStation", "Sony PlayStation", "PS1"], fallbackCoreNames: ["mednafen_psx_hw_libretro", "pcsx_rearmed_libretro"] },
  { platformName: "Sony PlayStation 2", coreName: "pcsx2_libretro", aliases: ["PlayStation 2", "PS2"] },
  { platformName: "Sony PSP", coreName: "ppsspp_libretro", aliases: ["PSP", "PlayStation Portable"] },
  { platformName: "Super Nintendo Entertainment System", coreName: "snes9x_libretro", aliases: ["Super Nintendo", "SNES"], fallbackCoreNames: ["bsnes_mercury_balanced_libretro", "bsnes_libretro", "bsnes2014_balanced_libretro"] },
  { platformName: "WonderSwan", coreName: "mednafen_wswan_libretro" },
  { platformName: "WonderSwan Color", coreName: "mednafen_wswan_libretro" }
];

/**
 * Lista ordenada alfabeticamente com todos os nomes únicos de cores RetroArch
 * referenciados em RETROARCH_PLATFORM_CORES (incluindo cores de fallback).
 * Usada para popular selects e validar cores configurados pelo usuário.
 */
export const RETROARCH_CORE_NAMES = Array.from(
  new Set(RETROARCH_PLATFORM_CORES.flatMap((entry) => [entry.coreName, ...(entry.fallbackCoreNames ?? [])]))
).sort((a, b) => a.localeCompare(b));

/**
 * Normaliza um nome de plataforma para comparação case-insensitive e sem acentos.
 *
 * Passos aplicados:
 * 1. Decompõe caracteres Unicode (NFD) e remove diacríticos (acentos).
 * 2. Converte para minúsculas.
 * 3. Substitui "&" por "and".
 * 4. Remove caracteres não alfanuméricos, substituindo por espaço.
 * 5. Colapsa múltiplos espaços em um único e remove espaços nas bordas.
 *
 * @param value - Nome de plataforma a normalizar.
 * @returns String normalizada para uso em comparações.
 */
export function normalizeRetroArchPlatformName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Retorna o nome do core RetroArch principal para uma plataforma.
 *
 * Faz a correspondência comparando o nome normalizado da plataforma
 * contra o `platformName` e todos os `aliases` de cada entrada em
 * RETROARCH_PLATFORM_CORES.
 *
 * @param platformName - Nome da plataforma a pesquisar (aceita aliases e variações de grafia).
 * @returns Nome do core principal ou `null` se nenhuma correspondência for encontrada.
 */
export function getRetroArchCoreForPlatform(platformName: string): string | null {
  const normalized = normalizeRetroArchPlatformName(platformName);
  const match = RETROARCH_PLATFORM_CORES.find((entry) =>
    [entry.platformName, ...(entry.aliases ?? [])].some((name) => normalizeRetroArchPlatformName(name) === normalized)
  );
  return match?.coreName ?? null;
}

/**
 * Retorna todos os cores candidatos para uma plataforma, em ordem de preferência.
 *
 * O primeiro elemento é o core principal; os seguintes são os fallbacks.
 * Retorna array vazio se nenhuma correspondência for encontrada.
 *
 * @param platformName - Nome da plataforma a pesquisar (aceita aliases e variações de grafia).
 * @returns Array de nomes de cores em ordem de preferência (principal primeiro).
 */
export function getRetroArchCoreCandidatesForPlatform(platformName: string): string[] {
  const normalized = normalizeRetroArchPlatformName(platformName);
  const match = RETROARCH_PLATFORM_CORES.find((entry) =>
    [entry.platformName, ...(entry.aliases ?? [])].some((name) => normalizeRetroArchPlatformName(name) === normalized)
  );
  return match ? [match.coreName, ...(match.fallbackCoreNames ?? [])] : [];
}
