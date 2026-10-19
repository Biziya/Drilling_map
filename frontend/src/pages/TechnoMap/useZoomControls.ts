import { useCallback } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { MapTransform } from '../../types/map';
import type { ViewUpdater } from './useAnimationFrameView';
import type { ZoomAtPoint } from './useZoomAtPoint';

export interface ZoomControlsOptions {
  zoomAtPoint: ZoomAtPoint;
  queueViewUpdate: (updater: ViewUpdater) => void;
  /** View the reset button returns to. */
  initialView: MapTransform;
  zoomStep: number;
}

export interface ZoomControls {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  /** Double-click handler; zooms in on the point that was clicked. */
  zoomInAtPointer: (event: ReactMouseEvent<HTMLElement>) => void;
}

export function useZoomControls({
  zoomAtPoint,
  queueViewUpdate,
  initialView,
  zoomStep,
}: ZoomControlsOptions): ZoomControls {
  const zoomIn = useCallback(
    () => zoomAtPoint((scale) => scale + zoomStep),
    [zoomAtPoint, zoomStep],
  );

  const zoomOut = useCallback(
    () => zoomAtPoint((scale) => scale - zoomStep),
    [zoomAtPoint, zoomStep],
  );

  const reset = useCallback(
    () => queueViewUpdate(initialView),
    [initialView, queueViewUpdate],
  );

  const zoomInAtPointer = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();

    zoomAtPoint((scale) => scale + zoomStep, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }, [zoomAtPoint, zoomStep]);

  return { zoomIn, zoomOut, reset, zoomInAtPointer };
}
