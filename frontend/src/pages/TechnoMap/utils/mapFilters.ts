// Which drillholes and layers the 12 map filters let through.
//
//   ordinary hole    -> shown when its type (the API category) is checked
//   no category      -> never shown: an unmapped SQL Type belongs to no filter
//   in-progress hole -> shown (as a rig) when its type AND Drilling in progress
//                       are checked; never downgraded to its type's symbol
//   deviation line   -> shown when Deviation line is checked and its hole is shown

import { FILTER_IDS } from '../config/technoMapConfig';
import type { FilterId } from '../config/technoMapConfig';
import { projectDrillholes } from './coordinates';
import type { ProjectedDrillholeFeature } from './coordinates';
import { resolveDrillholeType } from './markerKind';
import { dedupeDrillholes } from '../../../utils/dedupeDrillholes';
import { isInProgressHole } from '../../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../../types/drillhole';
import type { ProjectedDrillhole } from '../../../types/map';

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

export function isDrillholeShown(drillhole: DrillholeApiRecord, filters: MapFilters): boolean {
  const type = resolveDrillholeType(drillhole);
  if (!type || !filters[type]) return false;

  return !isInProgressHole(drillhole) || filters['drilling-in-progress'];
}

/** One feature per hole (deduplicated, deviation projected), filtered. */
export function selectShownFeatures(
  drillholes: readonly ProjectedDrillhole[],
  filters: MapFilters,
): ProjectedDrillholeFeature[] {
  return projectDrillholes(dedupeDrillholes(drillholes)).filter(({ drillhole }) => isDrillholeShown(drillhole, filters));
}
