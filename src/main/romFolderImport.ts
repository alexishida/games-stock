/**
 * Importação de ROMs a partir de pastas do sistema de arquivos.
 *
 * Provê duas operações principais:
 * - `scanRomFolder`: varre pastas e classifica arquivos como candidatos a importação,
 *   com suporte a detecção automática de plataforma por extensão de arquivo.
 * - `importRomFolder`: executa o scan, faz matching com o índice LaunchBox,
 *   baixa imagens e persiste os jogos no banco SQLite.
 *
 * Modos de detecção de plataforma:
 * - `manual`: o usuário informa a plataforma; extensões permitidas vêm do banco.
 * - `automatic`: a plataforma é inferida pela extensão do arquivo ROM, usando
 *   mapeamentos primários cadastrados. Extensões genéricas (zip, iso, etc.) são ignoradas.
 */

import fs from "node:fs";
import path from "node:path";
import { getImagesDir } from "./db/database";
import { ALL_SUPPORTED_ROM_EXTENSIONS } from "./db/platformCatalog";
import { createGame, findGameByLaunchBoxId, upsertLaunchBoxGame } from "./db/repositories/games";
import { listEmulators } from "./db/repositories/emulators";
import { getLaunchBoxAliasesForPlatformId, getPrimaryRomExtensionsForPlatform, listPlatforms, listPrimaryRomExtensionMappings } from "./db/repositories/platforms";
import { buildIndex, ensureMetadata } from "./lib/launchbox/db";
import { downloadImages } from "./lib/launchbox/scraper";
import {
  GameCreateInput,
  LaunchBoxGame,
  LaunchBoxImageType,
  RomFolderImportCandidate,
  RomFolderImportProgress,
  RomFolderImportRequest,
  RomFolderImportResult,
  RomFolderIgnoredItem,
  RomFolderMatchedCandidate,
  RomFolderScanRequest,
  RomFolderScanResult
} from "../shared/types";

type ProgressCallback = (progress: RomFolderImportProgress) => void;

/**
 * Entrada de arquivo encontrado durante o scan de uma pasta.
 * O título pode vir do perfil TeknoParrot quando o nome técnico do XML não é legível.
 */
type ScanEntry = { folderPath: string; romPath: string; filename: string; titleCandidate?: string };

/** Referência leve a uma plataforma (ID + nome) para uso no scan. */
interface PlatformRef {
  platformId: number;
  platformName: string;
}

/** Estrutura do detector automático de plataforma por extensão de arquivo. */
interface AutomaticPlatformDetector {
  /** Mapa de extensão normalizada → lista de plataformas que usam essa extensão. */
  byExtension: Map<string, PlatformRef[]>;
}

/** Entrada do índice de matching com chaves de busca pré-computadas. */
interface MatchEntry {
  game: LaunchBoxGame;
  /** Nome normalizado (sem acentos, lowercase, sem artigos). */
  normalizedName: string;
  /** Variações de chave para matching (ex.: sem prefixo "Disney's"). */
  matchKeys: string[];
}

/** Contexto de matching para uma plataforma específica. */
interface MatchContext {
  /** Todos os jogos do índice que pertencem à plataforma (com seus aliases). */
  platformMatches: MatchEntry[];
  /** Lookup rápido por nome exato normalizado → lista de MatchEntry. */
  exactByName: Map<string, MatchEntry[]>;
  /** Índice invertido de tokens (palavra → entradas que a contêm em matchKeys),
   * usado para pré-filtrar candidatos do scorling e evitar O(candidatos × jogos). */
  byToken: Map<string, MatchEntry[]>;
}

/** Lista de extensões de ROM suportadas pelo GameStock (importada do catálogo de plataformas). */
export const SUPPORTED_ROM_EXTENSIONS = ALL_SUPPORTED_ROM_EXTENSIONS;

/** Label exibido quando a plataforma é determinada automaticamente. */
const AUTOMATIC_PLATFORM_NAME = "Detecção automática";

/**
 * Extensões genéricas que não permitem identificar a plataforma com segurança.
 * Arquivos com estas extensões são ignorados no modo de detecção automática.
 */
const AUTO_DETECT_GENERIC_ROM_EXTENSIONS = new Set([
  ".7z",
  ".zip",
  ".rar",
  ".tar",
  ".gz",
  ".bz2",
  ".xz",
  ".bin",
  ".iso",
  ".img",
  ".cue",
  ".ccd",
  ".sub",
  ".mdf",
  ".mds",
  ".nrg",
  ".chd",
  ".rom",
  ".dat",
  ".pak",
  ".wad"
]);

/** Tipos de imagem baixados por padrão durante a importação de ROMs em lote. */
const DEFAULT_MEDIA_TYPES: LaunchBoxImageType[] = [
  "Box - Back",
  "Box - Front",
  "Cart - Front",
  "Fanart - Background",
  "Screenshot - Gameplay"
];

