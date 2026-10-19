// Loads one map's drillholes: cache first, then network.
//
// The drillhole endpoints take roughly 5-15 seconds, so whatever was cached
// last time is drawn immediately and replaced when the API answers. The cache
// is only an optimisation: a miss or a failed read/write leaves the plain
// fetch-and-render path untouched.

import { useCallback, useEffect, useState } from 'react';
import { readCachedDataset, writeCachedDataset } from '../services/cache/drillholeCache';
import { isAbortError, toError } from '../services/api/http';
import type { FetchDrillholeRecords } from '../services/api/mapData';
import type { DrillholeApiRecord } from '../types/drillhole';
import type { DrillholeProjection, MapId, ProjectedDrillhole } from '../types/map';

const NO_COORDINATES_MESSAGE = 'The API returned no drillholes with valid UTM coordinates.';
const DEFAULT_ERROR_MESSAGE = 'Unable to load drillholes.';

export type MapDataStatus = 'loading' | 'ready' | 'empty' | 'error';

export interface MapDataState {
  status: MapDataStatus;
  drillholes: ProjectedDrillhole[];
  /** Always a string, so the overlay can render it without a fallback. */
  message: string;
  /** Where the drillholes on screen came from. */
  source?: 'cache' | 'api' | null;
  /** True while cached data is shown and the API request is still running. */
  isRefreshing?: boolean;
  /** Set when a background refresh failed but cached data is still shown. */
  refreshMessage?: string;
}

export const LOADING_STATE: Readonly<MapDataState> = Object.freeze<MapDataState>({
  status: 'loading',
  drillholes: [],
  message: '',
  source: null,
  isRefreshing: false,
});

/** Projects every record, dropping the ones that cannot be placed. */
export function projectRecords(records: readonly DrillholeApiRecord[], project: DrillholeProjection) {
  return records.map(project).filter((drillhole): drillhole is ProjectedDrillhole => drillhole !== null);
}

/**
 * State for a fetched dataset. "empty" (the API had nothing) and "error"
 * (it had data the map cannot place) are different problems for the user.
 */
export function resolveLoadedState(
  records: readonly DrillholeApiRecord[],
  project: DrillholeProjection,
): MapDataState {
  if (records.length === 0) return { status: 'empty', drillholes: [], message: '' };

  const positioned = projectRecords(records, project);
  if (positioned.length === 0) return { status: 'error', drillholes: [], message: NO_COORDINATES_MESSAGE };

  return { status: 'ready', drillholes: positioned, message: '' };
}

export function resolveFailedState(error: Error): MapDataState {
  return { status: 'error', drillholes: [], message: error.message || DEFAULT_ERROR_MESSAGE };
}

/**
 * Folds a failed API request into what is on screen. Cached drillholes stay
 * visible: blanking a usable map over a failed refresh is worse than stale data.
 */
export function resolveRefreshFailure(current: MapDataState | null | undefined, error: Error): MapDataState {
  if (current?.status !== 'ready') return resolveFailedState(error);

  return { ...current, isRefreshing: false, refreshMessage: error.message || DEFAULT_ERROR_MESSAGE };
}

export interface MapDataOptions {
  fetchRecords: FetchDrillholeRecords;
  project: DrillholeProjection;
  /** Omit to skip the cache entirely and behave like a plain fetch. */
  cacheKey?: MapId | undefined;
}

export type MapData = MapDataState & { reload: () => void };

/**
 * Starts the cache read and the API request together, so a slow cache read
 * cannot hold up the authoritative data.
 */
export function useMapData({ fetchRecords, project, cacheKey }: MapDataOptions): MapData {
  const [state, setState] = useState<MapDataState>(LOADING_STATE);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const isCancelled = () => controller.signal.aborted;

    setState(LOADING_STATE);

    void (async () => {
      const cached = cacheKey ? await readCachedDataset(cacheKey) : null;
      if (!cached || isCancelled()) return;

      const cachedState = resolveLoadedState(cached.records, project);
      if (cachedState.status !== 'ready') return;

      // Only fills an empty map: a late cache read must not overwrite fresher API data.
      setState((current) => (
        current.status === 'loading' ? { ...cachedState, source: 'cache', isRefreshing: true } : current
      ));
    })();

    void (async () => {
      try {
        const records = await fetchRecords(controller.signal);
        if (isCancelled()) return;

        setState({ ...resolveLoadedState(records, project), source: 'api', isRefreshing: false });
        // The complete response is cached, not the subset the map draws. Not
        // awaited: the map is already up to date.
        void writeCachedDataset(cacheKey, records);
      } catch (error) {
        if (isAbortError(error) || isCancelled()) return;

        setState((current) => resolveRefreshFailure(current, toError(error)));
      }
    })();

    return () => controller.abort();
  }, [cacheKey, fetchRecords, project, reloadKey]);

  return { ...state, reload };
}
