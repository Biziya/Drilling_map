// The white grid base map: Easting/Northing lines for the visible part of the
// map, with values in kilometres and "Easting (km)" / "Northing (km)" axis
// titles, all in viewport pixels. Coordinates stay in metres throughout; only
// the written values are divided by 1000. Every position goes through the same
// UTM -> map ratio -> viewport conversions the markers use, so the grid can
// never drift from them. The screen layer and the export both draw from this.

import { MAP_UTM_BOUNDS } from '../config/technoMapConfig';
import { mapRatioToUtm, utmToMapRatio } from './coordinates';
import { mapRatioToViewport, viewportToMapRatio } from './geometry';
import { formatNumber } from '../../../utils/formatNumber';
import type { MapBounds, MapTransform, Point, Size } from '../../../types/map';

/** A viewport rectangle, by its edges. */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface GridLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GridLabel {
  text: string;
  /** The text's anchor point and baseline. */
  x: number;
  y: number;
  anchor: 'start' | 'middle';
  /** Turned a quarter anticlockwise about (x, y), reading upwards. */
  vertical?: boolean;
}

export interface CoordinateGrid {
  /** The part of the map inside the viewport: the white sheet, and where lines and labels stop. */
  sheet: Rect;
  /** Distance between neighbouring lines, in metres. */
  step: number;
  lines: GridLine[];
  /** Easting values and title along the bottom edge, northing values and title along the left. */
  labels: GridLabel[];
}

export interface CoordinateGridOptions {
  viewport: Size;
  view: MapTransform;
  mapOrigin: Point;
  mapSize: Size;
  /** Smallest gap between lines on screen, in px. */
  minLineSpacing: number;
  /** Label font size in px, used to keep labels clear of the edges and each other. */
  labelFontSize: number;
  bounds?: MapBounds;
}

/** Gap between a label and its line or the sheet edge, in px. */
const LABEL_INSET = 4;
/** Rough width of one character, in font sizes. */
const CHAR_WIDTH_EMS = 0.6;
export const EASTING_TITLE = 'Easting (km)';
export const NORTHING_TITLE = 'Northing (km)';
/** The sheet must be this many px across before an axis title is written on it. */
const MIN_TITLED_SPAN = 160;
/** Lines per axis never exceed this, whatever the configuration. */
const MAX_LINES = 500;

/** Smallest 1, 2 or 5 x 10^n at or above `value`. */
export function niceStepAtLeast(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  // The tolerance absorbs float error, e.g. 0.3 / 0.1 = 2.9999999999999996.
  const multiplier = [1, 2, 5].find((candidate) => candidate * magnitude >= value * (1 - 1e-9)) ?? 10;

  return multiplier * magnitude;
}

/** Every multiple of `step` from `from` to `to`, both included. */
function multiplesBetween(from: number, to: number, step: number): number[] {
  const first = Math.ceil(from / step);
  const last = Math.floor(to / step);
  if (last - first + 1 > MAX_LINES) return [];

  // k * step, not repeated addition, so values stay exact round numbers.
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => Number(((first + index) * step).toPrecision(12)));
}

/**
 * A grid value as written on the map, in kilometres: as many decimals as the
 * step needs, so 414,000 m -> "414" and 414,500 m on a 500 m grid -> "414.5".
 */
export function formatGridValue(metres: number, stepMetres: number): string {
  const step = stepMetres / 1000;
  const decimals = step >= 1 ? 0 : Math.ceil(-Math.log10(step) - 1e-9);

  return formatNumber(metres / 1000, decimals);
}

/**
 * The grid for the current view, or null when no part of the map is in view
 * or the map has not been measured. Lines are 1/2/5 x 10^n metres apart, the
 * smallest such step that keeps them at least `minLineSpacing` px apart.
 */