/**
 * Varre pastas e arquivos ROM individuais, classificando cada arquivo como
 * candidato à importação ou item ignorado.
 *
 * Em modo manual, filtra pelas extensões configuradas para a plataforma.
 * Em modo automático, infere a plataforma pela extensão do arquivo.
 *
 * @param request - Pastas e/ou arquivos a varrer, plataforma (opcional) e opções.
 * @returns Resultado do scan com candidatos, itens ignorados e plataformas detectadas.
 */
export function scanRomFolder(request: RomFolderScanRequest): RomFolderScanResult {
  // Modo automático quando nenhuma plataforma for informada ou detectionMode for "automatic"
  const detectionMode = request.detectionMode === "automatic" || !request.platformId ? "automatic" : "manual";
  const folderPaths = request.folderPaths.map((folderPath) => path.resolve(folderPath));
  const romFilePaths = (request.romFilePaths ?? []).map((filePath) => path.resolve(filePath));
  const includeSubfolders = Boolean(request.includeSubfolders);
  const ignoredItems: RomFolderIgnoredItem[] = [];

  if (detectionMode === "manual") {
    const platform = requirePlatform(request.platformId ?? 0);
    // Perfis TeknoParrot não são XMLs genéricos dentro de cada jogo: ficam em
    // UserProfiles e referenciam o executável real por GamePath. Esse caminho
    // evita importar configurações Linux/engine encontradas recursivamente.
    const entries = platform.name === "TeknoParrot"
      ? listTeknoParrotProfileEntries(folderPaths, romFilePaths, ignoredItems)
      : [
        ...folderPaths.flatMap((folderPath) => listFolderEntries(folderPath, includeSubfolders)),
        ...romFilePaths.map((romPath) => ({
          folderPath: path.dirname(romPath),
          romPath,
          filename: path.basename(romPath)
        }))
      ];
    const allowedExtensions = getAllowedRomExtensions(platform.id);
    const candidates = entries.flatMap((entry): RomFolderImportCandidate[] => {
      const ext = path.extname(entry.filename).toLowerCase();
      if (!allowedExtensions.has(ext)) {
        // Extensão não configurada para esta plataforma; registra como ignorado
        ignoredItems.push({
          folderPath: entry.folderPath,
          romPath: entry.romPath,
          filename: entry.filename,
          reason: buildUnsupportedExtensionReason(ext, platform.name)
        });
        return [];
      }

      return [buildCandidate(entry, { platformId: platform.id, platformName: platform.name })];
    });

    return {
      folderPaths,
      romFilePaths,
      platformId: platform.id,
      platformName: platform.name,
      detectionMode,
      detectedPlatforms: buildDetectedPlatforms(candidates),
      includeSubfolders,
      candidates,
      ignored: ignoredItems.length,
      ignoredItems
    };
  }

  // Combina entradas de pastas e arquivos individuais em uma lista única para
  // detecção automática, que não possui tratamento específico por plataforma.
  const entries: ScanEntry[] = [
    ...folderPaths.flatMap((folderPath) => listFolderEntries(folderPath, includeSubfolders)),
    ...romFilePaths.map((romPath) => ({
      folderPath: path.dirname(romPath),
      romPath,
      filename: path.basename(romPath)
    }))
  ];

  // Modo automático: cria detector por extensão e classifica cada arquivo
  const detector = createAutomaticPlatformDetector();
  const candidates = entries.flatMap((entry): RomFolderImportCandidate[] => {
    const ext = path.extname(entry.filename).toLowerCase();
    const detection = detectPlatformForExtension(ext, detector);
    if (!detection.platform) {
      ignoredItems.push({
        folderPath: entry.folderPath,
        romPath: entry.romPath,
        filename: entry.filename,
        reason: detection.reason
      });
      return [];
    }

    return [buildCandidate(entry, detection.platform)];
  });

  return {
    folderPaths,
    romFilePaths,
    platformId: null, // Sem plataforma única no modo automático
    platformName: AUTOMATIC_PLATFORM_NAME,
    detectionMode,
    detectedPlatforms: buildDetectedPlatforms(candidates),
    includeSubfolders,
    candidates,
    ignored: ignoredItems.length,
    ignoredItems
  };
}

/**
 * Importa ROMs de pastas para o banco do GameStock.
 *
 * Para cada candidato encontrado no scan:
 * 1. Garante que os metadados LaunchBox estejam disponíveis.
 * 2. Tenta fazer matching com o índice LaunchBox.
 * 3. Baixa imagens do jogo matchado (ou cria placeholder sem imagens).
 * 4. Persiste o jogo no banco via upsert.
 *
 * @param request - Parâmetros do scan e importação.
 * @param onProgress - Callback de progresso chamado por candidato processado.
 */
