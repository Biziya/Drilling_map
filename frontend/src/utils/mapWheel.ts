import type { MapBounds, MapZoomSettings } from '../types/map';

/**
 * The width the scale bar aims for, in CSS px. The bar shows the round
 * distance (1, 2 or 5 x 10^n m) that fits this width, so the zoom limit below
 * is reached exactly when a `minScaleBarMeters` bar fills it.
 */
export const SCALE_BAR_TARGET_PX = 100;

/**
 * Zoom change for `notches` steps of `step` from `scale`, as a delta to add.
 * Zoom is multiplicative: one step multiplies the scale by 1 + step, one step
 * back divides by it, so a notch feels the same at every depth.
 */
export function stepZoomDelta(scale: number, step: number, notches: number): number {
  return scale * ((1 + step) ** notches - 1);
}

/**
 * The deepest zoom for a map: where the scale bar reads `minScaleBarMeters`,
 * i.e. SCALE_BAR_TARGET_PX / minScaleBarMeters screen px per metre. It depends
 * on how wide the base map is drawn (window size) and how many metres it
 * spans, so a small redox map and a regional map both stop at the same scale.
 * `settings.maxZoom` stays the hard cap, and applies until the map is measured.
 */
export function maxZoomForScaleBar(
  settings: Pick<MapZoomSettings, 'minZoom' | 'maxZoom' | 'minScaleBarMeters'>,
  mapWidthPx: number | null | undefined,
  bounds: MapBounds,
): number {
  const widthMeters = bounds.maxX - bounds.minX;
  if (!mapWidthPx || mapWidthPx <= 0 || !(widthMeters > 0) || !(settings.minScaleBarMeters > 0)) return settings.maxZoom;

  const pixelsPerMeter = SCALE_BAR_TARGET_PX / settings.minScaleBarMeters;
  const zoom = (pixelsPerMeter * widthMeters) / mapWidthPx;

  return Math.min(settings.maxZoom, Math.max(settings.minZoom, zoom));
}

/** One conventional wheel notch (100 CSS px / 3 lines) is one configured step.
 * Touchpads contribute fractional steps; unusually large events are capped.
 * This deliberately has no dependency on the current map scale.
 */
export function wheelZoomDelta(event: Pick<WheelEvent, 'deltaY' | 'deltaMode'>, increment: number): number {
  const pixels = event.deltaY * (event.deltaMode === 1 ? 100 / 3 : event.deltaMode === 2 ? 100 : 1);
  if (!Number.isFinite(pixels) || pixels === 0) return 0;
  return -Math.max(-1, Math.min(1, pixels / 100)) * increment;
}
