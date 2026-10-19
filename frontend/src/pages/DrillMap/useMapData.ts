import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  LOADING_STATE,
  resolveCachedState,
  resolveRefreshFailure,
  resolveRefreshedState,
} from './mapDataState';
import type { MapDataState } from './mapDataState';
import {
  readCachedDataset,
  writeCachedDataset,
} from '../../services/cache/drillholeCache';
import type { DatasetId } from '../../services/cache/drillholeCache';
import { isAbortError, toError } from '../../services/Api/apiResponse';
import type { DrillholeApiRecord } from '../../types/drillhole';
import type { DrillholeProjection } from '../../types/map';

/** Fetches one map's dataset, honouring an abort signal. */
export type FetchDrillholeRecords = (
  signal?: AbortSignal,
) => Promise<DrillholeApiRecord[]>;

export interface MapDataOptions {
  fetchRecords: FetchDrillholeRecords;
  project: DrillholeProjection;
  /** Omit to skip the cache entirely and behave like a plain fetch. */
  cacheKey?: DatasetId | undefined;
}

/** Map data state plus a way to ask for it again. */
export type MapData = MapDataState & { reload: () => void };

type SetMapDataState = Dispatch<SetStateAction<MapDataState>>;

interface CacheReplayOptions {
  cacheKey: DatasetId | undefined;
  project: DrillholeProjection;
  isCancelled: () => boolean;
}

interface RefreshOptions extends CacheReplayOptions {
  fetchRecords: FetchDrillholeRecords;
  signal: AbortSignal;
}

// Cache first, then network.
//
// The drillhole endpoints take roughly 5-15 seconds. Rather than holding a
// blank map for that long, whatever was cached last time is drawn immediately
// and then replaced when the API answers.
//
// The cache is only ever an optimisation: a miss, a read failure or a write
// failure all leave the plain fetch-and-render path untouched.
async function showCachedRecords(
  setState: SetMapDataState,
  { cacheKey, project, isCancelled }: CacheReplayOptions,
): Promise<void> {
  if (!cacheKey) return;

  const cached = await readCachedDataset(cacheKey);
  if (!cached || isCancelled()) return;

  const cachedState = resolveCachedState(cached.records, project);
  if (!cachedState) return;

  // Only fills an empty map. If the API has already answered by the time the
  // cache read returns, the fresher data must not be overwritten by it.
  setState((current) => (current.status === 'loading' ? cachedState : current));
}

async function refreshFromApi(
  setState: SetMapDataState,
  { fetchRecords, project, cacheKey, signal, isCancelled }: RefreshOptions,
): Promise<void> {
  try {
    const records = await fetchRecords(signal);
    if (isCancelled()) return;

    setState(resolveRefreshedState(records, project));

    // The complete API response is stored, not the projected or filtered
    // subset the map happens to draw. Deliberately not awaited: the map is
    // already up to date and a slow write should not delay anything.
    void writeCachedDataset(cacheKey, records);
  } catch (error) {
    if (isAbortError(error) || isCancelled()) return;

    const failure = toError(error);
    setState((current) => resolveRefreshFailure(current, failure));
  }
}

/**
 * Loads one map's drillholes, replaying the cache while the API catches up.
 *
 * Both requests start together rather than in sequence, so a slow cache read
 * cannot hold up the request that produces the authoritative data.
 */
export function useMapData({ fetchRecords, project, cacheKey }: MapDataOptions): MapData {
  const [state, setState] = useState<MapDataState>(LOADING_STATE);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const isCancelled = () => cancelled;

    setState(LOADING_STATE);

    void showCachedRecords(setState, { cacheKey, project, isCancelled });
    void refreshFromApi(setState, {
      fetchRecords,
      project,
      cacheKey,
      signal: controller.signal,
      isCancelled,
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [cacheKey, fetchRecords, project, reloadKey]);

  return { ...state, reload };
}