export async function importRomFolder(
  request: RomFolderImportRequest,
  onProgress?: ProgressCallback,
  precomputedScan?: RomFolderScanResult
): Promise<RomFolderImportResult> {
  // O main pode fornecer scan vindo do worker e evitar segunda varredura síncrona.
  const scan = precomputedScan ?? scanRomFolder(request);
  const total = scan.candidates.length;
  const items: RomFolderImportResult["items"] = [];
  const summary: RomFolderImportResult["summary"] = { created: 0, updated: 0, skipped: scan.ignored, unmatched: 0, failedDownloads: 0, processed: 0 };

  onProgress?.({ current: 0, total, stage: "preparing_metadata", message: "Preparando metadados LaunchBox" });

  // Garante que o Metadata.xml esteja baixado antes de iniciar o matching
  await ensureMetadata(false, (progress) => {
    onProgress?.({ current: progress.current, total: progress.total, filename: progress.filename, stage: progress.status === "error" ? "error" : "preparing_metadata" });
  });

  const launchBoxIndex = await buildIndex();

  // Cache de contextos de matching por plataforma (evita recriar para cada ROM)
  const matchContexts = new Map<number, MatchContext>();
  const getMatchContext = (platformId: number): MatchContext => {
    const cached = matchContexts.get(platformId);
    if (cached) return cached;
    const next = createMatchContext(platformId, launchBoxIndex);
    matchContexts.set(platformId, next);
    return next;
  };

  for (let index = 0; index < scan.candidates.length; index += 1) {
    const candidate = scan.candidates[index];
    const current = index + 1;

    try {
      onProgress?.({ current, total, folderPath: candidate.folderPath, filename: candidate.filename, stage: "matching", message: `Buscando ${candidate.titleCandidate}` });

      const matched = matchCandidate(candidate, launchBoxIndex, getMatchContext(candidate.platformId));

      if (matched.status !== "matched" || !matched.match) {
        // Sem match confiável: cria placeholder no banco para não perder a ROM
        const placeholder = upsertUnmatchedGame(candidate);
        summary.unmatched += 1;
        if (placeholder.created) summary.created += 1;
        else summary.updated += 1;
        summary.processed += 1;
        items.push({ candidate, status: "unmatched", gameId: placeholder.game.id });
        onProgress?.({ current, total, folderPath: candidate.folderPath, filename: candidate.filename, stage: "skipped", message: "Sem match confiavel no LaunchBox" });
        continue;
      }

      // Match encontrado: baixa imagens antes de salvar
      const download = await downloadImages(matched.match, getImagesDir(), DEFAULT_MEDIA_TYPES, (progress) => {
        onProgress?.({
          current,
          total,
          folderPath: candidate.folderPath,
          filename: candidate.filename,
          imageFilename: progress.filename,
          stage: progress.status === "error" ? "error" : progress.status === "skipped" ? "skipped" : "downloading",
          message: progress.filename
        });
      });

      onProgress?.({ current, total, folderPath: candidate.folderPath, filename: candidate.filename, stage: "saving", message: matched.match.name });
      const saved = upsertMatchedGame(matched.match, candidate, download.files);
      if (saved.created) summary.created += 1;
      else summary.updated += 1;
      summary.failedDownloads += download.failed;
      summary.processed += 1;

      items.push({
        candidate,
        status: saved.created ? "created" : "updated",
        gameId: saved.game.id,
        launchboxGameId: matched.match.id,
        failedDownloads: download.failed
      });
      onProgress?.({ current, total, folderPath: candidate.folderPath, filename: candidate.filename, stage: "done", message: matched.match.name });
    } catch (error) {
      // Erro inesperado por candidato; continua para o próximo sem abortar o job
      summary.processed += 1;
      items.push({ candidate, status: "failed", error: error instanceof Error ? error.message : String(error) });
      onProgress?.({ current, total, folderPath: candidate.folderPath, filename: candidate.filename, stage: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    folderPaths: scan.folderPaths,
    romFilePaths: scan.romFilePaths,
    platformId: scan.platformId,
    platformName: scan.platformName,
    detectionMode: scan.detectionMode,
    detectedPlatforms: scan.detectedPlatforms,
    includeSubfolders: scan.includeSubfolders,
    items,
    summary
  };
}

/**
 * Lista recursivamente os arquivos de uma pasta.
 * Inclui subpastas apenas se `includeSubfolders` for `true`.
 */
function listFolderEntries(folderPath: string, includeSubfolders: boolean): Array<{ folderPath: string; romPath: string; filename: string }> {
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  const files: Array<{ folderPath: string; romPath: string; filename: string }> = [];

  for (const entry of entries) {
    const entryPath = path.join(folderPath, entry.name);
    if (entry.isDirectory()) {
      if (includeSubfolders) files.push(...listFolderEntries(entryPath, true));
      continue;
    }
    if (!entry.isFile()) continue;
    files.push({
      folderPath,
      romPath: entryPath,
      filename: entry.name
    });
  }

  return files;
}

/** Dados relevantes extraídos de um perfil XML do TeknoParrot. */
interface TeknoParrotProfile {
  /** Caminho absoluto do perfil XML usado para lançar o jogo. */
  profilePath: string;
  /** Executável ou diretório do jogo configurado no campo GamePath. */
  gamePath: string;
  /** Título salvo no perfil, preferível ao nome técnico do arquivo XML. */
  title: string;
}

/** Nome da pasta que armazena perfis configurados pelo usuário no TeknoParrot. */
const TEKNO_PARROT_USER_PROFILES_DIR = "UserProfiles";

/**
 * Localiza perfis TeknoParrot associados às pastas de jogos selecionadas.
 * Também aceita perfis XML escolhidos diretamente, desde que tenham a estrutura
 * GameProfile. Isso torna a importação independente de XMLs de configuração
 * internos existentes dentro de dumps de jogos arcade.
 */
function listTeknoParrotProfileEntries(
  folderPaths: string[],
  romFilePaths: string[],
  ignoredItems: RomFolderIgnoredItem[]
): ScanEntry[] {
  const profilePaths = new Set<string>();

  // XML escolhido explicitamente continua sendo um fluxo válido para importar
  // apenas alguns jogos, sem precisar selecionar a pasta inteira de ROMs.
  for (const filePath of romFilePaths) {
    if (path.extname(filePath).toLowerCase() === ".xml") profilePaths.add(filePath);
  }

  const configuredProfilesDir = getTeknoParrotUserProfilesDir();
  if (configuredProfilesDir) {
    for (const profilePath of listXmlFiles(configuredProfilesDir)) {
      const profile = readTeknoParrotProfile(profilePath);
      if (profile && folderPaths.some((folderPath) => isPathInside(profile.gamePath, folderPath))) {
        profilePaths.add(profilePath);
      }
    }
  }

  // Quando o usuário seleciona diretamente UserProfiles, usa seus perfis mesmo
  // se GamePath estiver vazio ou fora da pasta de ROMs atualmente selecionada.
  for (const folderPath of folderPaths) {
    if (path.basename(folderPath).toLowerCase() !== TEKNO_PARROT_USER_PROFILES_DIR.toLowerCase()) continue;
    for (const profilePath of listXmlFiles(folderPath)) profilePaths.add(profilePath);
  }

  const entries: ScanEntry[] = [];
  for (const profilePath of profilePaths) {
    const profile = readTeknoParrotProfile(profilePath);
    if (!profile) {
      ignoredItems.push({
        folderPath: path.dirname(profilePath),
        romPath: profilePath,
        filename: path.basename(profilePath),
        reason: "XML não é um perfil GameProfile do TeknoParrot"
      });
      continue;
    }
    entries.push({
      folderPath: path.dirname(profile.profilePath),
      romPath: profile.profilePath,
      filename: path.basename(profile.profilePath),
      titleCandidate: profile.title
    });
  }

  if (!entries.length && !ignoredItems.length) {
    for (const folderPath of folderPaths) {
      ignoredItems.push({
        folderPath,
        romPath: folderPath,
        filename: path.basename(folderPath),
        reason: "Nenhum perfil TeknoParrot correspondente foi encontrado em UserProfiles"
      });
    }
  }

  return entries;
}

/** Retorna a pasta UserProfiles ao lado do executável TeknoParrot configurado. */
function getTeknoParrotUserProfilesDir(): string | null {
  const emulator = listEmulators().find((item) => item.name.trim().toLowerCase() === "teknoparrot");
  if (!emulator?.executable.trim()) return null;

  const profilesDir = path.join(path.dirname(path.resolve(emulator.executable)), TEKNO_PARROT_USER_PROFILES_DIR);
  return fs.existsSync(profilesDir) ? profilesDir : null;
}

/** Lista somente XMLs no diretório de perfis; TeknoParrot não recorre UserProfiles. */
function listXmlFiles(folderPath: string): string[] {
  try {
    return fs.readdirSync(folderPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".xml")
      .map((entry) => path.join(folderPath, entry.name));
  } catch {
    return [];
  }
}

/**
 * Lê um perfil XML de forma tolerante, confirmando a raiz GameProfile e os
 * campos que o TeknoParrot usa para identificar e abrir o jogo.
 */
function readTeknoParrotProfile(profilePath: string): TeknoParrotProfile | null {
  let xml: string;
  try {
    // Perfis válidos são pequenos; limitar a leitura protege o scan de XMLs grandes.
    const stats = fs.statSync(profilePath);
    if (stats.size > 1024 * 1024) return null;
    xml = fs.readFileSync(profilePath, "utf8");
  } catch {
    return null;
  }

  if (!/<GameProfile(?:\s|>)/i.test(xml)) return null;
  const gamePath = readTeknoParrotXmlValue(xml, "GamePath");
  const title = readTeknoParrotXmlValue(xml, "GameNameInternal")
    || readTeknoParrotXmlValue(xml, "ProfileName")
    || path.basename(profilePath, path.extname(profilePath));
  return { profilePath, gamePath: gamePath ? path.resolve(gamePath) : "", title };
}

/** Extrai e decodifica o conteúdo simples de uma tag XML de perfil. */
function readTeknoParrotXmlValue(xml: string, tagName: string): string {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i"));
  return match?.[1]
    ?.trim()
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/i, "$1")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;/gi, "'")
    ?? "";
}

/** Verifica se o caminho configurado no perfil pertence a uma das pastas selecionadas. */
function isPathInside(targetPath: string, folderPath: string): boolean {
  if (!targetPath) return false;
  const relative = path.relative(path.resolve(folderPath), path.resolve(targetPath));
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

/** Constrói um `RomFolderImportCandidate` a partir de uma entrada de scan e referência de plataforma. */
function buildCandidate(entry: ScanEntry, platform: PlatformRef): RomFolderImportCandidate {
  return {
    folderPath: entry.folderPath,
    romPath: entry.romPath,
    filename: entry.filename,
    // Título candidato: nome do arquivo sem extensão e sem tags de região/revisão
    titleCandidate: entry.titleCandidate || normalizeRomTitle(entry.filename),
    platformId: platform.platformId,
    platformName: platform.platformName
  };
}

/**
 * Constrói a lista de plataformas detectadas com contagem de candidatos por plataforma,
 * ordenada pelo nome da plataforma.
 */
function buildDetectedPlatforms(candidates: RomFolderImportCandidate[]): RomFolderScanResult["detectedPlatforms"] {
  const counts = new Map<number, { platformName: string; count: number }>();
  for (const candidate of candidates) {
    const current = counts.get(candidate.platformId) ?? { platformName: candidate.platformName, count: 0 };
    current.count += 1;
    counts.set(candidate.platformId, current);
  }

  return [...counts.entries()]
    .map(([platformId, entry]) => ({ platformId, platformName: entry.platformName, count: entry.count }))
    .sort((a, b) => a.platformName.localeCompare(b.platformName, "pt-BR", { sensitivity: "base" }));
}

/**
 * Cria o detector automático de plataforma por extensão de arquivo,
 * populado a partir dos mapeamentos primários cadastrados no banco.
 *
 * Extensões mapeadas para múltiplas plataformas ficam marcadas como ambíguas
 * (não serão usadas para detecção automática).
 */
function createAutomaticPlatformDetector(): AutomaticPlatformDetector {
  const byExtension = new Map<string, PlatformRef[]>();

  for (const mapping of listPrimaryRomExtensionMappings()) {
    const extension = normalizeExtension(mapping.extension);
    if (!extension) continue;
    const platformName = mapping.platform_name;
    if (!platformName) continue;
    const platforms = byExtension.get(extension) ?? [];
    // Evita duplicar a mesma plataforma para a mesma extensão
    if (!platforms.some((platform) => platform.platformId === mapping.platform_id)) {
      platforms.push({ platformId: mapping.platform_id, platformName });
    }
    byExtension.set(extension, platforms);
  }

  return { byExtension };
}

/**
 * Tenta detectar a plataforma de um arquivo a partir de sua extensão.
 *
 * Retorna `null` (com motivo) se:
 * - O arquivo não tiver extensão.
 * - A extensão for genérica (zip, iso, etc.).
 * - A extensão pertencer a múltiplas plataformas (ambígua).
 */
function detectPlatformForExtension(ext: string, detector: AutomaticPlatformDetector): { platform: PlatformRef | null; reason: string } {
  const extension = normalizeExtension(ext);
  if (!extension) return { platform: null, reason: "Arquivo sem extensão para detecção automática" };
  if (AUTO_DETECT_GENERIC_ROM_EXTENSIONS.has(extension)) {
    return { platform: null, reason: `Extensão ${extension} é genérica e não entra na detecção automática` };
  }

  const platforms = detector.byExtension.get(extension) ?? [];
  if (!platforms.length) return { platform: null, reason: `Extensão ${extension} não cadastrada para detecção automática` };
  if (platforms.length === 1) return { platform: platforms[0], reason: "" };

  // Extensão ambígua: lista as primeiras 4 plataformas no motivo para orientar o usuário
  const names = platforms.map((platform) => platform.platformName);
  const suffix = names.length > 4 ? `, +${names.length - 4}` : "";
  return {
    platform: null,
    reason: `Extensão ${extension} pertence a várias plataformas: ${names.slice(0, 4).join(", ")}${suffix}`
  };
}

/**
 * Tenta fazer matching de um candidato com o índice LaunchBox.
 *
 * Estratégia em ordem de prioridade:
 * 1. Correspondência exata de nome normalizado (única → matched, múltipla → ambiguous).
 * 2. Score de similaridade por tokens: requer >= 0.72 para ser considerado válido.
 * 3. Empate no score → ambiguous.
 *
 * @param candidate - Candidato a ser matchado.
 * @param index - Índice completo de jogos LaunchBox.
 * @param context - Contexto pré-filtrado pela plataforma (criado uma vez por plataforma).
 */
export function matchCandidate(candidate: RomFolderImportCandidate, index: Record<string, LaunchBoxGame>, context = createMatchContext(candidate.platformId, index)): RomFolderMatchedCandidate {
  const query = candidate.titleCandidate;
  const normalizedQuery = normalizeForMatch(query);
  const exact = context.exactByName.get(normalizedQuery) ?? [];

  // Correspondência exata única
  if (exact.length === 1) return { ...candidate, status: "matched", match: exact[0].game, alternatives: [exact[0].game] };
  // Correspondência exata múltipla (ambígua)
  if (exact.length > 1) return { ...candidate, status: "ambiguous", match: null, alternatives: exact.map((entry) => entry.game) };

  // Matching por score de similaridade
  const ranked = scoreCandidates(normalizedQuery, context)
    .filter((item) => item.score >= 0.72) // Threshold de confiança mínima
    .sort((a, b) => b.score - a.score || a.game.name.localeCompare(b.game.name));

  if (!ranked.length) return { ...candidate, status: "unmatched", match: null, alternatives: context.platformMatches.slice(0, 5).map((entry) => entry.game) };

  // Empate no melhor score: não é possível escolher com confiança
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) {
    return { ...candidate, status: "ambiguous", match: null, alternatives: ranked.slice(0, 5).map((item) => item.game) };
  }
  return { ...candidate, status: "matched", match: ranked[0].game, alternatives: ranked.slice(0, 5).map((item) => item.game) };
}

/**
 * Cria o contexto de matching para uma plataforma específica:
 * filtra o índice completo pelos aliases da plataforma e pré-computa
 * as chaves de matching para cada jogo.
 */
function createMatchContext(platformId: number, index: Record<string, LaunchBoxGame>): MatchContext {
  const platformAliases = getLaunchBoxAliasesForPlatformId(platformId);
  const platformMatches = Object.values(index)
    .filter((game) => isPlatformMatch(game.platform, platformAliases))
    .map((game) => {
      const normalizedName = normalizeForMatch(game.name);
      return { game, normalizedName, matchKeys: buildMatchKeys(normalizedName) };
    });

  // Índice de lookup por chave exata para matching O(1)
  const exactByName = new Map<string, MatchEntry[]>();
  // Índice invertido de tokens para pré-filtrar o scoring de similaridade.
  // Sem isso, cada candidato varreria todos os jogos da plataforma (O(n×m)).
  const byToken = new Map<string, MatchEntry[]>();

  const indexEntry = (map: Map<string, MatchEntry[]>, key: string, entry: MatchEntry): void => {
    const existing = map.get(key) ?? [];
    existing.push(entry);
    map.set(key, existing);
  };

  for (const entry of platformMatches) {
    for (const key of entry.matchKeys) {
      indexEntry(exactByName, key, entry);
      for (const token of key.split(" ")) {
        if (token) indexEntry(byToken, token, entry);
      }
    }
  }

  return { platformMatches, exactByName, byToken };
}

/**
 * Pontua apenas candidatos com pelo menos um token em comum com a query
 * (via índice invertido), evitando varrer a plataforma inteira por ROM.
 * Caso contrário, a importação de uma pasta grande congela o main process.
 */
function scoreCandidates(query: string, context: MatchContext): Array<{ game: LaunchBoxGame; score: number }> {
  const queryTokens = query.split(" ").filter(Boolean);
  if (!queryTokens.length) return [];

  const candidates = new Map<MatchEntry, number>();
  for (const token of queryTokens) {
    const entries = context.byToken.get(token);
    if (!entries) continue;
    for (const entry of entries) {
      candidates.set(entry, (candidates.get(entry) ?? 0) + 1);
    }
  }

  // Query com poucos tokens é frágil: sem nenhum token comum, não há o que pontuar.
  if (!candidates.size) return [];

  const results: Array<{ game: LaunchBoxGame; score: number }> = [];
  for (const [entry] of candidates) {
    const score = scoreEntry(query, entry);
    if (score > 0) results.push({ game: entry.game, score });
  }
  return results;
}

/**
 * Normaliza o título de uma ROM para uso como candidato de matching.
 *
 * Remove:
 * - Extensão do arquivo
 * - Underscores, pontos e sinais como separadores
 * - Tags de região em colchetes: [E], [!], etc.
 * - Tags de região/revisão em parênteses conhecidas: (USA), (Europe), (Rev 1), etc.
 * - Demais parênteses (sem conteúdo reconhecido)
 * - Sufixos de revisão/versão
 */
export function normalizeRomTitle(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  return withoutExt
    .replace(/[_+.]+/g, " ")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*(?:USA|Europe|Japan|World|En|Fr|De|Es|It|Rev|Beta|Proto|Demo|Hack|Unl|v\d|[0-9]{4})[^)]*\)/gi, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:rev|version|v)\s*\d+\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cria ou atualiza um jogo no banco com dados do LaunchBox e arquivos de mídia baixados.
 * Usa upsert por `launchbox_id`, `rom_path` e título.
 * Quando o `launchbox_id` já pertence a outra ROM da mesma plataforma,
 * trata o item atual como outra versão local e evita reutilizar o mesmo ID.
 */
