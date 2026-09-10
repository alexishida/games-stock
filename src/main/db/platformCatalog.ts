/**
 * Catálogo estático de plataformas suportadas pelo GameStock.
 *
 * Define todas as plataformas conhecidas com seus nomes canônicos, categorias,
 * aliases LaunchBox (usados na importação de metadados) e extensões de ROM aceitas.
 *
 * Este arquivo é utilizado durante a inicialização do banco de dados para popular
 * as tabelas `platforms`, `platform_launchbox_aliases` e `platform_rom_extensions`.
 */

/**
 * Representa uma extensão de ROM associada a uma plataforma.
 */
export interface PlatformCatalogRomExtension {
  /** Extensão do arquivo, incluindo o ponto (ex.: ".nes", ".iso"). */
  extension: string;
  /** Descrição legível do tipo/formato do arquivo. */
  kind: string;
  /** Indica se esta é uma extensão principal da plataforma (usada na detecção automática). */
  isPrimary: boolean;
}

/**
 * Representa uma entrada de plataforma no catálogo estático.
 */
export interface PlatformCatalogEntry {
  /** Nome canônico da plataforma no banco de dados. */
  name: string;
  /** Categoria da plataforma (ex.: "Consoles", "Portateis", "PC"). */
  category: string;
  /** Lista de nomes alternativos usados pelo LaunchBox para esta plataforma. */
  launchboxAliases: string[];
  /** Extensões de ROM reconhecidas para esta plataforma. */
  romExtensions: PlatformCatalogRomExtension[];
}

/**
 * Extensões de arquivo compactado presentes em quase todas as plataformas.
 * Reutilizadas via spread para evitar repetição no catálogo.
 */
const COMPRESSED_ROM_EXTENSIONS: PlatformCatalogRomExtension[] = [
  { extension: ".7z", kind: "Arquivo compactado", isPrimary: true },
  { extension: ".zip", kind: "Arquivo compactado", isPrimary: true }
];

/**
 * Catálogo completo de plataformas suportadas pelo GameStock.
 * Cada entrada é usada como seed na inicialização do banco de dados.
 */
