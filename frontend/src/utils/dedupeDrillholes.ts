// One marker per drillhole.
//
// A marker renders either the rig icon or a shape, never both, so a single
// record cannot show a rig and a square together. Two records for the same
// hole can: the feature key is `holeId-index`, so duplicates are happily
// rendered twice, and if one copy carries HoleStatus = INPROGRESS and the
// other does not, the result is a rig with a square underneath it.
//
// Records are keyed on hole id AND coordinates rather than hole id alone,
// because Hole_ID is only unique within a PROJECTCODE and the API does not
// return the project. Two projects sharing a HOLEID are different holes at
// different coordinates and both must stay on the map.

import { isInProgressHole, readDrillholeValue } from './drillholeFields';
import type { DrillholeApiRecord } from '../types/drillhole';

/**
 * Runtime array check that deliberately does not narrow.
 *
 * `Array.isArray` would widen a typed array to `any[]` in the guarded branch
 * and take the element type with it, so the check is kept behind a plain
 * boolean helper.
 */
function isArrayValue(value: unknown): boolean {
  return Array.isArray(value);
}

/** Stringifies a coordinate for the key, treating absent as the empty string. */
function readCoordinate(
  drillhole: DrillholeApiRecord | null | undefined,
  field: 'x' | 'y',
): string {
  const value = readDrillholeValue(drillhole, field);

  return value === undefined ? '' : String(value);
}

function buildDedupeKey(
  drillhole: DrillholeApiRecord | null | undefined,
  index: number,
): string {
  const holeId = readDrillholeValue(drillhole, 'holeId');

  // Without an id there is nothing to match on, so the record is kept as-is
  // rather than being collapsed into an unrelated one.
  if (holeId === undefined) return `index:${index}`;

  return [
    String(holeId).trim().toUpperCase(),
    readCoordinate(drillhole, 'x'),
    readCoordinate(drillhole, 'y'),
  ].join('|');
}

/**
 * Collapses records that describe the same hole at the same coordinates.
 *
 * Insertion order is preserved. Where duplicates disagree, an INPROGRESS
 * record wins, so the rig takes the priority the marker rules give it instead
 * of depending on which copy the API happened to return first.
 */
export function dedupeDrillholes<TDrillhole extends DrillholeApiRecord>(
  drillholes: readonly TDrillhole[],
): TDrillhole[] {
  // Guarded at runtime as well as in the types: this sits directly on the
  // path from the network, where an unexpected payload is a real possibility.
  if (!isArrayValue(drillholes)) return [];

  const byKey = new Map<string, TDrillhole>();

  drillholes.forEach((drillhole, index) => {
    const key = buildDedupeKey(drillhole, index);
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, drillhole);
      return;
    }

    if (isInProgressHole(drillhole) && !isInProgressHole(existing)) {
      byKey.set(key, drillhole);
    }
  });

  return [...byKey.values()];
}