function upsertMatchedGame(game: LaunchBoxGame, candidate: RomFolderImportCandidate, files: string[]) {
  // Se outra ROM da mesma plataforma já usa este LaunchBox ID, o item atual vira
  // outra versão local. Assim preservamos o vínculo existente e evitamos sobrescrever
  // o `rom_path` da variante já cadastrada.
  const linkedGame = findGameByLaunchBoxId(game.id, candidate.platformId);
  const duplicateBelongsToAnotherRom = Boolean(
    linkedGame
    && linkedGame.rom_path
    && path.resolve(linkedGame.rom_path) !== path.resolve(candidate.romPath)
  );

  const data: Partial<GameCreateInput> & { title: string; platform_id: number } = {
    title: game.name,
    platform_id: candidate.platformId,
    publisher: game.publisher || null,
    year: game.release ? Number(game.release.slice(0, 4)) || null : null,
    genre: game.genres || null,
    rating: game.rating || null,
    notes: game.overview || null,
    box_art_path: findDownloadedMedia(files, "box-front"),
    background_path: findDownloadedMedia(files, "fanart-background"),
    screenshot_path: findDownloadedMedia(files, "screenshot-gameplay"),
    launchbox_id: duplicateBelongsToAnotherRom ? null : game.id,
    rom_path: candidate.romPath,
    favorite: false,
    play_status: "unplayed"
  };
  return upsertLaunchBoxGame(data);
}

