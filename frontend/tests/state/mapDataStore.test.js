import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import {
  MAP_DATA_MESSAGES,
  clearMapData,
  getMapData,
  loadMapData,
} from "../../src/state/mapDataStore.js";
import { clearToasts, useToasts } from "../../src/components/Toast/toastStore.js";
import {
  clearCachedDataset,
  readCachedDataset,
  writeCachedDataset,
} from "../../src/services/cache/drillholeCache.js";
import { renderHook } from "@testing-library/react";
import { ApiError } from "../../src/services/api/http.js";

const MAP_ID = "exploration-map";
const cachedRecord = { holeId: "CACHED", x: 418000, y: 4894000 };
const apiRecord = { holeId: "FRESH-1", x: 418500, y: 4894500 };
const newerRecord = { holeId: "FRESH-2", x: 419000, y: 4895000 };

// A promise resolved by hand, so the window where only cached data is on
// screen can be observed rather than raced past.
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

const NETWORK = { kind: "network" };
const offline = () => Promise.reject(new ApiError("network", "Unable to connect to the drillhole API."));

const toasts = () => renderHook(() => useToasts()).result.current;
const toastTexts = () => toasts().map(({ type, message }) => `${type}: ${message}`);

// IndexedDB settles on macrotasks, so wait for the condition, not a tick count.
const waitUntil = (predicate) => vi.waitFor(() => expect(predicate()).toBe(true));

beforeEach(async () => {
  clearMapData();
  clearToasts();
  await clearCachedDataset(MAP_ID);
});

afterEach(() => {
  clearToasts();
});

