import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { ZoomAtPoint } from './useZoomAtPoint';

export interface WheelZoomOptions {
  zoomStep: number;
  onZoom: ZoomAtPoint;
}

/**
 * Wheel-to-zoom, anchored on the cursor.
 *
 * Registered natively rather than through React's onWheel because the
 * listener must be non-passive to call `preventDefault`, and React attaches
 * wheel listeners passively.
 */
export function useWheelZoom(
  elementRef: RefObject<HTMLElement | null>,
  { zoomStep, onZoom }: WheelZoomOptions,
): void {
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const direction = event.deltaY < 0 ? zoomStep : -zoomStep;

      onZoom((currentScale) => currentScale + direction, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };

    element.addEventListener('wheel', handleWheel, { passive: false });

    return () => element.removeEventListener('wheel', handleWheel);
  }, [elementRef, onZoom, zoomStep]);
}