/**
 * Cria ou atualiza um jogo placeholder no banco para ROMs sem match no LaunchBox.
 * Tenta upsert por título; em caso de título vazio, cria com o nome do arquivo.
 */
function upsertUnmatchedGame(candidate: RomFolderImportCandidate) {
  const data: Partial<GameCreateInput> & { title: string; platform_id: number } = {
    title: candidate.titleCandidate,
    platform_id: candidate.platformId,
    publisher: null,
    year: null,
    genre: null,
    rating: null,
    notes: null,
    box_art_path: null,
    background_path: null,
    screenshot_path: null,
    launchbox_id: null,
    rom_path: candidate.romPath,
    favorite: false,
    play_status: "unplayed"
  };

  try {
    return upsertLaunchBoxGame(data);
  } catch (error) {
    // Título normalizado pode resultar em string vazia; usa nome do arquivo como fallback
    if (!(error instanceof Error) || !error.message.includes("Título é obrigatório")) throw error;
    return {
      game: createGame({
        ...data,
        title: candidate.filename,
        notes: "Importado sem match no LaunchBox"
      }),
      created: true
    };
  }
}

/**
 * Ordem de preferência de região para seleção do box-front principal.
 * Brasil tem prioridade para localização.
 */
const BOX_FRONT_REGION_PRIORITY = ["brazil", "north-america", "europe"];