export const PLATFORM_CATALOG: PlatformCatalogEntry[] = [
  // Plataformas de arcade mantidas separadas para preservar metadados, emuladores
  // e formatos próprios de cada placa, sem misturá-los com consoles domésticos.
  {
    name: "Arcade",
    category: "Arcade",
    launchboxAliases: ["Arcade", "MAME"],
    romExtensions: [
      { extension: ".chd", kind: "Imagem de disco arcade", isPrimary: true },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Capcom CPS-1",
    category: "Arcade",
    launchboxAliases: ["Arcade - Capcom CPS-1", "Capcom CPS-1"],
    romExtensions: [
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Capcom CPS-2",
    category: "Arcade",
    launchboxAliases: ["Arcade - Capcom CPS-2", "Capcom CPS-2"],
    romExtensions: [
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Capcom CPS-3",
    category: "Arcade",
    launchboxAliases: ["Arcade - Capcom CPS-3", "Capcom CPS-3"],
    romExtensions: [
      { extension: ".chd", kind: "Imagem de disco CPS-3", isPrimary: true },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Atari 2600",
    category: "Consoles",
    launchboxAliases: ["Atari 2600"],
    romExtensions: [
      { extension: ".a26", kind: "Cartucho ROM", isPrimary: true },
      { extension: ".bin", kind: "Binario generico", isPrimary: false },
      { extension: ".rom", kind: "ROM generica", isPrimary: true },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Atari 7800",
    category: "Consoles",
    launchboxAliases: ["Atari 7800"],
    romExtensions: [
      { extension: ".a78", kind: "Cartucho ROM", isPrimary: true },
      { extension: ".bin", kind: "Binario generico", isPrimary: false },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Commodore 64",
    category: "PC",
    launchboxAliases: ["Commodore 64", "Commodore C64", "C64"],
    romExtensions: [
      { extension: ".d64", kind: "Imagem de disquete 1541", isPrimary: true },
      { extension: ".t64", kind: "Tape archive", isPrimary: true },
      { extension: ".prg", kind: "Programa executavel", isPrimary: true },
      { extension: ".crt", kind: "Imagem de cartucho", isPrimary: true },
      { extension: ".tap", kind: "Imagem de fita", isPrimary: true },
      { extension: ".g64", kind: "Imagem de disquete", isPrimary: true },
      { extension: ".nib", kind: "Imagem de disquete", isPrimary: true },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Commodore Amiga",
    category: "PC",
    launchboxAliases: ["Commodore Amiga", "Amiga"],
    romExtensions: [
      { extension: ".adf", kind: "Amiga Disk File", isPrimary: true },
      { extension: ".dms", kind: "Disk Masher System", isPrimary: true },
      { extension: ".lha", kind: "Arquivo LHA", isPrimary: true },
      { extension: ".ipf", kind: "Preservation format", isPrimary: true },
      { extension: ".hdf", kind: "Hard Disk File", isPrimary: true },
      { extension: ".adz", kind: "ADF comprimido", isPrimary: true },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Game Boy",
    category: "Portateis",
    launchboxAliases: ["Nintendo Game Boy", "Game Boy"],
    romExtensions: [
      { extension: ".gb", kind: "Cartucho ROM", isPrimary: true },
      { extension: ".sgb", kind: "Super Game Boy ROM", isPrimary: true },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Game Boy Advance",
    category: "Portateis",
    launchboxAliases: ["Nintendo Game Boy Advance", "Game Boy Advance", "GBA"],
    romExtensions: [
      { extension: ".gba", kind: "Cartucho ROM", isPrimary: true },
      { extension: ".agb", kind: "Cartucho ROM", isPrimary: true },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Game Boy Color",
    category: "Portateis",
    launchboxAliases: ["Nintendo Game Boy Color", "Game Boy Color", "GBC"],
    romExtensions: [
      { extension: ".gbc", kind: "Cartucho ROM", isPrimary: true },
      { extension: ".cgb", kind: "Cartucho ROM", isPrimary: true },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Nintendo 64",
    category: "Consoles",
    launchboxAliases: ["Nintendo 64", "N64"],
    romExtensions: [
      { extension: ".n64", kind: "Cartucho ROM", isPrimary: true },
      { extension: ".z64", kind: "Cartucho ROM", isPrimary: true },
      { extension: ".v64", kind: "Cartucho ROM", isPrimary: true },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Nintendo DS",
    category: "Portateis",
    launchboxAliases: ["Nintendo DS", "NDS"],
    romExtensions: [
      { extension: ".nds", kind: "Cartucho ROM", isPrimary: true },
      { extension: ".dsi", kind: "Cartucho DSi Enhanced", isPrimary: true },
      { extension: ".ids", kind: "Cartucho ROM", isPrimary: true },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Nintendo NES",
    category: "Consoles",
    launchboxAliases: ["Nintendo Entertainment System", "Nintendo NES / Famicom", "NES", "Famicom"],
    romExtensions: [
      { extension: ".nes", kind: "iNES format", isPrimary: true },
      { extension: ".unf", kind: "UNIF format", isPrimary: true },
      { extension: ".unif", kind: "UNIF format", isPrimary: true },
      { extension: ".fds", kind: "Famicom Disk System", isPrimary: true },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Nintendo GameCube",
    category: "Consoles",
    launchboxAliases: ["Nintendo GameCube", "GameCube"],
    romExtensions: [
      { extension: ".iso", kind: "Imagem de disco", isPrimary: true },
      { extension: ".gcm", kind: "GameCube Master Disc Image", isPrimary: true },
      { extension: ".rvz", kind: "RVZ compressed image", isPrimary: true },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Nintendo Wii",
    category: "Consoles",
    launchboxAliases: ["Nintendo Wii", "Wii"],
    romExtensions: [
      { extension: ".iso", kind: "Imagem de disco", isPrimary: true },
      { extension: ".wbfs", kind: "Wii Backup File System", isPrimary: true },
      { extension: ".rvz", kind: "RVZ compressed image", isPrimary: true },
      { extension: ".wad", kind: "Wii Channel package", isPrimary: true },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Sony PlayStation",
    category: "Consoles",
    launchboxAliases: ["PlayStation", "Sony PlayStation", "Sony Playstation", "PS1"],
    romExtensions: [
      { extension: ".cue", kind: "Imagem de CD", isPrimary: true },
      { extension: ".img", kind: "Imagem de CD", isPrimary: true },
      { extension: ".iso", kind: "Imagem ISO", isPrimary: true },
      { extension: ".pbp", kind: "Eboot comprimido", isPrimary: true },
      { extension: ".chd", kind: "Compressed Hunks of Data", isPrimary: true },
      { extension: ".bin", kind: "BIN de faixa", isPrimary: false },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Sony PlayStation 2",
    category: "Consoles",
    launchboxAliases: ["PlayStation 2", "Sony PlayStation 2", "Sony Playstation 2", "PS2"],
    romExtensions: [
      { extension: ".iso", kind: "Imagem ISO", isPrimary: true },
      { extension: ".cue", kind: "Imagem de CD/DVD", isPrimary: true },
      { extension: ".chd", kind: "Compressed Hunks of Data", isPrimary: true },
      { extension: ".cso", kind: "Compressed ISO", isPrimary: true },
      { extension: ".bin", kind: "BIN de faixa", isPrimary: false },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Sega CD",
    category: "Consoles",
    launchboxAliases: ["Sega CD", "Mega-CD", "Mega CD"],
    romExtensions: [
      { extension: ".cue", kind: "Imagem de CD", isPrimary: true },
      { extension: ".iso", kind: "Imagem ISO", isPrimary: true },
      { extension: ".chd", kind: "Compressed Hunks of Data", isPrimary: true },
      { extension: ".img", kind: "Imagem de CD", isPrimary: true },
      { extension: ".bin", kind: "BIN de faixa", isPrimary: false },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Sega Dreamcast",
    category: "Consoles",
    launchboxAliases: ["Sega Dreamcast", "Dreamcast"],
    romExtensions: [
      { extension: ".gdi", kind: "GD-ROM dump", isPrimary: true },
      { extension: ".cdi", kind: "DiscJuggler image", isPrimary: true },
      { extension: ".chd", kind: "Compressed Hunks of Data", isPrimary: true },
      { extension: ".iso", kind: "Imagem ISO", isPrimary: true },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Sega Game Gear",
    category: "Portateis",
    launchboxAliases: ["Sega Game Gear", "Game Gear"],
    romExtensions: [
      { extension: ".gg", kind: "Cartucho ROM", isPrimary: true },
      { extension: ".bin", kind: "Binario generico", isPrimary: false },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Sega Master System",
    category: "Consoles",
    launchboxAliases: ["Sega Master System", "Master System"],
    romExtensions: [
      { extension: ".sms", kind: "Cartucho ROM", isPrimary: true },
      { extension: ".bin", kind: "Binario generico", isPrimary: false },
      { extension: ".sg", kind: "SG format", isPrimary: true },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Sega Mega Drive",
    category: "Consoles",
    launchboxAliases: ["Sega Mega Drive", "Sega Genesis", "Mega Drive", "Sega Mega Drive / Genesis"],
    romExtensions: [
      { extension: ".md", kind: "Cartucho ROM", isPrimary: true },
      { extension: ".gen", kind: "Cartucho ROM", isPrimary: true },
      { extension: ".smd", kind: "Super Magic Drive format", isPrimary: true },
      { extension: ".68k", kind: "Cartucho ROM", isPrimary: true },
      { extension: ".bin", kind: "Binario generico", isPrimary: false },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Sega Saturn",
    category: "Consoles",
    launchboxAliases: ["Sega Saturn", "Saturn"],
    romExtensions: [
      { extension: ".cue", kind: "Imagem de CD", isPrimary: true },
      { extension: ".iso", kind: "Imagem ISO", isPrimary: true },
      { extension: ".chd", kind: "Compressed Hunks of Data", isPrimary: true },
      { extension: ".mds", kind: "Alcohol 120% image", isPrimary: true },
      { extension: ".bin", kind: "BIN de faixa", isPrimary: false },
      { extension: ".mdf", kind: "Arquivo de dados MDS", isPrimary: false },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Super Nintendo",
    category: "Consoles",
    // Inclui aliases japoneses para que buscas por títulos de SNES também
    // encontrem registros marcados como Super Famicom no LaunchBox.
    launchboxAliases: [
      "Super Nintendo",
      "Super Nintendo Entertainment System",
      "SNES",
      "Super Famicom",
      "Nintendo Super Famicom",
      "Super Famicom"
    ],
    romExtensions: [
      { extension: ".sfc", kind: "Cartucho ROM", isPrimary: true },
      { extension: ".smc", kind: "Super Magic Card format", isPrimary: true },
      { extension: ".fig", kind: "Cartucho ROM", isPrimary: true },
      { extension: ".bin", kind: "Binario generico", isPrimary: false },
      { extension: ".swc", kind: "Super Wild Card format", isPrimary: true },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Game Engine",
    category: "PC",
    launchboxAliases: ["Game Engine (SCUMM/etc.)", "ScummVM"],
    romExtensions: [
      { extension: ".dat", kind: "Arquivo de dados", isPrimary: true },
      { extension: ".pak", kind: "Pacote de assets", isPrimary: true },
      { extension: ".wad", kind: "WAD", isPrimary: true },
      { extension: ".grp", kind: "Build Engine Group File", isPrimary: true },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Sammy Atomiswave",
    category: "Arcade",
    launchboxAliases: ["Sammy Atomiswave", "Atomiswave"],
    romExtensions: [
      { extension: ".bin", kind: "Imagem de cartucho arcade", isPrimary: false },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Sega Model 2",
    category: "Arcade",
    launchboxAliases: ["Sega Model 2", "Arcade - Sega Model 2"],
    romExtensions: [
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Sega Model 3",
    category: "Arcade",
    launchboxAliases: ["Sega Model 3", "Arcade - Sega Model 3"],
    romExtensions: [
      { extension: ".zip", kind: "Conjunto de ROM Model 3", isPrimary: true },
    ]
  },
  {
    name: "Sega Naomi",
    category: "Arcade",
    launchboxAliases: ["Sega Naomi", "Naomi"],
    romExtensions: [
      { extension: ".bin", kind: "Imagem de cartucho arcade", isPrimary: false },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Sega Naomi 2",
    category: "Arcade",
    launchboxAliases: ["Sega Naomi 2", "Naomi 2"],
    romExtensions: [
      { extension: ".bin", kind: "Imagem de cartucho arcade", isPrimary: false },
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "SNK Neo Geo MVS",
    category: "Arcade",
    launchboxAliases: ["SNK Neo Geo MVS", "Neo Geo MVS"],
    romExtensions: [
      ...COMPRESSED_ROM_EXTENSIONS
    ]
  },
  {
    name: "Taito Type X",
    category: "Arcade",
    launchboxAliases: ["Taito Type X", "Taito Type X2", "Taito Type X3"],
    romExtensions: [
      { extension: ".exe", kind: "Executavel do jogo arcade", isPrimary: true },
      { extension: ".bat", kind: "Script de inicializacao arcade", isPrimary: true }
    ]
  },
  {
    name: "TeknoParrot",
    category: "Arcade",
    launchboxAliases: ["TeknoParrot"],
    romExtensions: [
      { extension: ".xml", kind: "Perfil de jogo TeknoParrot", isPrimary: true }
    ]
  }
];

/**
 * Verifica se uma plataforma canônica pertence à categoria Arcade.
 * A decisão de launch usa o catálogo para preservar arquivos compactados que
 * emuladores arcade leem diretamente, como os conjuntos ZIP do MAME.
 */
export function isArcadePlatform(platformName: string | null | undefined): boolean {
  return Boolean(platformName) && PLATFORM_CATALOG.some(
    (platform) => platform.category === "Arcade" && platform.name === platformName
  );
}

/**
 * Mapeamentos de nomes legados para nomes canônicos de plataformas.
 * Usado na migration `migratePlatformAliases` para corrigir entradas antigas no banco.
 *
 * Formato: [nome_legado, nome_canonico]
 */
export const LEGACY_PLATFORM_ALIASES: Array<[string, string]> = [
  ["Sega Genesis", "Sega Mega Drive"],
  ["NES", "Nintendo NES"],
  ["Nintendo Entertainment System", "Nintendo NES"],
  ["PlayStation", "Sony PlayStation"],
  ["Sony Playstation", "Sony PlayStation"],
  ["PlayStation 2", "Sony PlayStation 2"],
  ["Sony Playstation 2", "Sony PlayStation 2"],
  ["Super Nintendo Entertainment System", "Super Nintendo"]
];

/**
 * Lista deduplicada e ordenada de todas as extensões de ROM primárias presentes no catálogo.
 * Usada em filtros de detecção automática de plataforma por extensão de arquivo.
 */
export const ALL_SUPPORTED_ROM_EXTENSIONS = Array.from(
  new Set(
    PLATFORM_CATALOG
      .flatMap((entry) => entry.romExtensions)
      .filter((entry) => entry.isPrimary)
      .map((entry) => entry.extension)
  )
).sort((a, b) => a.localeCompare(b));
