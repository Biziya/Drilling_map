// IndexedDB cache for the raw drillhole datasets.
//
// The drillhole endpoints take roughly 5-15 seconds, so the whole API response
// is kept here and replayed on the next visit while the network catches up.
//
// Two rules this module holds to:
//
//   1. It stores the API response verbatim. No filtering, no projecting, no
//      dropping of fields the current map happens not to draw, so a later
//      feature that needs `z` or `maxDepth` finds it already cached.
//   2. It never rejects. A cache is an optimisation, and IndexedDB is missing
//      in private windows, blocked by some browser settings and absent under
//      jsdom. Every failure resolves to "no cached data" so the caller falls
//      back to the network path it would have taken anyway.
//
// Everything read back out is treated as untrusted. A record written by an
// older build is still sitting in the user's browser, so the read path
// validates before handing anything to the projection code.

import { isDrillholeApiRecord } from '../../types/drillhole';
import type { DrillholeApiRecord } from '../../types/drillhole';
import type { MapId } from '../../types/map';

const DATABASE_NAME = 'drilling-map';
const DATABASE_VERSION = 1;
const STORE_NAME = 'drillholeDatasets';
const RECORD_KEY = 'id';

// One record per map, keyed by map id, so the datasets refresh independently.
export const DATASET_IDS = Object.freeze({
  explorationMap: 'exploration-map',
  technoMap: 'techno-map',
} as const satisfies Record<string, MapId>);

/** Key identifying one map's cached dataset. */
export type DatasetId = MapId;

/** A dataset read back out of the cache. */
export interface CachedDataset {
  records: DrillholeApiRecord[];
  /** ISO timestamp of the write, or null when an older build omitted it. */
  updatedAt: string | null;
}

/** Work performed against the object store inside a transaction. */
type StoreWork = (store: IDBObjectStore) => IDBRequest | undefined;

/**
 * Reads the IndexedDB factory.
 *
 * Typed as possibly absent even though `lib.dom` declares it as always
 * present, because private windows and hardened browser settings do remove
 * it and jsdom never had it.
 */
function getIndexedDb(): IDBFactory | null {
  const factory: IDBFactory | undefined = globalThis.indexedDB;

  return factory ?? null;
}

// No caller in src/: the cache is designed to degrade silently, so nothing
// needs to ask first. Used by tests to assert that degradation. Not dead code.
export function isCacheAvailable(): boolean {
  return getIndexedDb() !== null;
}

function openDatabase(): Promise<IDBDatabase | null> {
  const indexedDb = getIndexedDb();
  if (!indexedDb) return Promise.resolve(null);

  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;

    try {
      request = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
    } catch {
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: RECORD_KEY });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    // Fires when another tab holds an older version open. Nothing to recover,
    // so the caller is told there is no cache.
    request.onblocked = () => resolve(null);
  });
}

/**
 * Outcome of a transaction.
 *
 * `ok` is tracked separately from `value` because IndexedDB requests do not
 * all resolve with something. A `delete` resolves with `undefined`, so
 * inferring success from the result value reported every successful clear as
 * a failure; `put` only appeared to work because it happens to resolve with
 * the record key.
 */
interface TransactionOutcome {
  ok: boolean;
  value: unknown;
}

const FAILED: TransactionOutcome = { ok: false, value: null };

/**
 * Runs `work` in a transaction and resolves with its outcome.
 *
 * `value` is `unknown`: it came out of the user's browser storage and has not
 * been validated yet. Every caller narrows it.
 */
function runTransaction(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  work: StoreWork,
): Promise<TransactionOutcome> {
  return new Promise((resolve) => {
    let transaction: IDBTransaction;

    try {
      transaction = database.transaction(STORE_NAME, mode);
    } catch {
      resolve(FAILED);
      return;
    }

    let ok = false;
    let value: unknown = null;

    // Resolving on the transaction rather than the request means a write is
    // only reported as successful once it has actually committed.
    transaction.oncomplete = () => resolve({ ok, value });
    transaction.onerror = () => resolve(FAILED);
    transaction.onabort = () => resolve(FAILED);

    try {
      const request = work(transaction.objectStore(STORE_NAME));

      if (request) {
        request.onsuccess = () => {
          ok = true;
          value = request.result ?? null;
        };
        request.onerror = () => {
          ok = false;
          value = null;
        };
      } else {
        ok = true;
      }
    } catch {
      resolve(FAILED);
    }
  });
}

async function withStore(
  mode: IDBTransactionMode,
  work: StoreWork,
): Promise<TransactionOutcome> {
  const database = await openDatabase();
  if (!database) return FAILED;

  try {
    return await runTransaction(database, mode, work);
  } finally {
    database.close();
  }
}

/** Pulls the record array out of a stored entry, dropping anything unusable. */
function readStoredRecords(stored: unknown): DrillholeApiRecord[] {
  if (typeof stored !== 'object' || stored === null) return [];
  if (!('records' in stored) || !Array.isArray(stored.records)) return [];

  return stored.records.filter(isDrillholeApiRecord);
}

/** Pulls the write timestamp out of a stored entry. */
function readStoredTimestamp(stored: unknown): string | null {
  if (typeof stored !== 'object' || stored === null) return null;
  if (!('updatedAt' in stored) || typeof stored.updatedAt !== 'string') return null;

  return stored.updatedAt;
}

/**
 * Reads a cached dataset.
 *
 * Resolves to null when there is nothing usable cached, so a falsy result
 * always means "go to the network". A record written by an older build, a
 * half-written one and an empty one are all treated as a miss rather than
 * handed to the projection code as a surprise.
 */
export async function readCachedDataset(
  datasetId: DatasetId | null | undefined,
): Promise<CachedDataset | null> {
  if (!datasetId) return null;

  const { value } = await withStore('readonly', (store) => store.get(datasetId));
  const records = readStoredRecords(value);

  if (records.length === 0) return null;

  return {
    records,
    updatedAt: readStoredTimestamp(value),
  };
}

/**
 * Replaces a cached dataset with the full API response.
 *
 * Resolves with whether the write committed. Callers are free to ignore it;
 * a failed cache write must not fail the user's request.
 */
export async function writeCachedDataset(
  datasetId: DatasetId | null | undefined,
  records: DrillholeApiRecord[],
): Promise<boolean> {
  // Checked at runtime as well as in the types: the caller may be untyped
  // JavaScript, and a non-array here would be written and read back as a
  // permanently poisoned cache entry.
  if (!datasetId || !Array.isArray(records)) return false;

  const { ok } = await withStore('readwrite', (store) =>
    store.put({
      [RECORD_KEY]: datasetId,
      records,
      updatedAt: new Date().toISOString(),
    }),
  );

  return ok;
}

// No caller in src/ yet; used by tests and the obvious hook for a
// "clear cached data" action. Not dead code.
export async function clearCachedDataset(
  datasetId: DatasetId | null | undefined,
): Promise<boolean> {
  if (!datasetId) return false;

  const { ok } = await withStore('readwrite', (store) => store.delete(datasetId));

  return ok;
}