/**
 * Encontra o arquivo de mídia mais adequado para um tipo dado (marker)
 * na lista de arquivos baixados.
 *
 * Para "box-front", aplica prioridade de região e verifica cover.jpg gerado pelo scraper.
 */
function findDownloadedMedia(files: string[], marker: string): string | null {
  if (marker === "box-front") {
    // Prioriza cover.jpg gerado pelo scraper (já redimensionado)
    const cover = files.find((file) => path.basename(file).toLowerCase() === "cover.jpg");
    if (cover) return cover;

    // Fallback por prioridade de região
    for (const region of BOX_FRONT_REGION_PRIORITY) {
      const match = files.find((file) => file.includes(`box-front-${region}`));
      if (match) return match;
    }
    return files.find((file) => file.includes("box-front")) ?? null;
  }
  return files.find((file) => file.includes(marker)) ?? null;
}

/**
 * Retorna o conjunto de extensões permitidas para uma plataforma.
 * Usa as extensões configuradas no banco; fallback para todas as extensões suportadas.
 */
function getAllowedRomExtensions(platformId: number): Set<string> {
  const configured = getPrimaryRomExtensionsForPlatform(platformId);
  return new Set((configured.length ? configured : SUPPORTED_ROM_EXTENSIONS).map((extension) => extension.toLowerCase()));
}

