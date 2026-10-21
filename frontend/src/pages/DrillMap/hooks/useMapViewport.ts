// Viewport behaviour for a map: sizing, drag-to-pan, wheel/button/double-click
// zoom about a point, clicks on the map, and persisting the view across page
// switches.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  SyntheticEvent,
} from 'react';
import { computeMapOrigin, computeRenderedMapSize, measuredMapSize, viewportToMapRatio, zoomView } from '../utils/geometry';
import { readMapView, writeMapView } from '../../../state/mapViewStore';
import type { MapId, MapTransform, MapZoomSettings, Point, Size } from '../../../types/map';

const NO_SIZE: Size = { width: 0, height: 0 };
const PRIMARY_BUTTON = 0;
/** A press that travels further than this (px) is a drag, not a click. */
const CLICK_TOLERANCE = 4;

/** Tracks an element's size, re-rendering only when it actually changes. */
function useElementSize(elementRef: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>(NO_SIZE);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;

    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setSize((current) => (current.width === width && current.height === height ? current : { width, height }));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [elementRef]);

  return size;
}

/** Position of a mouse/pointer event relative to the element handling it. */
function pointWithin(element: Element, event: { clientX: number; clientY: number }): Point {
  const rect = element.getBoundingClientRect();

  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

export interface MapViewportOptions {
  settings: MapZoomSettings;
  /** Key the view is persisted under, unique per map. */
  viewKey: MapId;
  /** Elements a drag must not start on (markers, controls), as a CSS selector. */
  dragIgnoreSelector: string;
  /** Floating controls that keep the wheel and double-click for themselves. */
  overlaySelector: string;
  /**
   * Called with the map position (0-1 ratios) of a click that did not drag.
   * While set, double-click does not zoom, so two quick clicks stay two clicks.
   */
  onMapClick?: ((ratio: Point) => void) | undefined;
}

export function useMapViewport({ settings, viewKey, dragIgnoreSelector, overlaySelector, onMapClick }: MapViewportOptions) {
  const initialView = useMemo<MapTransform>(
    () => ({ scale: settings.minZoom, translateX: 0, translateY: 0 }),
    [settings.minZoom],
  );
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const viewportSize = useElementSize(viewportRef);
  const [imageSize, setImageSize] = useState<Size>(NO_SIZE);
  const [imageFailed, setImageFailed] = useState(false);

  // Pointer and wheel events fire faster than React can usefully render, so
  // the live view sits in a ref and is committed to state once per frame.
  const viewRef = useRef<MapTransform>(readMapView(viewKey, initialView));
  const frameRef = useRef<number | null>(null);
  const [view, setView] = useState(viewRef.current);

  const updateView = useCallback((updater: (current: MapTransform) => MapTransform) => {
    const next = updater(viewRef.current);
    if (next === viewRef.current) return;

    viewRef.current = next;
    frameRef.current ??= window.requestAnimationFrame(() => {
      frameRef.current = null;
      setView(viewRef.current);
    });
  }, []);

  // Restored on mount; the last pan/zoom (which can lag a frame behind state)
  // is flushed on unmount.
  useEffect(() => writeMapView(viewKey, view), [view, viewKey]);
  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    writeMapView(viewKey, viewRef.current);
  }, [viewKey]);

  const renderedMapSize = useMemo(() => computeRenderedMapSize(imageSize, viewportSize), [imageSize, viewportSize]);
  const mapOrigin = useMemo(() => computeMapOrigin(viewportSize, renderedMapSize), [viewportSize, renderedMapSize]);

  /** Zooms keeping `anchor` fixed; without an anchor, zooms about the centre. */
  const zoomBy = useCallback((delta: number, anchor?: Point) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const origin = computeMapOrigin(rect, renderedMapSize);
    const point = anchor ?? { x: rect.width / 2, y: rect.height / 2 };

    updateView((current) => zoomView(current, current.scale + delta, point, origin, settings));
  }, [renderedMapSize, settings, updateView]);

  // Registered natively: React attaches wheel listeners passively, and this
  // one must call preventDefault to stop the page scrolling.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const handleWheel = (event: WheelEvent) => {
      // A floating control keeps the wheel; it does not zoom the map underneath.
      if (event.target instanceof Element && event.target.closest(overlaySelector)) return;
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? settings.zoomStep : -settings.zoomStep, pointWithin(viewport, event));
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });

    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [overlaySelector, settings.zoomStep, zoomBy]);

  // Drag-to-pan. The pointer is captured, so a fast drag that leaves the
  // viewport keeps panning instead of stopping dead. `moved` turns true once
  // the press travels past the click tolerance; until then it may be a click.
  const dragRef = useRef<{ pointerId: number; start: Point; origin: Point; moved: boolean } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlers = {
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (event.button !== PRIMARY_BUTTON) return;
      if (event.target instanceof Element && event.target.closest(dragIgnoreSelector)) return;

      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = {
        pointerId: event.pointerId,
        start: { x: event.clientX, y: event.clientY },
        origin: { x: viewRef.current.translateX, y: viewRef.current.translateY },
        moved: false,
      };
      setIsDragging(true);
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      const drag = dragRef.current;
      if (drag?.pointerId !== event.pointerId) return;

      drag.moved ||= Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) > CLICK_TOLERANCE;
      updateView((current) => ({
        ...current,
        translateX: drag.origin.x + event.clientX - drag.start.x,
        translateY: drag.origin.y + event.clientY - drag.start.y,
      }));
    },
    onPointerUp(this: void, event: ReactPointerEvent<HTMLElement>) {
      const drag = dragRef.current;
      if (drag?.pointerId !== event.pointerId) return;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      dragRef.current = null;
      setIsDragging(false);

      const mapSize = measuredMapSize(renderedMapSize);
      if (event.type !== 'pointerup' || drag.moved || !onMapClick || !mapSize) return;
      const point = pointWithin(event.currentTarget, event);
      onMapClick(viewportToMapRatio(point, viewRef.current, mapOrigin, mapSize));
    },
    onDoubleClick(event: ReactMouseEvent<HTMLElement>) {
      if (onMapClick) return;
      if (event.target instanceof Element && event.target.closest(overlaySelector)) return;
      zoomBy(settings.zoomStep, pointWithin(event.currentTarget, event));
    },
  };

  return {
    viewportRef,
    view,
    renderedMapSize,
    /** Top-left of the untransformed map within the viewport. */
    mapOrigin,
    viewportSize,
    isDragging,
    viewportHandlers: { ...handlers, onPointerCancel: handlers.onPointerUp },
    image: {
      hasFailed: imageFailed,
      onLoad: (event: SyntheticEvent<HTMLImageElement>) => {
        setImageFailed(false);
        setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
      },
      onError: () => setImageFailed(true),
    },
    controls: {
      zoomIn: () => zoomBy(settings.zoomStep),
      zoomOut: () => zoomBy(-settings.zoomStep),
      reset: () => updateView(() => initialView),
    },
  };
}
