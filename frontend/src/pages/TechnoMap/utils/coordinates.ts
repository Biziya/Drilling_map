import { MAP_CONFIG, MAP_UTM_BOUNDS } from '../config/technoMapConfig';
import { readDrillholeValue } from '../../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../../types/drillhole';
import type {
  MapBounds,
  MapCoordinates,
  Point,
  ProjectedDrillhole,
  UtmCoordinates,
  UtmProjectable,
} from '../../../types/map';

/**
 * Converts an API value to a number, or rejects it. Null, undefined and ''
 * all coerce to 0, which would plot a hole at a real but wrong position.
 */
function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function hasValidBounds({ minX, maxX, minY, maxY }: MapBounds): boolean {
  return [minX, maxX, minY, maxY].every(Number.isFinite) && maxX > minX && maxY > minY;
}

/**
 * Places a record on the base map as a percentage of the image.
 *
 * Generic so the result keeps every field passed in. Returns null for a record
 * with no usable coordinates; a record outside the image is kept and flagged
 * `isInsideMap: false`, since a hole just off the edge is still real data.
 */
export function convertUtmToMapPosition<TRecord extends UtmProjectable>(
  record: TRecord,
  bounds: MapBounds = MAP_UTM_BOUNDS,
): (TRecord & MapCoordinates) | null {
  if (!hasValidBounds(bounds)) throw new Error('The map UTM bounds are invalid.');

  const x = toFiniteNumber(record.x);
  const y = toFiniteNumber(record.y);
  if (x === null || y === null) return null;

  const ratioX = (x - bounds.minX) / (bounds.maxX - bounds.minX);
  const ratioY = (bounds.maxY - y) / (bounds.maxY - bounds.minY);

  return {
    ...record,
    xPercent: ratioX * 100,
    yPercent: ratioY * 100,
    isInsideMap: ratioX >= 0 && ratioX <= 1 && ratioY >= 0 && ratioY <= 1,
  };
}

/** A UTM position as a 0-1 ratio of the base map (x right, y down). */
export function utmToMapRatio({ x, y }: UtmCoordinates, bounds: MapBounds = MAP_UTM_BOUNDS): Point {
  return {
    x: (x - bounds.minX) / (bounds.maxX - bounds.minX),
    y: (bounds.maxY - y) / (bounds.maxY - bounds.minY),
  };
}

/** Inverse of utmToMapRatio. */
export function mapRatioToUtm({ x, y }: Point, bounds: MapBounds = MAP_UTM_BOUNDS): UtmCoordinates {
  return {
    x: bounds.minX + x * (bounds.maxX - bounds.minX),
    y: bounds.maxY - y * (bounds.maxY - bounds.minY),
  };
}

/** Average of an outline's vertices: where a polygon's label sits. */
export function outlineCentre(vertices: readonly UtmCoordinates[]): UtmCoordinates {
  return {
    x: vertices.reduce((sum, { x }) => sum + x, 0) / vertices.length,
    y: vertices.reduce((sum, { y }) => sum + y, 0) / vertices.length,
  };
}

/** Smallest box (as map ratios) holding every drillhole, or null for none. */
export function drillholeExtent(drillholes: readonly MapCoordinates[]): MapBounds | null {
  if (drillholes.length === 0) return null;

  return drillholes.reduce(
    (box, { xPercent, yPercent }) => ({
      minX: Math.min(box.minX, xPercent / 100),
      maxX: Math.max(box.maxX, xPercent / 100),
      minY: Math.min(box.minY, yPercent / 100),
      maxY: Math.max(box.maxY, yPercent / 100),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
}

/**
 * UTM position the (exaggerated) deviation line ends at, or null when there
 * is none to draw. Reads every field under any casing the API uses.
 *
 * The backend returns the true endpoint (deviationEndX/Y, from the surveyed
 * azimuth and final deviation); only the display exaggeration is applied
 * here, by stretching the collar-to-endpoint vector.
 */
export function calculateDeviationEndpoint(drillhole: DrillholeApiRecord): UtmCoordinates | null {
  const read = (field: 'x' | 'y' | 'deviationEndX' | 'deviationEndY') =>
    toFiniteNumber(readDrillholeValue(drillhole, field));
  const x = read('x');
  const y = read('y');
  const endX = read('deviationEndX');
  const endY = read('deviationEndY');

  if (x === null || y === null || endX === null || endY === null) return null;
  if (endX === x && endY === y) return null;

  const scale = MAP_CONFIG.deviationExaggeration;

  return { x: x + (endX - x) * scale, y: y + (endY - y) * scale };
}

/** A drillhole paired with its projected deviation endpoint. */
export interface ProjectedDrillholeFeature {
  drillhole: ProjectedDrillhole;
  /** Stable React key. */
  key: string;
  endpoint: MapCoordinates | null;
}

/** A drillhole ready to render, with its deviation as a pixel offset. */
export interface DrillholeFeature {
  drillhole: ProjectedDrillhole;
  key: string;
  /** Offset from the collar to the deviation endpoint, in CSS pixels. */
  deviation: Point | null;
}

/**
 * Pairs each already-projected drillhole with its projected deviation endpoint.
 * The key reads every spelling of holeId so React never reuses the wrong element.
 */
export function projectDrillholes(drillholes: readonly ProjectedDrillhole[]): ProjectedDrillholeFeature[] {
  return drillholes.map((drillhole, index) => {
    const endpoint = calculateDeviationEndpoint(drillhole);

    return {
      drillhole,
      key: `${readDrillholeValue(drillhole, 'holeId') ?? 'drillhole'}-${index}`,
      endpoint: endpoint ? convertUtmToMapPosition(endpoint) : null,
    };
  });
}

/**
 * Converts each endpoint into a pixel offset from its collar. Null before the
 * map has been measured, since a zero-sized map collapses every line.
 */
export function attachDeviationOffsets(
  projected: readonly ProjectedDrillholeFeature[],
  { mapWidth, mapHeight }: { mapWidth: number; mapHeight: number },
): DrillholeFeature[] {
  return projected.map(({ drillhole, key, endpoint }) => ({
    drillhole,
    key,
    deviation: endpoint && mapWidth > 0 && mapHeight > 0
      ? {
        x: ((endpoint.xPercent - drillhole.xPercent) / 100) * mapWidth,
        y: ((endpoint.yPercent - drillhole.yPercent) / 100) * mapHeight,
      }
      : null,
  }));
}
