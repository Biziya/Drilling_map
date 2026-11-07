import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, RefObject } from 'react';
import type { Point, Size } from '../../types/map';
import './MapScreenshot.css';

export interface CaptureRect extends Point, Size {}
export type ScreenshotFormat = 'png' | 'svg';

function selectionRect(a: Point, b: Point): CaptureRect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

interface Props {
  viewportRef: RefObject<HTMLDivElement | null>;
  onCancel: () => void;
  onCapture: (rect: CaptureRect, format: ScreenshotFormat) => void;
}

/** Isolated from the map tree's pointer handlers; coordinates are CSS pixels. */
export default function MapScreenshot({ viewportRef, onCancel, onCapture }: Props) {
  const drag = useRef<{ start: Point; pointerId: number } | null>(null);
  const [rect, setRect] = useState<CaptureRect | null>(null);
  const [selected, setSelected] = useState<CaptureRect | null>(null);
  const [format, setFormat] = useState<ScreenshotFormat>('png');
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const viewport = viewportRef.current;
    if (!selected || !dialog || !viewport) return;
    const bounds = viewport.getBoundingClientRect();
    dialog.style.left = `${bounds.left + bounds.width / 2}px`;
    dialog.style.top = `${bounds.top + bounds.height / 2}px`;
    // The native modal traps focus and makes the rest of the application inert.
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>('input:checked')?.focus();
    return () => dialog.close();
  }, [selected, viewportRef]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const blockWheel = (event: WheelEvent) => { event.preventDefault(); event.stopImmediatePropagation(); };
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
    };
    viewport?.addEventListener('wheel', blockWheel, { capture: true, passive: false });
    window.addEventListener('keydown', cancel);
    return () => {
      viewport?.removeEventListener('wheel', blockWheel, true);
      window.removeEventListener('keydown', cancel);
    };
  }, [viewportRef, onCancel]);

  const point = (event: PointerEvent<HTMLDivElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    // Keep fractional CSS pixels: clientWidth/clientHeight round layout sizes
    // and would shrink the crop on high-DPI or fractionally sized viewports.
    return {
      x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
    };
  };

  const visibleRect = selected ?? rect;
  return <div className={`map-screenshot${selected ? ' is-finalized' : ''}`} aria-label="Screenshot selection"
    onClick={(event) => event.stopPropagation()}
    onDoubleClick={(event) => event.stopPropagation()}
    onPointerDown={(event) => {
      event.stopPropagation();
      if (selected || event.button !== 0 || drag.current) return;
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
      const selected = selectionRect(drag.current.start, point(event));
      drag.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      setRect(null);
      if (selected.width >= 8 && selected.height >= 8) setSelected(selected);
    }}
    onPointerCancel={(event) => { event.stopPropagation(); onCancel(); }}
    onLostPointerCapture={() => { drag.current = null; setRect(null); }}
  >
    {!selected && <span className="map-screenshot__hint" role="status">Drag to select an area · Esc to cancel</span>}
    {visibleRect && <div className="map-screenshot__selection" style={{ left: visibleRect.x, top: visibleRect.y, width: visibleRect.width, height: visibleRect.height }} />}
    {selected && <dialog ref={dialogRef} className="map-screenshot__dialog" aria-labelledby="screenshot-title"
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        // Keep Tab at the dialog's edges inside the popup, including browsers
        // that otherwise send focus to browser chrome after the last button.
        const controls = event.currentTarget.querySelectorAll<HTMLElement>('button, input:checked');
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onCancel={(event) => { event.preventDefault(); onCancel(); }}>
      <form onSubmit={(event) => { event.preventDefault(); onCapture(selected, format); }}>
        <header>
          <h2 id="screenshot-title">Export Screenshot</h2>
          <button className="map-screenshot__close" type="button" aria-label="Close export" onClick={onCancel}>×</button>
        </header>
        <fieldset>
          <legend>Choose image format</legend>
          {(['png', 'svg'] as const).map((option) => <label key={option}>
            <input type="radio" name="screenshot-format" value={option} checked={format === option} onChange={() => setFormat(option)} />
            {option.toUpperCase()}
          </label>)}
        </fieldset>
        <footer>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button className="map-screenshot__export" type="submit">Export</button>
        </footer>
      </form>
    </dialog>}
  </div>;
}
