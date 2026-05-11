/**
 * Utilitários de mídia para o renderer.
 * Funções auxiliares para construir URLs de acesso a arquivos de imagem locais
 * via o protocolo customizado `gamestock-media://` registrado no Electron.
 */

/**
 * Converte um caminho de arquivo local em URL utilizável em elementos `<img>`.
 *
 * O Electron registra o protocolo `gamestock-media://` no main process para
 * servir arquivos de imagem do disco sem expor caminhos absolutos diretamente
 * no DOM, contornando restrições de segurança do Chromium para `file://`.
 *
 * @param filePath - Caminho absoluto do arquivo de imagem no disco. Aceita null/undefined.
 * @returns URL no formato `gamestock-media://image?path=<encoded>`, ou null se o caminho for vazio.
 */
export function localMediaUrl(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  return `gamestock-media://image?path=${encodeURIComponent(filePath)}`;
}
