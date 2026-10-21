import { useEffect, useMemo, useState } from 'react';
import { MAP_CONFIG, MAP_ID } from '../config/technoMapConfig';
import { MOCK_CELLS, MOCK_DRILLHOLES } from '../mock/mockData';
import type { TechnoCell } from '../mock/mockData';
import { convertUtmToMapPosition } from '../utils/coordinates';
import { showToast } from '../../../components/Toast/toastStore';
import { fetchTechnoMap } from '../../../services/api/mapData';
import { MAP_DATA_MESSAGES, loadMapData, useMapDataEntry } from '../../../state/mapDataStore';
import type { MapDataFailure } from '../../../state/mapDataStore';
import type { DrillholeApiRecord } from '../../../types/drillhole';
import type { ProjectedDrillhole } from '../../../types/map';

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
  /** Technological cell outlines. Only the demo dataset has them; the API does not. */
  cells: readonly TechnoCell[];
  isFetching: boolean;
  /** Why the last request failed, or null. */
  failure: MapDataFailure | null;
  /** True while showing the fixed demo dataset instead of backend data. */
  isDemo: boolean;
  /** Reloads the data: the backend, bypassing the cache, or the demo dataset. */
  refresh: () => void;
}

/** Long enough for the refresh icon to visibly turn while the demo data reloads. */
const DEMO_RELOAD_MS = 500;
const NO_CELLS: readonly TechnoCell[] = Object.freeze([]);

/** Projects every record, dropping the ones that cannot be placed. */
export function projectRecords(records: readonly DrillholeApiRecord[]): ProjectedDrillhole[] {
  return records.map((record) => convertUtmToMapPosition(record)).filter((drillhole) => drillhole !== null);
}

/**
 * This page's drillholes. Backend mode: /api/techno-map, cache first, then the
 * backend, automatically. Mock mode: the fixed demo dataset, with no request
 * and nothing written to IndexedDB.
 */
export function useMapData(): MapData {
  const isDemo = MAP_CONFIG.dataSource === 'mock';
  const { records, isFetching, failure } = useMapDataEntry(MAP_ID);
  const [isReloadingDemo, setIsReloadingDemo] = useState(false);

  useEffect(() => {
    if (!isDemo) void loadMapData(MAP_ID, fetchTechnoMap);
  }, [isDemo]);

  const activeRecords = isDemo ? MOCK_DRILLHOLES : records;
  const drillholes = useMemo(() => projectRecords(activeRecords ?? []), [activeRecords]);

  if (isDemo) {
    return {
      status: drillholes.length ? 'ready' : 'unplaceable',
      drillholes,
      cells: MOCK_CELLS,
      isFetching: isReloadingDemo,
      failure: null,
      isDemo,
      // The dataset is a constant, so reloading it changes nothing on screen:
      // positions, filters, view and measurement all stay put.
      refresh: () => {
        if (isReloadingDemo) return;
        setIsReloadingDemo(true);
        window.setTimeout(() => {
          setIsReloadingDemo(false);
          showToast('success', MAP_DATA_MESSAGES.refreshed);
        }, DEMO_RELOAD_MS);
      },
    };
  }

  let status: MapDataStatus = 'ready';
  if (!records) status = failure && !isFetching ? 'unavailable' : 'loading';
  else if (records.length === 0) status = 'empty';
  else if (drillholes.length === 0) status = 'unplaceable';

  return {
    status,
    drillholes,
    cells: NO_CELLS,
    isFetching,
    failure,
    isDemo,
    refresh: () => void loadMapData(MAP_ID, fetchTechnoMap, { manual: true }),
  };
}
