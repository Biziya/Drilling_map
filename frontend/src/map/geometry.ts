// Pure maths behind the map viewport: fitting the base map, the pan/zoom
// transform, and zooming about an anchor point.

import type { CssLength, MapTransform, MapZoomSettings, Point, RenderedMapSize, Size } from '../types/map';

/** Used until the base map reports its size. Frozen so renders compare equal. */
const FILL_VIEWPORT = Object.freeze({ width: '100%', height: '100%' } as const);

/** Size the base map is drawn at: fitted inside the viewport, never below 1px. */
export function computeRenderedMapSize(imageSize: Size, viewportSize: Size): RenderedMapSize {
  if (!imageSize.width || !imageSize.height) return FILL_VIEWPORT;

  const fitScale = Math.min(viewportSize.width / imageSize.width, viewportSize.height / imageSize.height);
  if (fitScale <= 0) return FILL_VIEWPORT;

  return {
    width: Math.max(1, imageSize.width * fitScale),
    height: Math.max(1, imageSize.height * fitScale),
  };
}

/** Reads a rendered dimension as pixels; the `'100%'` fallback reads as 0. */
export function toPixels(value: CssLength | undefined): number {
  return typeof value === 'number' ? value : 0;
}

/** Top-left corner of the rendered (centred) map within the viewport. */
export function computeMapOrigin(viewport: Size, rendered: RenderedMapSize): Point {
  const width = typeof rendered.width === 'number' ? rendered.width : viewport.width;
  const height = typeof rendered.height === 'number' ? rendered.height : viewport.height;

  return { x: (viewport.width - width) / 2, y: (viewport.height - height) / 2 };
}

/** Rounds a translation onto the device pixel grid to avoid blurred edges. */
export function snapToDevicePixels(point: Point, ratio = globalThis.devicePixelRatio || 1): Point {
  return { x: Math.round(point.x * ratio) / ratio, y: Math.round(point.y * ratio) / ratio };
}

/**
 * Inline style for the canvas. `translate(...) scale(...)` order is
 * load-bearing: cursor-centred zoom is computed against this composition.
 * `--inverse-map-scale` lets markers cancel the scale and keep their size.
 */
export function buildCanvasTransformStyle(view: MapTransform, renderedMapSize: RenderedMapSize) {
  const { x, y } = snapToDevicePixels({ x: view.translateX, y: view.translateY });

  return {
    ...renderedMapSize,
    '--inverse-map-scale': 1 / view.scale,
    transform: `translate(${x}px, ${y}px) scale(${view.scale})`,
  };
}

export type ScaleSettings = Pick<MapZoomSettings, 'minZoom' | 'maxZoom' | 'deviationMinZoom'>;

/**
 * Clamps a requested zoom, pinning it to the deviation threshold when a step
 * would jump over it, so the zoom where lines appear is always reachable.
 */
export function resolveScale(currentScale: number, requestedScale: number, settings: ScaleSettings): number {
  const threshold = settings.deviationMinZoom;
  const crosses = (currentScale < threshold && requestedScale > threshold)
    || (currentScale > threshold && requestedScale < threshold);
  const snapped = crosses ? threshold : requestedScale;

  return Math.min(settings.maxZoom, Math.max(settings.minZoom, snapped));
}

/** Rescales so the map point under `anchor` (viewport coordinates) stays under it. */
export function panAroundAnchor(view: MapTransform, nextScale: number, anchor: Point, origin: Point): MapTransform {
  const mapX = (anchor.x - origin.x - view.translateX) / view.scale;
  const mapY = (anchor.y - origin.y - view.translateY) / view.scale;

  return {
    scale: nextScale,
    translateX: anchor.x - origin.x - mapX * nextScale,
    translateY: anchor.y - origin.y - mapY * nextScale,
  };
}

/** Applies a zoom request. Returns the same object when nothing changes. */
export function zoomView(
  view: MapTransform,
  requestedScale: number,
  anchor: Point,
  origin: Point,
  settings: ScaleSettings,
): MapTransform {
  const nextScale = resolveScale(view.scale, requestedScale, settings);

  return nextScale === view.scale ? view : panAroundAnchor(view, nextScale, anchor, origin);
}

/** True once the user has zoomed or panned away from the initial view. */
export function isViewZoomed(view: MapTransform, minZoom: number): boolean {
  return view.scale > minZoom || view.translateX !== 0 || view.translateY !== 0;
}
