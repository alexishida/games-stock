/**
 * Utilitários de data e hora para o renderer.
 * Funções simples para conversão e comparação de timestamps ISO.
 */

/**
 * Converte uma string de data/hora (ISO 8601 ou similar) em timestamp numérico (ms desde epoch).
 * Retorna 0 se o valor for undefined ou não representar uma data válida.
 * Útil para ordenar arrays de objetos com campo `startedAt` ou similar.
 *
 * @param value - String de data a converter. Pode ser undefined.
 * @returns Timestamp em milissegundos, ou 0 em caso de valor inválido.
 */
export function timestamp(value: string | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}