export function computeCoordinateGrid({
  viewport,
  view,
  mapOrigin,
  mapSize,
  minLineSpacing,
  labelFontSize,
  bounds = MAP_UTM_BOUNDS,
}: CoordinateGridOptions): CoordinateGrid | null {
  const toViewport = (x: number, y: number) => mapRatioToViewport(utmToMapRatio({ x, y }, bounds), view, mapOrigin, mapSize);
  const toUtm = (point: Point) => mapRatioToUtm(viewportToMapRatio(point, view, mapOrigin, mapSize), bounds);

  const northWest = toViewport(bounds.minX, bounds.maxY);
  const southEast = toViewport(bounds.maxX, bounds.minY);
  const sheet: Rect = {
    left: Math.max(0, northWest.x),
    top: Math.max(0, northWest.y),
    right: Math.min(viewport.width, southEast.x),
    bottom: Math.min(viewport.height, southEast.y),
  };
  if (!(sheet.right > sheet.left && sheet.bottom > sheet.top)) return null;

  const metresPerPixel = Math.max(
    (bounds.maxX - bounds.minX) / (southEast.x - northWest.x),
    (bounds.maxY - bounds.minY) / (southEast.y - northWest.y),
  );
  const step = niceStepAtLeast(minLineSpacing * metresPerPixel);
  if (step <= 0) return { sheet, step: 0, lines: [], labels: [] };

  const low = toUtm({ x: sheet.left, y: sheet.bottom });
  const high = toUtm({ x: sheet.right, y: sheet.top });
  const eastings = multiplesBetween(low.x, high.x, step).map((value) => ({ value, at: toViewport(value, bounds.maxY).x }));
  const northings = multiplesBetween(low.y, high.y, step).map((value) => ({ value, at: toViewport(bounds.minX, value).y }));

  const lines: GridLine[] = [
    ...eastings.map(({ at }) => ({ x1: at, y1: sheet.top, x2: at, y2: sheet.bottom })),
    ...northings.map(({ at }) => ({ x1: sheet.left, y1: at, x2: sheet.right, y2: at })),
  ];

  // Bottom edge: the Easting title on the edge, the values in a row above it,
  // each centred on its line. Left edge: the Northing title turned on its
  // side, the values just right of it, each above its line. A value that
  // would run off the sheet or into the other axis is left unwritten.
  const row = labelFontSize + LABEL_INSET;
  const titleBaseline = sheet.bottom - LABEL_INSET;
  const valueBaseline = titleBaseline - row;
  const titleColumn = sheet.left + LABEL_INSET + labelFontSize;
  const valueLeft = titleColumn + LABEL_INSET;
  const halfWidth = (text: string) => (text.length * CHAR_WIDTH_EMS * labelFontSize) / 2;

  const eastingLabels: GridLabel[] = eastings
    .map(({ value, at }) => ({ text: formatGridValue(value, step), x: at, y: valueBaseline, anchor: 'middle' as const }))
    .filter(({ text, x }) => x - halfWidth(text) >= valueLeft && x + halfWidth(text) <= sheet.right - LABEL_INSET);
  const northingLabels: GridLabel[] = northings
    .filter(({ at }) => at - LABEL_INSET - labelFontSize > sheet.top && at < valueBaseline - row)
    .map(({ value, at }) => ({ text: formatGridValue(value, step), x: valueLeft, y: at - LABEL_INSET, anchor: 'start' as const }));
  const titles: GridLabel[] = [];
  if (sheet.right - sheet.left >= MIN_TITLED_SPAN) {
    titles.push({ text: EASTING_TITLE, x: (sheet.left + sheet.right) / 2, y: titleBaseline, anchor: 'middle' });
  }
  if (sheet.bottom - sheet.top >= MIN_TITLED_SPAN) {
    titles.push({ text: NORTHING_TITLE, x: titleColumn, y: (sheet.top + sheet.bottom) / 2, anchor: 'middle', vertical: true });
  }
  const labels = [...eastingLabels, ...northingLabels, ...titles];

  return { sheet, step, lines, labels };
}
