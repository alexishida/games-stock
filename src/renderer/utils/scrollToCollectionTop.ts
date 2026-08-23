/**
 * scrollToCollectionTop.ts
 *
 * Centraliza o retorno ao topo das coleções paginadas, cujas visualizações
 * usam containers internos de rolagem em vez da janela principal.
 */

/** Seletores dos containers roláveis presentes nas visualizações de coleção. */
const COLLECTION_SCROLL_CONTAINERS = [
  ".game-grid-wrap",
  ".game-list-body",
  ".hw-inventory-grid-area",
  ".hw-grid-wrap",
  ".hw-list-body"
].join(", ");

/**
 * Move suavemente para o topo os containers de coleção atualmente renderizados.
 * A paginação fica abaixo do conteúdo; por isso o retorno ocorre no clique,
 * antes de os novos itens da página substituírem a lista atual.
 */
export function scrollToCollectionTop(): void {
  document.querySelectorAll<HTMLElement>(COLLECTION_SCROLL_CONTAINERS).forEach((container) => {
    container.scrollTo({ top: 0, behavior: "smooth" });
  });
}