describe("mapDataStore", () => {
  describe("automatic loading", () => {
    it("starts empty and fetching, then shows the backend records", async () => {
      const fetchRecords = vi.fn(() => Promise.resolve([apiRecord]));
      const load = loadMapData(MAP_ID, fetchRecords);

      expect(getMapData(MAP_ID).isFetching).toBe(true);
      expect(getMapData(MAP_ID).records).toBeNull();

      await load;

      expect(fetchRecords).toHaveBeenCalledTimes(1);
      expect(getMapData(MAP_ID)).toMatchObject({
        records: [apiRecord],
        source: "api",
        isFetching: false,
        failure: null,
      });
    });

    it("saves the complete backend response to IndexedDB", async () => {
      const records = [apiRecord, newerRecord];
      await loadMapData(MAP_ID, () => Promise.resolve(records));

      await vi.waitFor(async () => {
        expect((await readCachedDataset(MAP_ID)).records).toEqual(records);
      });
    });

    it("does not toast a successful automatic load", async () => {
      await loadMapData(MAP_ID, () => Promise.resolve([apiRecord]));

      expect(toasts()).toEqual([]);
    });

    it("shows cached data first and keeps it visible until the backend answers", async () => {
      await writeCachedDataset(MAP_ID, [cachedRecord]);
      const pending = deferred();
      const load = loadMapData(MAP_ID, () => pending.promise);

      await waitUntil(() => getMapData(MAP_ID).source === "cache");
      expect(getMapData(MAP_ID).records).toEqual([cachedRecord]);
      expect(getMapData(MAP_ID).isFetching).toBe(true);

      pending.resolve([apiRecord]);
      await load;

      expect(getMapData(MAP_ID).records).toEqual([apiRecord]);
      expect(getMapData(MAP_ID).source).toBe("api");
    });

    it("never lets a late cache read overwrite backend data", async () => {
      await writeCachedDataset(MAP_ID, [cachedRecord]);
      await loadMapData(MAP_ID, () => Promise.resolve([apiRecord]));

      // Give the cache read every chance to land after the response.
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(getMapData(MAP_ID).records).toEqual([apiRecord]);
    });

    it("does not ask the backend again once it has answered this session", async () => {
      const fetchRecords = vi.fn(() => Promise.resolve([apiRecord]));

      await loadMapData(MAP_ID, fetchRecords);
      await loadMapData(MAP_ID, fetchRecords);

      expect(fetchRecords).toHaveBeenCalledTimes(1);
    });

    it("joins a request that is already running instead of starting another", async () => {
      const pending = deferred();
      const fetchRecords = vi.fn(() => pending.promise);

      const first = loadMapData(MAP_ID, fetchRecords);
      const second = loadMapData(MAP_ID, fetchRecords);
      const manual = loadMapData(MAP_ID, fetchRecords, { manual: true });

      expect(second).toBe(first);
      expect(manual).toBe(first);
      expect(fetchRecords).toHaveBeenCalledTimes(1);

      pending.resolve([apiRecord]);
      await first;
    });

    it("discards a response that arrives after the store was reset", async () => {
      const pending = deferred();
      const load = loadMapData(MAP_ID, () => pending.promise);

      clearMapData();
      pending.resolve([apiRecord]);
      await load;

      expect(getMapData(MAP_ID).records).toBeNull();
    });
  });

  describe("backend failures", () => {
    it("keeps cached data on screen and warns", async () => {
      await writeCachedDataset(MAP_ID, [cachedRecord]);

      await loadMapData(MAP_ID, offline);

      expect(getMapData(MAP_ID)).toMatchObject({
        records: [cachedRecord],
        source: "cache",
        isFetching: false,
        failure: NETWORK,
      });
      expect(toastTexts()).toEqual([`warning: ${MAP_DATA_MESSAGES.showingCached(NETWORK)}`]);
    });

    it("does not delete the IndexedDB copy", async () => {
      await writeCachedDataset(MAP_ID, [cachedRecord]);

      await loadMapData(MAP_ID, offline);

      expect((await readCachedDataset(MAP_ID)).records).toEqual([cachedRecord]);
    });

    it("raises an error toast when there is no cache either", async () => {
      await loadMapData(MAP_ID, offline);

      expect(getMapData(MAP_ID)).toMatchObject({ records: null, isFetching: false, failure: NETWORK });
      expect(toastTexts()).toEqual([`error: ${MAP_DATA_MESSAGES.failed}`]);
    });

    it("tries the backend again on the next automatic load", async () => {
      const fetchRecords = vi.fn()
        .mockRejectedValueOnce(new ApiError("network", "down"))
        .mockResolvedValueOnce([apiRecord]);

      await loadMapData(MAP_ID, fetchRecords);
      await loadMapData(MAP_ID, fetchRecords);

      expect(fetchRecords).toHaveBeenCalledTimes(2);
      expect(getMapData(MAP_ID)).toMatchObject({ records: [apiRecord], failure: null });
    });
  });

  describe("manual refresh", () => {
    it("asks the backend even when data is already fresh", async () => {
      const fetchRecords = vi.fn()
        .mockResolvedValueOnce([apiRecord])
        .mockResolvedValueOnce([newerRecord]);

      await loadMapData(MAP_ID, fetchRecords);
      await loadMapData(MAP_ID, fetchRecords, { manual: true });

      expect(fetchRecords).toHaveBeenCalledTimes(2);
      expect(getMapData(MAP_ID).records).toEqual([newerRecord]);
    });

    it("updates IndexedDB and confirms with a success toast", async () => {
      await loadMapData(MAP_ID, () => Promise.resolve([newerRecord]), { manual: true });

      expect(toastTexts()).toEqual([`success: ${MAP_DATA_MESSAGES.refreshed}`]);
      await vi.waitFor(async () => {
        expect((await readCachedDataset(MAP_ID)).records).toEqual([newerRecord]);
      });
    });

    it("keeps the current data when it fails", async () => {
      await loadMapData(MAP_ID, () => Promise.resolve([apiRecord]));

      await loadMapData(MAP_ID, offline, { manual: true });

      expect(getMapData(MAP_ID)).toMatchObject({ records: [apiRecord], source: "api", failure: NETWORK });
      expect(toastTexts()).toEqual([`warning: ${MAP_DATA_MESSAGES.showingCached(NETWORK)}`]);
    });
  });

  describe("failure messages", () => {
    beforeEach(async () => {
      await writeCachedDataset(MAP_ID, [cachedRecord]);
    });

    it.each([
      ["network", new ApiError("network", "x"), "Backend unavailable. Showing cached data."],
      ["timeout", new ApiError("timeout", "x"), "Backend did not respond in time. Showing cached data."],
      ["http", new ApiError("http", "x", { status: 500 }), "Backend error (HTTP 500). Showing cached data."],
      ["invalid-response", new ApiError("invalid-response", "x"), "Backend sent invalid data. Showing cached data."],
      ["unexpected", new Error("bug"), "Unexpected error while loading. Showing cached data."],
    ])("describes a %s failure accurately", async (_kind, error, message) => {
      await loadMapData(MAP_ID, () => Promise.reject(error));

      expect(toastTexts()).toEqual([`warning: ${message}`]);
    });

    it("records why the request failed", async () => {
      await loadMapData(MAP_ID, () => Promise.reject(new ApiError("http", "x", { status: 503 })));

      expect(getMapData(MAP_ID).failure).toEqual({ kind: "http", status: 503 });
    });

    it("stays quiet when an automatic retry fails the same way again", async () => {
      await loadMapData(MAP_ID, offline);
      clearToasts();

      await loadMapData(MAP_ID, offline);

      expect(toasts()).toEqual([]);
    });

    it("speaks up when an automatic retry fails differently", async () => {
      await loadMapData(MAP_ID, offline);
      clearToasts();

      await loadMapData(MAP_ID, () => Promise.reject(new ApiError("http", "x", { status: 500 })));

      expect(toastTexts()).toEqual(["warning: Backend error (HTTP 500). Showing cached data."]);
    });

    it("always answers a manual refresh, even with a repeated failure", async () => {
      await loadMapData(MAP_ID, offline);
      clearToasts();

      await loadMapData(MAP_ID, offline, { manual: true });

      expect(toastTexts()).toEqual([`warning: ${MAP_DATA_MESSAGES.showingCached(NETWORK)}`]);
    });
  });
});