/** Normaliza uma extensão de arquivo para lowercase com ponto inicial (ex.: ".nes"). */
function normalizeExtension(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

/** Constrói a mensagem de motivo para um arquivo ignorado por extensão não suportada. */
function buildUnsupportedExtensionReason(ext: string, platformName: string): string {
  if (!ext) return `Arquivo sem extensão suportada para ${platformName}`;
  return `Extensão ${ext} não configurada para ${platformName}`;
}

/**
 * Verifica se o nome de plataforma de um jogo LaunchBox corresponde a algum
 * dos aliases registrados para a plataforma local.
 *
 * Aceita correspondência por substring quando o alias tem mais de 4 caracteres,
 * para lidar com variações de nome (ex.: "Super Nintendo" vs "SNES").
 */
function isPlatformMatch(gamePlatform: string, aliases: string[]): boolean {
  const gameName = normalizePlatformName(gamePlatform);
  return aliases.some((alias) => {
    const aliasName = normalizePlatformName(alias);
    if (gameName === aliasName) return true;
    return aliasName.length > 4 && gameName.includes(aliasName);
  });
}

/**
 * Normaliza o nome de uma plataforma para comparação:
 * lowercase, remove acentos, substitui não-alfanuméricos por espaço.
 */
function normalizePlatformName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Remove diacríticos (acentos)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normaliza um título de jogo para comparação no matching:
 * lowercase, remove acentos, converte "&" para "and", remove artigos "the"/"a".
 */
function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Remove diacríticos
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:the|a)\b/g, " ") // Remove artigos que variam entre versões
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Prefixos de título Disney opcionais que podem estar presentes ou ausentes
 * dependendo da versão do jogo ou da grafia usada pelo LaunchBox.
 */
