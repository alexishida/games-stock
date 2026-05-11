import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from "react";

const DEFAULT_INTERACTIVE_SELECTOR = "button, input, select, textarea, label, option, [role='button'], a";

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type UseDraggableDialogOptions = {
  interactiveSelector?: string;
  margin?: number;
};

type DraggableDialogResult<T extends HTMLElement> = {
  dialogRef: RefObject<T | null>;
  style: CSSProperties;
  startDialogDrag: (event: ReactPointerEvent<T>) => void;
  dragDialog: (event: ReactPointerEvent<T>) => void;
  stopDialogDrag: (event: ReactPointerEvent<T>) => void;
};

export function useDraggableDialog<T extends HTMLElement>({
  interactiveSelector = DEFAULT_INTERACTIVE_SELECTOR,
  margin = 12
}: UseDraggableDialogOptions = {}): DraggableDialogResult<T> {
  const [dialogOffset, setDialogOffset] = useState({ x: 0, y: 0 });
  const dialogRef = useRef<T | null>(null);
  const dragState = useRef<DragState | null>(null);

  function clampDialogOffset(x: number, y: number): { x: number; y: number } {
    const rect = dialogRef.current?.getBoundingClientRect();
    if (!rect) return { x, y };

    const maxX = Math.max(0, (window.innerWidth - rect.width) / 2 - margin);
    const maxY = Math.max(0, (window.innerHeight - rect.height) / 2 - margin);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y))
    };
  }

  useEffect(() => {
    function handleResize(): void {
      setDialogOffset((current) => clampDialogOffset(current.x, current.y));
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function startDialogDrag(event: ReactPointerEvent<T>): void {
    event.stopPropagation();
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

  function dragDialog(event: ReactPointerEvent<T>): void {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    setDialogOffset(clampDialogOffset(
      drag.originX + event.clientX - drag.startX,
      drag.originY + event.clientY - drag.startY
    ));
  }

  function stopDialogDrag(event: ReactPointerEvent<T>): void {
    if (dragState.current?.pointerId !== event.pointerId) return;
    event.stopPropagation();
    dragState.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return {
    dialogRef,
    style: { "--dialog-x": `${dialogOffset.x}px`, "--dialog-y": `${dialogOffset.y}px` } as CSSProperties,
    startDialogDrag,
    dragDialog,
    stopDialogDrag
  };
}
