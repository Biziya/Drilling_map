import { useCallback } from 'react';
import type { RefObject } from 'react';
import { computeMapOrigin } from './mapGeometry';
import { zoomView } from './zoomMath';
import type { ScaleResolveSettings } from './zoomMath';
import type { Point, RenderedMapSize } from '../../types/map';
import type { ViewUpdater } from './useAnimationFrameView';

/** Produces the requested scale from the current one. */
export type ScaleRequest = (currentScale: number) => number;

/**
 * Zooms the map, keeping a chosen viewport point fixed.
 *
 * The anchor is optional: omitting it zooms about the centre of the
 * viewport, which is what the +/- buttons want.
 */
export type ZoomAtPoint = (nextScale: ScaleRequest, viewportPoint?: Point) => void;

export interface ZoomAtPointOptions {
  viewportRef: RefObject<HTMLElement | null>;
  renderedMapSize: RenderedMapSize;
  queueViewUpdate: (updater: ViewUpdater) => void;
  settings: ScaleResolveSettings;
}

export function useZoomAtPoint({
  viewportRef,
  renderedMapSize,
  queueViewUpdate,
  settings,
}: ZoomAtPointOptions): ZoomAtPoint {
  const { width, height } = renderedMapSize;

  return useCallback<ZoomAtPoint>((nextScale, viewportPoint) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const origin = computeMapOrigin(rect, { width, height });
    const anchor: Point = {
      x: viewportPoint?.x ?? rect.width / 2,
      y: viewportPoint?.y ?? rect.height / 2,
    };

    queueViewUpdate((view) => zoomView({
      view,
      requestedScale: nextScale(view.scale),
      anchor,
      origin,
      settings,
    }));
  }, [height, queueViewUpdate, settings, viewportRef, width]);
}
