import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { selectionRect } from '../../../components/MapScreenshot/selectionRect';
import type { CaptureRect } from '../../../components/MapScreenshot/selectionRect';
import type { Point } from '../../../types/map';

/** A drag shorter than this (px) on both axes is a slip, not a box. */
const MIN_BOX = 4;

export interface BoxSelectOverlayProps {
  /** Called with the dragged rectangle in viewport CSS pixels. */
  onSelect: (rect: CaptureRect) => void;
  /** Esc: leave the tool. */
  onExit: () => void;
}

/**
 * The rectangle select tool: covers the map while active, so a drag draws a
 * box instead of panning. The wheel still reaches the map, so the user can
 * zoom between boxes. The tool stays on after each box.
 */
export default function BoxSelectOverlay({ onSelect, onExit }: BoxSelectOverlayProps) {
  const drag = useRef<{ start: Point; pointerId: number } | null>(null);
  const [rect, setRect] = useState<CaptureRect | null>(null);

  useEffect(() => {
    const exit = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onExit(); }
    };
    window.addEventListener('keydown', exit);

    return () => window.removeEventListener('keydown', exit);
  }, [onExit]);

  const point = (event: PointerEvent<HTMLDivElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();

    return {
      x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
    };
  };

  return (
    <div
      className="box-select"
      aria-label="Area selection"
      onDoubleClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.button !== 0 || drag.current) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { start: point(event), pointerId: event.pointerId };
        setRect(selectionRect(drag.current.start, drag.current.start));
      }}
      onPointerMove={(event) => {
        event.stopPropagation();
        if (drag.current?.pointerId === event.pointerId) setRect(selectionRect(drag.current.start, point(event)));
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        if (drag.current?.pointerId !== event.pointerId) return;
        const box = selectionRect(drag.current.start, point(event));
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        setRect(null);
        if (box.width >= MIN_BOX || box.height >= MIN_BOX) onSelect(box);
      }}
      onPointerCancel={(event) => { event.stopPropagation(); drag.current = null; setRect(null); }}
      onLostPointerCapture={() => { drag.current = null; setRect(null); }}
    >
      {!rect && <span className="box-select__hint" role="status">Drag to select drillholes · Esc to exit</span>}
      {rect && <div className="box-select__rect" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }} />}
    </div>
  );
}
