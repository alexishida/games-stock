/**
 * Hook reutilizável que adiciona comportamento de arrastar (drag) a modais/dialogs.
 *
 * Funcionalidades:
 * - Rastrea o deslocamento (offset) do modal em relação à posição centralizada inicial.
 * - Limita o deslocamento para que o modal não saia da área visível da janela.
 * - Usa Pointer Events para suportar mouse e touch de forma unificada.
 * - Ignora drag em elementos interativos (botões, inputs, selects, etc.) para preservar cliques.
 * - Recalcula o clamp ao redimensionar a janela.
 *
 * O offset é exposto como variáveis CSS `--dialog-x` e `--dialog-y` para ser aplicado
 * via `translate(var(--dialog-x), var(--dialog-y))` no CSS do modal.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from "react";

/** Seletor CSS padrão de elementos que não devem iniciar o drag ao serem clicados. */
const DEFAULT_INTERACTIVE_SELECTOR = "button, input, select, textarea, label, option, [role='button'], a";

/** Estado interno do drag ativo: guarda o pointerId e as coordenadas de origem. */
type DragState = {
  pointerId: number;
  /** Posição X do ponteiro no início do drag. */
  startX: number;
  /** Posição Y do ponteiro no início do drag. */
  startY: number;
  /** Offset X do dialog no momento em que o drag começou. */
  originX: number;
  /** Offset Y do dialog no momento em que o drag começou. */
  originY: number;
};

/** Opções de configuração do hook. */
type UseDraggableDialogOptions = {
  /** Seletor CSS de elementos que bloqueiam o início do drag. Padrão: controles interativos comuns. */
  interactiveSelector?: string;
  /** Margem mínima (em px) entre a borda do modal e a borda da janela. Padrão: 12. */
  margin?: number;
};

/** Resultado do hook: ref para o elemento, estilos CSS e handlers de pointer events. */
type DraggableDialogResult<T extends HTMLElement> = {
  /** Ref a ser atribuída ao elemento raiz do modal para leitura de dimensões. */
  dialogRef: RefObject<T | null>;
  /** Objeto de estilo com as variáveis CSS `--dialog-x` e `--dialog-y`. */
  style: CSSProperties;
  /** Handler para `onPointerDown`: inicia o drag. */
  startDialogDrag: (event: ReactPointerEvent<T>) => void;
  /** Handler para `onPointerMove`: move o dialog. */
  dragDialog: (event: ReactPointerEvent<T>) => void;
  /** Handler para `onPointerUp`/`onPointerCancel`: encerra o drag. */
  stopDialogDrag: (event: ReactPointerEvent<T>) => void;
};

/**
 * Adiciona comportamento de drag a um modal/dialog React.
 *
 * @param options - Opções de configuração (seletor interativo e margem de clamp).
 * @returns Handlers de pointer events, ref do elemento e estilos CSS com o offset atual.
 */
export function useDraggableDialog<T extends HTMLElement>({
  interactiveSelector = DEFAULT_INTERACTIVE_SELECTOR,
  margin = 12
}: UseDraggableDialogOptions = {}): DraggableDialogResult<T> {
  /** Offset atual do dialog em relação ao centro. */
  const [dialogOffset, setDialogOffset] = useState({ x: 0, y: 0 });
  /** Ref para o elemento DOM do modal, usada para calcular limites de clamp. */
  const dialogRef = useRef<T | null>(null);
  /** Estado do drag em andamento; null quando não há drag ativo. */
  const dragState = useRef<DragState | null>(null);

  /**
   * Limita o offset para que o modal não ultrapasse as bordas da janela,
   * respeitando a margem configurada.
   */
  function clampDialogOffset(x: number, y: number): { x: number; y: number } {
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return { x, y };

    // Máximo deslocamento permitido em cada eixo (metade do espaço disponível menos a margem)
    const maxX = Math.max(0, (window.innerWidth - rect.width) / 2 - margin);
    const maxY = Math.max(0, (window.innerHeight - rect.height) / 2 - margin);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y))
    };
  }

  // Recalcula o clamp quando a janela é redimensionada para evitar modal fora da tela
  useEffect(() => {
    function handleResize(): void {
      setDialogOffset((current) => clampDialogOffset(current.x, current.y));
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /**
   * Inicia o drag ao pressionar o ponteiro no modal.
   * Captura o ponteiro para receber eventos mesmo fora do elemento.
   * Ignora o início se o alvo for um elemento interativo.
   */
  function startDialogDrag(event: ReactPointerEvent<T>): void {
    event.stopPropagation();
    // Não inicia drag em elementos interativos (botões, inputs, etc.)
    if ((event.target as HTMLElement).closest(interactiveSelector)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: dialogOffset.x,
      originY: dialogOffset.y
    };
  }

  /**
   * Move o dialog conforme o ponteiro se desloca.
   * Ignora eventos de outros ponteiros (multi-touch).
   */
  function dragDialog(event: ReactPointerEvent<T>): void {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    setDialogOffset(clampDialogOffset(
      drag.originX + event.clientX - drag.startX,
      drag.originY + event.clientY - drag.startY
    ));
  }

  /**
   * Encerra o drag ao soltar o ponteiro e libera a captura.
   */
  function stopDialogDrag(event: ReactPointerEvent<T>): void {
    if (dragState.current?.pointerId !== event.pointerId) return;
    event.stopPropagation();
    dragState.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return {
    dialogRef,
    // Expõe o offset como variáveis CSS para uso via translate no CSS do modal
    style: { "--dialog-x": `${dialogOffset.x}px`, "--dialog-y": `${dialogOffset.y}px` } as CSSProperties,
    startDialogDrag,
    dragDialog,
    stopDialogDrag
  };
}
