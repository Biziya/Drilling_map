import { useEffect, useMemo } from 'react';
import { MAP_ID } from '../config/drillMapConfig';
import { convertUtmToMapPosition } from '../utils/coordinates';
import { fetchDrillholeMap } from '../../../services/api/mapData';
import { loadMapData, useMapDataEntry } from '../../../state/mapDataStore';
import type { MapDataFailure } from '../../../state/mapDataStore';
import type { DrillholeApiRecord } from '../../../types/drillhole';
import type { MapBounds, ProjectedDrillhole } from '../../../types/map';

/**
 * What the map can show:
 *   loading     - nothing yet, a request is running
 *   ready       - drillholes on screen
 *   empty       - the backend returned no drillholes
 *   unplaceable - drillholes arrived, but none with usable UTM coordinates
 *   unavailable - no cache and the backend request failed
 */
export type MapDataStatus = 'loading' | 'ready' | 'empty' | 'unplaceable' | 'unavailable';

export interface MapData {
  status: MapDataStatus;
  /**
   * Drillholes with usable UTM coordinates, not yet placed: where they land
   * depends on the selected base map's corners (see projectRecords).
   */
  records: DrillholeApiRecord[];
  isFetching: boolean;
  /** Why the last request failed, or null. */
  failure: MapDataFailure | null;
  /** Asks the backend for fresh data, bypassing the cache. */
  refresh: () => void;
}

/** Projects every record onto a base map covering `bounds`, dropping the ones that cannot be placed. */
export function projectRecords(records: readonly DrillholeApiRecord[], bounds?: MapBounds): ProjectedDrillhole[] {
  return records.map((record) => convertUtmToMapPosition(record, bounds)).filter((drillhole) => drillhole !== null);
}

/** Whether a record has coordinates that can be placed at all, on any base map. */
const isPlaceable = (record: DrillholeApiRecord) => convertUtmToMapPosition(record) !== null;

/** This page's drillholes from /api/exploration-map: cache first, then the backend, automatically. */
export function useMapData(): MapData {
  const { records, isFetching, failure } = useMapDataEntry(MAP_ID);

  useEffect(() => {
    void loadMapData(MAP_ID, fetchDrillholeMap);
  }, []);

  const placeable = useMemo(() => (records ?? []).filter(isPlaceable), [records]);

  let status: MapDataStatus = 'ready';
  if (!records) status = failure && !isFetching ? 'unavailable' : 'loading';
  else if (records.length === 0) status = 'empty';
  else if (placeable.length === 0) status = 'unplaceable';

  return {
    status,
    records: placeable,
    isFetching,
    failure,
    refresh: () => void loadMapData(MAP_ID, fetchDrillholeMap, { manual: true }),
  };
}
