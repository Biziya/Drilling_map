import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Point } from '../../types/map';

/** `event.button` value for the left mouse button. */
const PRIMARY_BUTTON = 0;

/** The in-flight drag: which pointer owns it and where it started. */
interface DragState {
  pointerId: number;
  /** Pointer position when the drag began, in client coordinates. */
  x: number;
  y: number;
  /** Value being dragged, as it was when the drag began. */
  origin: Point;
}

export interface PointerDragOptions {
  /**
   * Elements a drag must not start on, as a CSS selector. Markers and the
   * zoom controls sit on top of the map and handle their own clicks.
   */
  ignoreSelector: string;
  getOrigin: () => Point;
  onPan: (position: Point) => void;
}

export interface PointerDrag {
  isDragging: boolean;
  startDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  moveDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  stopDrag: (event: ReactPointerEvent<HTMLElement>) => void;
}

/** True when the event started on an element the drag should ignore. */
function isIgnoredTarget(target: EventTarget | null, selector: string): boolean {
  // `target` is typed as EventTarget, which has no `closest`. Narrowing to
  // Element rather than asserting keeps a non-element target (which the DOM
  // does allow) from throwing.
  return target instanceof Element && target.closest(selector) !== null;
}

/**
 * Drag-to-pan on a pointer-captured element.
 *
 * The pointer is captured on the element that started the drag, so a fast
 * drag that leaves the viewport keeps panning instead of stopping dead.
 */
export function usePointerDrag({
  ignoreSelector,
  getOrigin,
  onPan,
}: PointerDragOptions): PointerDrag {
  const dragRef = useRef<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const startDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== PRIMARY_BUTTON) return;
    if (isIgnoredTarget(event.target, ignoreSelector)) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      origin: getOrigin(),
    };
    setIsDragging(true);
  }, [getOrigin, ignoreSelector]);

  const moveDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    onPan({
      x: drag.origin.x + event.clientX - drag.x,
      y: drag.origin.y + event.clientY - drag.y,
    });
  }, [onPan]);

  const stopDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    // The browser releases implicitly on pointerup, but pointercancel and an
    // element unmounting mid-drag are less predictable. Releasing explicitly
    // means capture is never left dangling on the viewport.
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragRef.current = null;
    setIsDragging(false);
  }, []);

  return { isDragging, startDrag, moveDrag, stopDrag };
}
