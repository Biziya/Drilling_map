import type { MapBounds } from '../types/map';

const TARGET_BAR_WIDTH = 100;

/** A drawable scale bar: how wide to render it and what to call it. */
export interface ScaleBar {
  label: string;
  width: number;
}

export interface ScaleBarOptions {
  /** Rendered width of the base map in CSS pixels, before zoom. */
  mapWidth: number;
  zoom: number;
  bounds: MapBounds;
}

/** Rounds to a 1, 2 or 5 step so the bar always reads as a round number. */
function selectStepMultiplier(normalized: number): number {
  if (normalized >= 5) return 5;
  if (normalized >= 2) return 2;

  return 1;
}

function selectReadableDistance(maxMeters: number): number {
  if (!Number.isFinite(maxMeters) || maxMeters <= 0) return 0;

  const magnitude = 10 ** Math.floor(Math.log10(maxMeters));

  return selectStepMultiplier(maxMeters / magnitude) * magnitude;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${meters / 1000} km`;

  return `${meters} m`;
}

/**
 * Computes the scale bar for the current zoom.
 *
 * Returns null for any input that cannot produce a meaningful bar: a map that
 * has not been measured yet, zero zoom, or bounds with no horizontal extent,
 * where the division would otherwise yield Infinity pixels per metre.
 */
export function computeScaleBar({ mapWidth, zoom, bounds }: ScaleBarOptions): ScaleBar | null {
  const mapWidthMeters = bounds.maxX - bounds.minX;
  const pixelsPerMeter = (mapWidth * zoom) / mapWidthMeters;

  if (!Number.isFinite(pixelsPerMeter) || pixelsPerMeter <= 0) return null;

  const distance = selectReadableDistance(TARGET_BAR_WIDTH / pixelsPerMeter);
  if (distance <= 0) return null;

  return {
    label: formatDistance(distance),
    width: distance * pixelsPerMeter,
  };
}
