import { DEVIATION_LINE_EXAGGERATION, MAP_UTM_BOUNDS } from './drillMapConfig';
import type { DrillholeApiRecord } from '../../types/drillhole';
import type {
  MapBounds,
  MapCoordinates,
  UtmCoordinates,
  UtmProjectable,
} from '../../types/map';

/** Ratio of the way across the map, 0 at the left/top edge and 1 at the far edge. */
interface BoundsRatios {
  x: number;
  y: number;
}

function hasValidBounds(bounds: MapBounds): boolean {
  return (
    Number.isFinite(bounds.minX)
    && Number.isFinite(bounds.maxX)
    && Number.isFinite(bounds.minY)
    && Number.isFinite(bounds.maxY)
    && bounds.maxX > bounds.minX
    && bounds.maxY > bounds.minY
  );
}

/**
 * Converts an API value to a number, or rejects it.
 *
 * Takes `unknown` because the caller is reading untrusted record fields.
 * Null, undefined and the empty string are rejected before `Number` sees
 * them: all three coerce to 0, which would pass a finite check and plot the
 * hole at a real but wrong position.
 */
function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function computeBoundsRatios(
  drillhole: UtmProjectable,
  bounds: MapBounds,
): BoundsRatios | null {
  const x = toFiniteNumber(drillhole.x);
  const y = toFiniteNumber(drillhole.y);

  if (x === null || y === null) return null;

  return {
    x: (x - bounds.minX) / (bounds.maxX - bounds.minX),
    y: (bounds.maxY - y) / (bounds.maxY - bounds.minY),
  };
}

function isWithinBounds({ x, y }: BoundsRatios): boolean {
  return x >= 0 && x <= 1 && y >= 0 && y <= 1;
}

/**
 * Places a record on the base map as a percentage of the image.
 *
 * Generic in the record so the projected result keeps every field the caller
 * passed in: the same function projects a full drillhole and a bare
 * deviation endpoint, and both need their own fields back.
 *
 * Returns null for a record with no usable coordinates. A record that
 * projects outside the image is kept and flagged `isInsideMap: false`, since
 * a hole just off the edge is still real data.
 */
export function convertUtmToMapPosition<TRecord extends UtmProjectable>(
  drillhole: TRecord,
  bounds: MapBounds = MAP_UTM_BOUNDS,
): (TRecord & MapCoordinates) | null {
  if (!hasValidBounds(bounds)) {
    throw new Error('The map UTM bounds are invalid.');
  }

  const ratios = computeBoundsRatios(drillhole, bounds);
  if (!ratios) return null;

  return {
    ...drillhole,
    xPercent: ratios.x * 100,
    yPercent: ratios.y * 100,
    isInsideMap: isWithinBounds(ratios),
  };
}

/** The four numbers a deviation line needs, once they have been validated. */
interface DeviationInputs {
  x: number | null;
  y: number | null;
  azimuth: number | null;
  finalDeviation: number | null;
}

/** A numeric field the API spells both camelCase and PascalCase. */
type NumericFieldPair = readonly [
  camelCase: keyof DrillholeApiRecord,
  pascalCase: keyof DrillholeApiRecord,
];

// The API sends some fields PascalCase (see the HoleStatus/holeStatus pair in
// drillholeFeatures), and a missed field here reads as "no deviation" rather
// than as an error, silently hiding every line. Both casings are accepted so
// the endpoint is actually computed; the maths below is unchanged.
function readField(
  drillhole: DrillholeApiRecord,
  [camelCase, pascalCase]: NumericFieldPair,
): number | null {
  const camelValue = toFiniteNumber(drillhole[camelCase]);

  return camelValue === null ? toFiniteNumber(drillhole[pascalCase]) : camelValue;
}

function readDeviationInputs(drillhole: DrillholeApiRecord): DeviationInputs {
  return {
    x: readField(drillhole, ['x', 'X']),
    y: readField(drillhole, ['y', 'Y']),
    azimuth: readField(drillhole, ['azimuth', 'Azimuth']),
    finalDeviation: readField(drillhole, ['finalDeviation', 'FinalDeviation']),
  };
}

/**
 * Narrows the inputs to a set that can actually be drawn.
 *
 * Doubles as the type guard for the maths below, so the projection never sees
 * a null coordinate.
 */
function hasUsableDeviation(
  inputs: DeviationInputs,
): inputs is { x: number; y: number; azimuth: number; finalDeviation: number } {
  const { x, y, azimuth, finalDeviation } = inputs;

  if (x === null || y === null) return false;
  if (azimuth === null || azimuth < 0 || azimuth > 360) return false;

  return finalDeviation !== null && finalDeviation > 0;
}

/**
 * Projects a distance along a compass azimuth.
 *
 * 0° is north, 90° east, 180° south and 270° west, which is why sine drives
 * easting and cosine drives northing rather than the other way round.
 */
function projectAlongAzimuth(
  origin: UtmCoordinates,
  azimuth: number,
  distance: number,
): UtmCoordinates {
  const radians = azimuth * (Math.PI / 180);

  return {
    x: origin.x + Math.sin(radians) * distance,
    y: origin.y + Math.cos(radians) * distance,
  };
}

/** UTM position the deviation line ends at, or null when there is none to draw. */
export function calculateDeviationEndpoint(
  drillhole: DrillholeApiRecord,
): UtmCoordinates | null {
  const inputs = readDeviationInputs(drillhole);
  if (!hasUsableDeviation(inputs)) return null;

  const displayedDeviation = inputs.finalDeviation * DEVIATION_LINE_EXAGGERATION;

  return projectAlongAzimuth(inputs, inputs.azimuth, displayedDeviation);
}
