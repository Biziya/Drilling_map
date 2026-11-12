import { useEffect, useMemo } from 'react';
import { MAP_ID } from '../config/technoMapConfig';
import { convertUtmToMapPosition } from '../utils/coordinates';
import { fetchTechnoMap } from '../../../services/api/mapData';
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
  drillholes: ProjectedDrillhole[];
  isFetching: boolean;
  /** Why the last request failed, or null. */
  failure: MapDataFailure | null;
  /** Reloads from the backend, bypassing the cache. */
  refresh: () => void;
}

/** Projects every record, dropping the ones that cannot be placed. */
export function projectRecords(records: readonly DrillholeApiRecord[], bounds?: MapBounds): ProjectedDrillhole[] {
  return records.map((record) => convertUtmToMapPosition(record, bounds)).filter((drillhole) => drillhole !== null);
}

/**
 * This page's drillholes from /api/techno-map: cache first, then the backend.
 * Holes are placed on the base map whose UTM corners are `bounds`.
 */
export function useMapData(bounds?: MapBounds): MapData {
  const { records, isFetching, failure } = useMapDataEntry(MAP_ID);

  useEffect(() => {
    void loadMapData(MAP_ID, fetchTechnoMap);
  }, []);

  const drillholes = useMemo(() => projectRecords(records ?? [], bounds), [records, bounds]);

  let status: MapDataStatus = 'ready';
  if (!records) status = failure && !isFetching ? 'unavailable' : 'loading';
  else if (records.length === 0) status = 'empty';
  else if (drillholes.length === 0) status = 'unplaceable';

  return {
    status,
    drillholes,
    isFetching,
    failure,
    refresh: () => void loadMapData(MAP_ID, fetchTechnoMap, { manual: true }),
  };
}
