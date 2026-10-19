import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { useMapData } from "../../../src/pages/DrillMap/useMapData.js";
import {
  DATASET_IDS,
  clearCachedDataset,
  readCachedDataset,
  writeCachedDataset,
} from "../../../src/services/cache/drillholeCache.js";

const CACHE_KEY = DATASET_IDS.explorationMap;

const cachedRecord = { holeId: "CACHED", x: 418000, y: 4894000, z: 300, maxDepth: 120 };
const apiRecord = { holeId: "FRESH-1", x: 418500, y: 4894500, z: 301, maxDepth: 130 };
const otherApiRecord = { holeId: "FRESH-2", x: 419000, y: 4895000, z: 302, maxDepth: 140 };

// Stands in for the UTM projection: passes records through with map positions.
const project = (record) => ({ ...record, xPercent: 10, yPercent: 20 });

// A promise the test resolves by hand, so the window where only cached data is
// on screen can actually be observed rather than raced past.
function deferred() {
  let resolveIt;
  let rejectIt;
  const promise = new Promise((resolve, reject) => {
    resolveIt = resolve;
    rejectIt = reject;
  });

  return { promise, resolve: resolveIt, reject: rejectIt };
}

// The hook is exercised through a probe component rather than a renderHook
// helper, to keep the test tied to how the pages actually consume it.
function renderMapData(options) {
  const seen = [];

  function Probe() {
    seen.push(useMapData(options));

    return null;
  }

  const result = render(<Probe />);

  return { ...result, seen, latest: () => seen[seen.length - 1] };
}

const flush = () => act(async () => { await Promise.resolve(); });

// IndexedDB settles on macrotasks, so a microtask flush is not enough to see
// the cached data arrive. Waiting on the condition keeps the test from
// depending on how many ticks a cache read happens to take.
const waitForState = (probe, predicate) => waitFor(() => {
  expect(predicate(probe.latest())).toBe(true);
});

beforeEach(async () => {
  await clearCachedDataset(CACHE_KEY);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useMapData", () => {
  describe("with no cached data", () => {
    it("loads, then shows the API records", async () => {
      const fetchRecords = vi.fn(() => Promise.resolve([apiRecord]));
      const probe = renderMapData({ fetchRecords, project, cacheKey: CACHE_KEY });

      expect(probe.seen[0].status).toBe("loading");

      await flush();

      expect(probe.latest().status).toBe("ready");
      expect(probe.latest().drillholes).toHaveLength(1);
      expect(probe.latest().source).toBe("api");
    });

    it("saves the complete API response to the cache", async () => {
      const records = [apiRecord, otherApiRecord];
      const fetchRecords = vi.fn(() => Promise.resolve(records));
      renderMapData({ fetchRecords, project, cacheKey: CACHE_KEY });

      await waitFor(async () => {
        const cached = await readCachedDataset(CACHE_KEY);
        expect(cached.records).toEqual(records);
      });
    });

    it("reports an error when the API fails", async () => {
      const fetchRecords = vi.fn(() => Promise.reject(new Error("Database offline")));
      const probe = renderMapData({ fetchRecords, project, cacheKey: CACHE_KEY });

      await flush();

      expect(probe.latest().status).toBe("error");
      expect(probe.latest().message).toBe("Database offline");
    });
  });

  describe("with cached data", () => {
    beforeEach(async () => {
      await writeCachedDataset(CACHE_KEY, [cachedRecord]);
    });

    // The point of the whole exercise: drillholes on screen before the slow
    // request finishes.
    it("shows cached drillholes before the API answers", async () => {
      const pending = deferred();
      const probe = renderMapData({
        fetchRecords: () => pending.promise,
        project,
        cacheKey: CACHE_KEY,
      });

      await waitForState(probe, (state) => state.source === "cache");

      expect(probe.latest().status).toBe("ready");
      expect(probe.latest().drillholes[0].holeId).toBe("CACHED");
      expect(probe.latest().isRefreshing).toBe(true);

      await act(async () => {
        pending.resolve([apiRecord]);
        await pending.promise;
      });

      expect(probe.latest().source).toBe("api");
      expect(probe.latest().drillholes[0].holeId).toBe("FRESH-1");
      expect(probe.latest().isRefreshing).toBe(false);
    });

    it("replaces the cache with the newer API response", async () => {
      renderMapData({
        fetchRecords: () => Promise.resolve([apiRecord]),
        project,
        cacheKey: CACHE_KEY,
      });

      await waitFor(async () => {
        const cached = await readCachedDataset(CACHE_KEY);
        expect(cached.records).toEqual([apiRecord]);
      });
    });

    // Blanking a usable map because a background refresh failed is worse than
    // showing slightly stale data.
    it("keeps cached drillholes on screen when the refresh fails", async () => {
      const pending = deferred();
      const probe = renderMapData({
        fetchRecords: () => pending.promise,
        project,
        cacheKey: CACHE_KEY,
      });

      await waitForState(probe, (state) => state.source === "cache");

      await act(async () => {
        pending.reject(new Error("Database offline"));
        await pending.promise.catch(() => {});
      });

      expect(probe.latest().status).toBe("ready");
      expect(probe.latest().drillholes[0].holeId).toBe("CACHED");
      expect(probe.latest().isRefreshing).toBe(false);
      expect(probe.latest().refreshMessage).toBe("Database offline");
    });

    // A cache read that lands after the network response must not put stale
    // data back on screen.
    it("does not overwrite fresher API data with a late cache read", async () => {
      const probe = renderMapData({
        fetchRecords: () => Promise.resolve([apiRecord]),
        project,
        cacheKey: CACHE_KEY,
      });

      await waitForState(probe, (state) => state.source === "api");
      // Give a late cache read every chance to clobber it.
      await flush();
      await flush();

      expect(probe.latest().source).toBe("api");
      expect(probe.latest().drillholes[0].holeId).toBe("FRESH-1");
    });
  });

  describe("without a cache key", () => {
    it("behaves like a plain fetch", async () => {
      const fetchRecords = vi.fn(() => Promise.resolve([apiRecord]));
      const probe = renderMapData({ fetchRecords, project });

      await flush();

      expect(probe.latest().status).toBe("ready");
      expect(probe.latest().source).toBe("api");
    });
  });

  it("aborts the request on unmount", async () => {
    const fetchRecords = vi.fn(() => new Promise(() => {}));
    const probe = renderMapData({ fetchRecords, project, cacheKey: CACHE_KEY });
    const [signal] = fetchRecords.mock.calls[0];

    expect(signal.aborted).toBe(false);

    probe.unmount();

    expect(signal.aborted).toBe(true);
  });
});
