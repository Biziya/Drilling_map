import { useCallback, useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

/** The rows to render out of `count`, and the empty space above and below them. */
export interface RowWindow {
  start: number;
  /** One past the last row to render. */
  end: number;
  /** Height of the rows above `start` and below `end`, in px. */
  padTop: number;
  padBottom: number;
}

/**
 * Which rows a scroll box of `viewportHeight` px shows at `scrollTop`, plus
 * `overscan` rows either side so a fast scroll never reveals a gap.
 * Every row is `rowHeight` px tall.
 */
export function windowRange(count: number, rowHeight: number, scrollTop: number, viewportHeight: number, overscan: number): RowWindow {
  const first = Math.max(0, Math.floor(scrollTop / rowHeight));
  const visible = Math.ceil(viewportHeight / rowHeight) + 1;
  const start = Math.min(count, Math.max(0, first - overscan));
  const end = Math.min(count, first + visible + overscan);

  return { start, end, padTop: start * rowHeight, padBottom: (count - end) * rowHeight };
}

/** Used before the box has a height (first render, or no layout as in tests). */
const FALLBACK_HEIGHT = 400;

/**
 * Renders only the rows a scroll box can show: thousands of rows in the DOM
 * made the selection table slow to lay out and scroll. The page re-renders
 * only when the first visible row or the box height changes, not on every
 * scroll event.
 */
export function useWindowedRows(
  scrollRef: RefObject<HTMLElement | null>,
  count: number,
  rowHeight: number,
  overscan = 10,
): RowWindow {
  const [metrics, setMetrics] = useState({ first: 0, height: FALLBACK_HEIGHT });

  const measure = useCallback(() => {
    const box = scrollRef.current;
    if (!box) return;
    const first = Math.floor(box.scrollTop / rowHeight);
    const height = box.clientHeight || FALLBACK_HEIGHT;
    setMetrics((current) => (current.first === first && current.height === height ? current : { first, height }));
  }, [scrollRef, rowHeight]);

  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!box) return undefined;
    measure();
    box.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(box);

    return () => {
      box.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [scrollRef, measure]);

  // A shorter list (a filter) can leave the box scrolled past its end; the
  // browser clamps scrollTop and fires scroll, which re-measures.
  return windowRange(count, rowHeight, metrics.first * rowHeight, metrics.height, overscan);
}
