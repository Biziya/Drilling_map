import { useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { computeRenderedMapSize } from './mapGeometry';
import { useAnimationFrameView } from './useAnimationFrameView';
import { useBaseMapImage } from './useBaseMapImage';
import type { BaseMapImage } from './useBaseMapImage';
import { useElementSize } from './useElementSize';
import { useMapPanning } from './useMapPanning';
import type { PointerDrag } from './usePointerDrag';
import { useWheelZoom } from './useWheelZoom';
import { useZoomAtPoint } from './useZoomAtPoint';
import { useZoomControls } from './useZoomControls';
import type { ZoomControls } from './useZoomControls';
import { readMapView, writeMapView } from '../../state/mapViewStore';
import type { MapId, MapTransform, MapZoomSettings, RenderedMapSize } from '../../types/map';

export interface MapViewportOptions {
  settings: MapZoomSettings;
  /** View the map opens at, and the target the reset button returns to. */
  initialView: MapTransform;
  dragIgnoreSelector: string;
  /** Key this map's view is persisted under, unique per page. */
  viewStateKey: MapId;
}

export interface MapViewport {
  viewportRef: RefObject<HTMLDivElement | null>;
  view: MapTransform;
  renderedMapSize: RenderedMapSize;
  image: BaseMapImage;
  controls: ZoomControls;
  drag: PointerDrag;
}

/**
 * Composes the viewport behaviour: sizing, pan, zoom and view persistence.
 *
 * This is the single place the individual interaction hooks are wired
 * together, so a page only has to render the result.
 */
export function useMapViewport({
  settings,
  initialView,
  dragIgnoreSelector,
  viewStateKey,
}: MapViewportOptions): MapViewport {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const image = useBaseMapImage();
  const viewportSize = useElementSize(viewportRef);

  // Restored on mount so navigating back to this map reopens it at the zoom and
  // pan it had before. `initialView` stays the reset target either way.
  const { view, viewRef, queueViewUpdate } = useAnimationFrameView(
    readMapView(viewStateKey, initialView),
  );

  useEffect(() => {
    writeMapView(viewStateKey, view);
  }, [view, viewStateKey]);

  // The committed `view` above can lag a frame behind `viewRef`, so the very
  // last pan or zoom before unmount is flushed here too.
  useEffect(() => () => {
    writeMapView(viewStateKey, viewRef.current);
  }, [viewRef, viewStateKey]);

  const renderedMapSize = useMemo(
    () => computeRenderedMapSize(image.size, viewportSize),
    [image.size, viewportSize],
  );

  const zoomAtPoint = useZoomAtPoint({
    viewportRef,
    renderedMapSize,
    queueViewUpdate,
    settings,
  });

  const controls = useZoomControls({
    zoomAtPoint,
    queueViewUpdate,
    initialView,
    zoomStep: settings.zoomStep,
  });

  const drag = useMapPanning({
    viewRef,
    queueViewUpdate,
    ignoreSelector: dragIgnoreSelector,
  });

  useWheelZoom(viewportRef, {
    zoomStep: settings.zoomStep,
    onZoom: zoomAtPoint,
  });

  return { viewportRef, view, renderedMapSize, image, controls, drag };
}
