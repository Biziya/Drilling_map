// Which drillholes and layers the 12 map filters let through.
//
//   ordinary hole    -> shown when its type (the API category) is checked
//   no category      -> never shown: an unmapped SQL Type belongs to no filter
//   in-progress hole -> shown (as a rig) when its type AND Drilling in progress
//                       are checked; never downgraded to its type's symbol
//   deviation line   -> shown when Deviation line is checked and its hole is shown

import { FILTER_IDS } from '../config/technoMapConfig';
import type { DrillholeType, FilterId } from '../config/technoMapConfig';
import type { MarkerFeature } from './markerLayer';
import { resolveDrillholeType } from './markerKind';
import { isInProgressHole } from '../../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../../types/drillhole';

export type MapFilters = Readonly<Record<FilterId, boolean>>;

/** Every filter set to `visible`. */
export function setAllFilters(visible: boolean): MapFilters {
  return Object.fromEntries(FILTER_IDS.map((id) => [id, visible])) as MapFilters;
}

export const ALL_VISIBLE: MapFilters = Object.freeze(setAllFilters(true));

/** Reads a stored selection, defaulting any missing or malformed entry to visible. */
export function parseFilters(stored: unknown): MapFilters {
  const record = typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {};

  return Object.fromEntries(
    FILTER_IDS.map((id) => [id, typeof record[id] === 'boolean' ? record[id] : true]),
  ) as MapFilters;
}

/** The rule itself, on a hole's already-resolved type and status. */
function passes(type: DrillholeType | null, isInProgress: boolean, filters: MapFilters): boolean {
  if (!type || !filters[type]) return false;

  return !isInProgress || filters['drilling-in-progress'];
}

export function isDrillholeShown(drillhole: DrillholeApiRecord, filters: MapFilters): boolean {
  return passes(resolveDrillholeType(drillhole), isInProgressHole(drillhole), filters);
}

/** The features the filters let through, from the per-dataset list (markerLayer.ts). */
export function selectShownFeatures(features: readonly MarkerFeature[], filters: MapFilters): MarkerFeature[] {
  return features.filter(({ type, isInProgress }) => passes(type, isInProgress, filters));
}
