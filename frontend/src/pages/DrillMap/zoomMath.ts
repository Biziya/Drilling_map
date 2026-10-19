import type { MapTransform, MapZoomSettings, Point } from '../../types/map';

/** Lower and upper zoom limits. */
export type ScaleLimits = Pick<MapZoomSettings, 'minZoom' | 'maxZoom'>;

/** Everything `resolveScale` needs: the limits plus the snap threshold. */
export type ScaleResolveSettings = ScaleLimits &
  Pick<MapZoomSettings, 'deviationMinZoom'>;

/** True when a zoom step moves from one side of `threshold` to the other. */
export function crossesThreshold(
  fromScale: number,
  toScale: number,
  threshold: number,
): boolean {
  const zoomingIn = fromScale < threshold && toScale > threshold;
  const zoomingOut = fromScale > threshold && toScale < threshold;

  return zoomingIn || zoomingOut;
}

/**
 * Pins a zoom step to the threshold when it would step over it, so the zoom
 * level at which deviation lines appear is always reachable exactly.
 */
export function snapToThreshold(
  fromScale: number,
  toScale: number,
  threshold: number,
): number {
  return crossesThreshold(fromScale, toScale, threshold) ? threshold : toScale;
}

export function clampScale(scale: number, { minZoom, maxZoom }: ScaleLimits): number {
  return Math.min(maxZoom, Math.max(minZoom, scale));
}

export function resolveScale(
  currentScale: number,
  requestedScale: number,
  settings: ScaleResolveSettings,
): number {
  const snapped = snapToThreshold(
    currentScale,
    requestedScale,
    settings.deviationMinZoom,
  );

  return clampScale(snapped, settings);
}

/**
 * Rescales around `anchor` so the map point under it stays under it.
 *
 * The anchor is in viewport coordinates and `origin` is where the rendered
 * map starts inside that viewport, so subtracting both gives the position
 * within the map itself before the current transform is undone.
 */
export function panAroundAnchor(
  view: MapTransform,
  nextScale: number,
  anchor: Point,
  origin: Point,
): MapTransform {
  const mapX = (anchor.x - origin.x - view.translateX) / view.scale;
  const mapY = (anchor.y - origin.y - view.translateY) / view.scale;

  return {
    scale: nextScale,
    translateX: anchor.x - origin.x - mapX * nextScale,
    translateY: anchor.y - origin.y - mapY * nextScale,
  };
}

export interface ZoomViewOptions {
  view: MapTransform;
  requestedScale: number;
  anchor: Point;
  origin: Point;
  settings: ScaleResolveSettings;
}

/**
 * Applies a zoom request.
 *
 * Returns the identical view object when the scale cannot change, so callers
 * can skip the re-render on a no-op by reference comparison.
 */
export function zoomView({
  view,
  requestedScale,
  anchor,
  origin,
  settings,
}: ZoomViewOptions): MapTransform {
  const nextScale = resolveScale(view.scale, requestedScale, settings);
  if (nextScale === view.scale) return view;

  return panAroundAnchor(view, nextScale, anchor, origin);
}

export function isViewZoomed(
  view: MapTransform,
  settings: Pick<MapZoomSettings, 'minZoom'>,
): boolean {
  return view.scale > settings.minZoom
    || view.translateX !== 0
    || view.translateY !== 0;
}
