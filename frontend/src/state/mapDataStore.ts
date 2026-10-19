// Each map's drillhole dataset, loaded stale-while-revalidate.
//
// The endpoints take 5-15 seconds, so whatever IndexedDB holds is shown at
// once while the backend is asked for fresh data. The store is module-level:
// switching pages keeps the data, and a request that is still running when
// its page unmounts finishes and lands here instead of being thrown away.
//
// There is at most one request per map at a time. A second load (another
// mount, a refresh click) joins the running one, which is also what stops an
// older response from ever overwriting a newer one.

import { useSyncExternalStore } from 'react';
import { showToast } from '../components/Toast/toastStore';
import { readCachedDataset, writeCachedDataset } from '../services/cache/drillholeCache';
import type { FetchDrillholeRecords } from '../services/api/mapData';
import type { DrillholeApiRecord } from '../types/drillhole';
import type { MapId } from '../types/map';

export const MAP_DATA_MESSAGES = Object.freeze({
  refreshed: 'Map data refreshed successfully',
  staleFallback: 'Backend unavailable. Showing cached data.',
  failed: 'Unable to load map data',
});

export interface MapDataEntry {
  /** Raw records on screen, or null while there is nothing to show. */
  records: readonly DrillholeApiRecord[] | null;
  source: 'cache' | 'api' | null;
  isFetching: boolean;
  /** True when the most recent backend request failed. */
  failed: boolean;
}

const EMPTY_ENTRY: MapDataEntry = Object.freeze({ records: null, source: null, isFetching: false, failed: false });

const entries = new Map<MapId, MapDataEntry>();
const requests = new Map<MapId, Promise<void>>();
const listeners = new Set<() => void>();
// Bumped by clearMapData, so a request started before a reset cannot write after it.
let generation = 0;

export function getMapData(mapId: MapId): MapDataEntry {
  return entries.get(mapId) ?? EMPTY_ENTRY;
}

function update(mapId: MapId, patch: Partial<MapDataEntry>) {
  entries.set(mapId, { ...getMapData(mapId), ...patch });
  listeners.forEach((listener) => listener());
}

/** Draws the cached dataset, unless the backend has already answered. */
async function showCachedData(mapId: MapId, isCurrent: () => boolean) {
  const cached = await readCachedDataset(mapId).catch(() => null);
  if (!cached || !isCurrent() || getMapData(mapId).records) return;

  update(mapId, { records: cached.records, source: 'cache' });
}

async function requestMapData(mapId: MapId, fetchRecords: FetchDrillholeRecords, manual: boolean) {
  const startedIn = generation;
  const isCurrent = () => startedIn === generation;
  const cacheRead = getMapData(mapId).records ? null : showCachedData(mapId, isCurrent);

  update(mapId, { isFetching: true });

  try {
    const records = await fetchRecords();
    if (!isCurrent()) return;

    update(mapId, { records, source: 'api', isFetching: false, failed: false });
    // The complete response is cached, not the subset the map can place.
    void writeCachedDataset(mapId, records);
    if (manual) showToast('success', MAP_DATA_MESSAGES.refreshed);
  } catch {
    // Settled first, so the toast reflects whether cached data made it on screen.
    await cacheRead;
    if (!isCurrent()) return;

    // Whatever is on screen stays there: a failed request never clears the
    // map or the cache.
    update(mapId, { isFetching: false, failed: true });
    if (getMapData(mapId).records) showToast('warning', MAP_DATA_MESSAGES.staleFallback);
    else showToast('error', MAP_DATA_MESSAGES.failed);
  }
}

export interface LoadOptions {
  /** A user-requested refresh: always asks the backend and reports success. */
  manual?: boolean;
}

/**
 * Loads one map's data. Automatic loads ask the backend once per session (or
 * again after a failure); a manual refresh always does. Never rejects:
 * failures become a toast.
 */
export function loadMapData(
  mapId: MapId,
  fetchRecords: FetchDrillholeRecords,
  { manual = false }: LoadOptions = {},
): Promise<void> {
  const running = requests.get(mapId);
  if (running) return running;
  if (!manual && getMapData(mapId).source === 'api') return Promise.resolve();

  const request = requestMapData(mapId, fetchRecords, manual).finally(() => {
    if (requests.get(mapId) === request) requests.delete(mapId);
  });
  requests.set(mapId, request);

  return request;
}

/** Forgets every dataset held in memory. IndexedDB is untouched. */
export function clearMapData(): void {
  generation += 1;
  entries.clear();
  requests.clear();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function useMapDataEntry(mapId: MapId): MapDataEntry {
  return useSyncExternalStore(subscribe, () => getMapData(mapId));
}
