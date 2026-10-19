// One place that knows how to read a field off an API record.
//
// The backend spells some columns camelCase and some PascalCase, and which is
// which varies by endpoint and by serializer configuration. Before this
// module each reader picked its own subset of aliases, so a PascalCase
// payload drew correct markers while the tooltip showed dashes and the React
// keys collapsed to `drillhole-0`, `drillhole-1`, ...
//
// Every read of a drillhole field should go through here. Adding a column
// means adding one line to the alias table below, and every consumer picks it
// up.

import type {
  ApiNumeric,
  ApiText,
  DrillholeApiRecord,
  DrillholeMapItem,
} from '../types/drillhole';

/** Value a record field can hold before it has been narrowed. */
export type DrillholeFieldValue = ApiText | ApiNumeric | undefined;

/** Canonical field name, i.e. the camelCase spelling in `DrillholeMapItem`. */
export type DrillholeField = keyof DrillholeMapItem;

/**
 * Every spelling the API is known to use, most preferred first.
 *
 * Keyed by the canonical camelCase name so callers never have to remember
 * which columns have aliases.
 */
const FIELD_ALIASES: Readonly<
  Record<DrillholeField, readonly (keyof DrillholeApiRecord)[]>
> = {
  holeId: ['holeId', 'HoleId', 'Hole_ID'],
  coordinateType: ['coordinateType', 'CoordinateType'],
  x: ['x', 'X'],
  y: ['y', 'Y'],
  z: ['z', 'Z'],
  year: ['year', 'Year'],
  campaign: ['campaign', 'Campaign'],
  gt: ['gt', 'GT'],
  maxDepth: ['maxDepth', 'MaxDepth'],
  azimuth: ['azimuth', 'Azimuth'],
  finalDeviation: ['finalDeviation', 'FinalDeviation'],
  holePurpose: ['holePurpose', 'HolePurpose'],
  holeStatus: ['holeStatus', 'HoleStatus'],
};

/**
 * Whether a value counts as supplied.
 *
 * A blank string is treated as absent so a present-but-empty camelCase column
 * does not shadow a populated PascalCase one.
 */
function isPresent(value: DrillholeFieldValue): boolean {
  if (value === null || value === undefined) return false;

  return !(typeof value === 'string' && value.trim() === '');
}

/**
 * Reads a field under any of its known spellings, preserving the raw value.
 *
 * Returns `undefined` when no spelling carries anything, so the caller decides
 * what an absent field means rather than being handed a coerced default.
 */
export function readDrillholeValue(
  drillhole: DrillholeApiRecord | null | undefined,
  field: DrillholeField,
): DrillholeFieldValue {
  if (!drillhole) return undefined;

  for (const alias of FIELD_ALIASES[field]) {
    const value = drillhole[alias];
    if (isPresent(value)) return value;
  }

  return undefined;
}

/**
 * Reads a field as a normalised tag for comparison: trimmed and upper-cased.
 *
 * Returns the empty string for an absent field and for a non-string value, so
 * a numeric `HolePurpose` can never accidentally match a purpose constant.
 */
export function readDrillholeTag(
  drillhole: DrillholeApiRecord | null | undefined,
  field: DrillholeField,
): string {
  const value = readDrillholeValue(drillhole, field);

  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

/**
 * Reads a field as display text, preserving its original casing.
 *
 * Returns null rather than the empty string so callers can use `??` and still
 * distinguish "absent" from a legitimately empty label.
 */
export function readDrillholeText(
  drillhole: DrillholeApiRecord | null | undefined,
  field: DrillholeField,
): string | null {
  const value = readDrillholeValue(drillhole, field);
  if (value === undefined) return null;

  return typeof value === 'string' ? value : String(value);
}

/** HoleStatus marking a hole as actively being drilled. */
export const IN_PROGRESS_HOLE_STATUS = 'INPROGRESS';

/**
 * Whether a hole is actively being drilled, and therefore drawn as a rig.
 *
 * The single definition of the rule. It previously existed three times, one
 * of which compared the raw value, so `'inprogress'` set the `isRig` flag
 * false while the marker still resolved to a rig.
 */
export function isInProgressHole(
  drillhole: DrillholeApiRecord | null | undefined,
): boolean {
  return readDrillholeTag(drillhole, 'holeStatus') === IN_PROGRESS_HOLE_STATUS;
}