const OPTIONAL_TITLE_PREFIXES = [
  "disney pixar s",
  "disney pixar",
  "disney s",
  "disneys",
  "disney"
];

/**
 * Gera as chaves de matching para um nome de jogo normalizado.
 * Adiciona variações sem prefixos opcionais (ex.: sem "Disney's").
 */
function buildMatchKeys(normalizedName: string): string[] {
  const keys = new Set([normalizedName]);
  for (const prefix of OPTIONAL_TITLE_PREFIXES) {
    if (!normalizedName.startsWith(`${prefix} `)) continue;
    const withoutPrefix = normalizedName.slice(prefix.length).trim();
    // Evita remover prefixo de títulos como "Disney's Aladdin" → "s Aladdin"
    if (withoutPrefix.startsWith("s ")) continue;
    keys.add(withoutPrefix);
  }
  return [...keys].filter(Boolean);
}

/**
 * Calcula o score de similaridade de um query contra uma entrada do índice,
 * retornando o maior score entre todas as chaves de matching da entrada.
 */
function scoreEntry(query: string, entry: MatchEntry): number {
  return Math.max(...entry.matchKeys.map((key) => scoreMatch(query, key)));
}

/**
 * Calcula a similaridade entre uma query e um título de jogo.
 *
 * Scores:
 * - 1.0: igualdade exata
 * - 0.86: um contém o outro (substring)
 * - 0.0–1.0: sobreposição de tokens / total de tokens únicos (Jaccard-like)
 */
function scoreMatch(query: string, title: string): number {
  if (!query || !title) return 0;
  if (title === query) return 1;
  if ((title.includes(query) || query.includes(title)) && canUseSubstringBoost(query, title)) return 0.86;

  const queryTokens = new Set(query.split(" "));
  const titleTokens = new Set(title.split(" "));
  const overlap = [...queryTokens].filter((token) => titleTokens.has(token)).length;
  return overlap / Math.max(queryTokens.size, titleTokens.size);
}

/**
 * Libera o boost de substring apenas quando a diferenca entre os titulos
 * e pequena. Isso evita match falso como "GP-1" capturando
 * "GP-1 RS Rapid Stream" so por conter o prefixo base.
 */
function canUseSubstringBoost(query: string, title: string): boolean {
  const queryTokens = query.split(" ").filter(Boolean);
  const titleTokens = title.split(" ").filter(Boolean);
  const tokenGap = Math.abs(queryTokens.length - titleTokens.length);
  const shorterLength = Math.min(query.length, title.length);
  const longerLength = Math.max(query.length, title.length);
  return tokenGap <= 1 || shorterLength / longerLength >= 0.75;
}

/** Retorna a plataforma pelo ID ou lança erro se não encontrada. */
function requirePlatform(platformId: number) {
  const platform = listPlatforms().find((item) => item.id === platformId);
  if (!platform) throw new Error("Plataforma não encontrada");
  return platform;
}
