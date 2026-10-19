import type { DrillholeApiRecord } from '../../types/drillhole';
import type { DrillholeProjection, ProjectedDrillhole } from '../../types/map';

const NO_COORDINATES_MESSAGE =
  'The API returned no drillholes with valid UTM coordinates.';
const DEFAULT_ERROR_MESSAGE = 'Unable to load drillholes.';

/** Every state the map data can be in. */
export type MapDataStatus = 'loading' | 'ready' | 'empty' | 'error';

/** Where the drillholes currently on screen came from. */
export type MapDataSource = 'cache' | 'api';

/**
 * The core of a map data state: what to draw and what to say.
 *
 * `message` is always a string, never undefined, so the overlay can render it
 * without a fallback.
 */
export interface LoadedMapDataState {
  status: MapDataStatus;
  drillholes: ProjectedDrillhole[];
  message: string;
}

/**
 * A map data state including the cache-awareness fields.
 *
 * `source` and `isRefreshing` are optional because the plain loaded/failed
 * states deliberately omit them; only the cache flow sets them.
 */
export interface MapDataState extends LoadedMapDataState {
  source?: MapDataSource | null;
  isRefreshing?: boolean;
  /** Set when a background refresh failed but stale data is still usable. */
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
export function projectRecords(
  records: readonly DrillholeApiRecord[],
  project: DrillholeProjection,
): ProjectedDrillhole[] {
  return records
    .map((record) => project(record))
    .filter((drillhole): drillhole is ProjectedDrillhole => drillhole !== null);
}

/**
 * Resolves the state for a successfully fetched dataset.
 *
 * "empty" and "error" are kept distinct: an empty response means the API had
 * nothing, while records that all fail to project means it had data the map
 * cannot place, which is a different problem for the user to act on.
 */
export function resolveLoadedState(
  records: readonly DrillholeApiRecord[],
  project: DrillholeProjection,
): LoadedMapDataState {
  if (records.length === 0) {
    return { status: 'empty', drillholes: [], message: '' };
  }

  const positioned = projectRecords(records, project);
  if (positioned.length === 0) {
    return { status: 'error', drillholes: [], message: NO_COORDINATES_MESSAGE };
  }

  return { status: 'ready', drillholes: positioned, message: '' };
}

export function resolveFailedState(error: Error): LoadedMapDataState {
  return {
    status: 'error',
    drillholes: [],
    message: error.message || DEFAULT_ERROR_MESSAGE,
  };
}

// --- Cache-aware states -------------------------------------------------
//
// resolveLoadedState and resolveFailedState above are left exactly as they
// were; the cache flow composes them rather than changing their shape.
//
// `source` records where the drillholes on screen came from and
// `isRefreshing` whether a slower API request is still in flight behind them.

export const DATA_SOURCES = Object.freeze({
  cache: 'cache',
  api: 'api',
} as const);

/**
 * State for drillholes replayed from the IndexedDB cache.
 *
 * Returns null when the cached records cannot be plotted, so the caller waits
 * for the API instead of flashing an error a refresh is about to fix.
 */
export function resolveCachedState(
  records: readonly DrillholeApiRecord[],
  project: DrillholeProjection,
): MapDataState | null {
  const loaded = resolveLoadedState(records, project);
  if (loaded.status !== 'ready') return null;

  return { ...loaded, source: DATA_SOURCES.cache, isRefreshing: true };
}

export function resolveRefreshedState(
  records: readonly DrillholeApiRecord[],
  project: DrillholeProjection,
): MapDataState {
  return {
    ...resolveLoadedState(records, project),
    source: DATA_SOURCES.api,
    isRefreshing: false,
  };
}

/**
 * Folds a failed API request into whatever is already on screen. Cached
 * drillholes stay visible, because blanking a usable map over a failed
 * background refresh is worse than showing slightly stale data.
 */
export function resolveRefreshFailure(
  currentState: MapDataState | null | undefined,
  error: Error,
): MapDataState {
  if (currentState?.status !== 'ready') return resolveFailedState(error);

  return {
    ...currentState,
    isRefreshing: false,
    refreshMessage: error.message || DEFAULT_ERROR_MESSAGE,
  };
}
