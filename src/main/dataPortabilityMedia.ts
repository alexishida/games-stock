/**
 * Operações de mídia para backup portável.
 *
 * Isola enumeração e restauração de arquivos do fluxo transacional de backup.
 */

import fs from "node:fs";
import path from "node:path";

/** Extensões de imagem aceitas no pacote; impede incluir archives e caches auxiliares gigantes. */
const BACKUP_IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".heic",
  ".heif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".tif",
  ".tiff",
  ".webp"
]);

/** Entrada ZIP mínima consumida por rotinas de mídia. */
export interface BackupMediaZipEntry {
  entryName: string;
  isDirectory: boolean;
  getData(): Buffer;
}

/** Arquivo ZIP mínimo consumido por rotinas de mídia. */
export interface BackupMediaZipArchive {
  getEntries(): BackupMediaZipEntry[];
}

/** Arquivo de mídia pronto para inclusão no pacote ZIP. */
export interface ExportedMediaFile {
  packagePath: string;
  relativePath: string;
  sourcePath: string;
  size: number;
}

/**
 * Lista apenas imagens recursivamente, com ordem estável para backups reproduzíveis.
 * Arquivos como `.7z` e `metadata.json` não pertencem à categoria de imagens e
 * podem multiplicar tamanho e duração do pacote sem participar da restauração.
 */
export function listImageFilesForBackup(imagesDir: string): ExportedMediaFile[] {
  if (!fs.existsSync(imagesDir)) return [];
  const files: ExportedMediaFile[] = [];
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const sourcePath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(sourcePath);
      else if (entry.isFile() && BACKUP_IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        const relativePath = normalizeRelativePath(path.relative(imagesDir, sourcePath));
        if (relativePath) files.push({ packagePath: `media/${relativePath}`, relativePath, sourcePath, size: fs.statSync(sourcePath).size });
      }
    }
  };
  walk(imagesDir);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath, undefined, { sensitivity: "base" }));
}

/** Restaura entradas `media/`, registrando arquivos para rollback externo. */
export function restoreImagesTree(archive: BackupMediaZipArchive, imagesDir: string, copiedFiles: string[], onItem?: (message: string) => void): void {
  for (const entry of archive.getEntries()) {
    if (entry.isDirectory || !entry.entryName.startsWith("media/")) continue;
    const relativePath = normalizeRelativePath(entry.entryName.slice("media/".length));
    if (!relativePath) continue;
    const targetPath = resolvePathInside(imagesDir, relativePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, entry.getData());
    copiedFiles.push(targetPath);
    onItem?.(`Imagem restaurada: ${relativePath}`);
  }
}

/** Conta arquivos de mídia do arquivo ZIP. */
export function countMediaFilesInBackup(archive: BackupMediaZipArchive): number {
  return archive.getEntries().filter((entry) => !entry.isDirectory && entry.entryName.startsWith("media/")).length;
}

/** Normaliza caminho para lookup case-insensitive. */
export function normalizePathForLookup(value: string): string {
  return path.resolve(value).toLowerCase();
}

/** Rejeita traversal antes de devolver caminho relativo portável. */
function normalizeRelativePath(value: string): string | null {
  const normalized = path.posix.normalize(value.replace(/\\/g, "/")).replace(/^\/+/, "");
  return !normalized || normalized === "." || normalized.startsWith("../") ? null : normalized;
}

/** Garante que destino de extração pertence à raiz configurada. */
function resolvePathInside(root: string, relativePath: string): string {
  const target = path.resolve(root, relativePath);
  const relative = path.relative(path.resolve(root), target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Caminho de midia invalido no pacote: ${relativePath}`);
  return target;
}
