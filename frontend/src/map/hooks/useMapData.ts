import { useEffect, useMemo } from 'react';
import { convertUtmToMapPosition } from '../utils/coordinates';
import { loadMapData, useMapDataEntry } from '../../state/mapDataStore';
import type { FetchDrillholeRecords } from '../../services/api/mapData';
import type { DrillholeApiRecord } from '../../types/drillhole';
import type { MapId, ProjectedDrillhole } from '../../types/map';

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
  /** Asks the backend for fresh data, bypassing the cache. */
  refresh: () => void;
}

/** Projects every record, dropping the ones that cannot be placed. */
export function projectRecords(records: readonly DrillholeApiRecord[]): ProjectedDrillhole[] {
  return records.map((record) => convertUtmToMapPosition(record)).filter((drillhole) => drillhole !== null);
}

/** Loads a map's data automatically on mount: cache first, then the backend. */
export function useMapData(mapId: MapId, fetchRecords: FetchDrillholeRecords): MapData {
  const { records, isFetching, failed } = useMapDataEntry(mapId);

  useEffect(() => {
    void loadMapData(mapId, fetchRecords);
  }, [mapId, fetchRecords]);

  const drillholes = useMemo(() => projectRecords(records ?? []), [records]);

  let status: MapDataStatus = 'ready';
  if (!records) status = failed && !isFetching ? 'unavailable' : 'loading';
  else if (records.length === 0) status = 'empty';
  else if (drillholes.length === 0) status = 'unplaceable';

  return {
    status,
    drillholes,
    isFetching,
    refresh: () => void loadMapData(mapId, fetchRecords, { manual: true }),
  };
}
