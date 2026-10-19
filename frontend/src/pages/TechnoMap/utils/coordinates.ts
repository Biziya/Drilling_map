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

/**
 * UTM position the (exaggerated) deviation line ends at, or null when there
 * is none to draw. Reads every field under any casing the API uses.
 *
 * Azimuth is a compass bearing: 0° north, 90° east, which is why sine drives
 * easting and cosine drives northing.
 */
export function calculateDeviationEndpoint(drillhole: DrillholeApiRecord): UtmCoordinates | null {
  const read = (field: 'x' | 'y' | 'azimuth' | 'finalDeviation') =>
    toFiniteNumber(readDrillholeValue(drillhole, field));
  const x = read('x');
  const y = read('y');
  const azimuth = read('azimuth');
  const deviation = read('finalDeviation');

  if (x === null || y === null) return null;
  if (azimuth === null || azimuth < 0 || azimuth > 360) return null;
  if (deviation === null || deviation <= 0) return null;

  const distance = deviation * MAP_CONFIG.deviationExaggeration;
  const radians = azimuth * (Math.PI / 180);

  return { x: x + Math.sin(radians) * distance, y: y + Math.cos(radians) * distance };
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
