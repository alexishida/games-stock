export function localMediaUrl(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  return `gamestock-media://image?path=${encodeURIComponent(filePath)}`;
}
