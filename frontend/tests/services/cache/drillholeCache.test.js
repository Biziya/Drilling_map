import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import {
  DATASET_IDS,
  clearCachedDataset,
  isCacheAvailable,
  readCachedDataset,
  writeCachedDataset,
} from "../../../src/services/cache/drillholeCache.js";

// A record carrying every field the brief lists, so a regression that stores
// only the fields the map currently draws is caught here.
const FULL_RECORD = {
  holeId: "GTZO-00125",
  coordinateType: "Drilled",
  x: 418000,
  y: 4894000,
  z: 312.4,
  year: 2025,
  campaign: "Infill Campaign 2025",
  gt: 0.18,
  maxDepth: 240.5,
  azimuth: 45,
  finalDeviation: 25,
  holePurpose: "Producer",
  holeStatus: "DONE",
};

beforeEach(async () => {
  await clearCachedDataset(DATASET_IDS.explorationMap);
  await clearCachedDataset(DATASET_IDS.technoMap);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("drillholeCache", () => {
  it("reports the cache as available when IndexedDB exists", () => {
    expect(isCacheAvailable()).toBe(true);
  });

  it("returns null for a dataset it has never stored", async () => {
    expect(await readCachedDataset(DATASET_IDS.explorationMap)).toBeNull();
  });

  it("round-trips a dataset", async () => {
    expect(await writeCachedDataset(DATASET_IDS.explorationMap, [FULL_RECORD])).toBe(true);

    const cached = await readCachedDataset(DATASET_IDS.explorationMap);

    expect(cached.records).toHaveLength(1);
  });

  // The whole point of the cache: a later feature that needs `z` or `maxDepth`
  // must find it already there.
  it("stores every field the API returned, not just the plotted ones", async () => {
    await writeCachedDataset(DATASET_IDS.explorationMap, [FULL_RECORD]);

    const cached = await readCachedDataset(DATASET_IDS.explorationMap);

    expect(cached.records[0]).toEqual(FULL_RECORD);
  });

  it("stamps the write so staleness can be judged later", async () => {
    await writeCachedDataset(DATASET_IDS.explorationMap, [FULL_RECORD]);

    const cached = await readCachedDataset(DATASET_IDS.explorationMap);

    expect(Number.isNaN(Date.parse(cached.updatedAt))).toBe(false);
  });

  it("keeps the two maps' datasets apart", async () => {
    await writeCachedDataset(DATASET_IDS.explorationMap, [FULL_RECORD]);
    await writeCachedDataset(DATASET_IDS.technoMap, [FULL_RECORD, FULL_RECORD]);

    expect((await readCachedDataset(DATASET_IDS.explorationMap)).records).toHaveLength(1);
    expect((await readCachedDataset(DATASET_IDS.technoMap)).records).toHaveLength(2);
  });

  it("replaces a dataset rather than appending to it", async () => {
    await writeCachedDataset(DATASET_IDS.explorationMap, [FULL_RECORD, FULL_RECORD]);
    await writeCachedDataset(DATASET_IDS.explorationMap, [FULL_RECORD]);

    expect((await readCachedDataset(DATASET_IDS.explorationMap)).records).toHaveLength(1);
  });

  it("clears a dataset", async () => {
    await writeCachedDataset(DATASET_IDS.explorationMap, [FULL_RECORD]);
    await clearCachedDataset(DATASET_IDS.explorationMap);

    expect(await readCachedDataset(DATASET_IDS.explorationMap)).toBeNull();
  });

  // An empty array is indistinguishable from "nothing useful cached", and
  // treating it as a hit would leave an empty map on screen.
  it("treats an empty dataset as a miss", async () => {
    await writeCachedDataset(DATASET_IDS.explorationMap, []);

    expect(await readCachedDataset(DATASET_IDS.explorationMap)).toBeNull();
  });

  it("refuses a non-array payload", async () => {
    expect(await writeCachedDataset(DATASET_IDS.explorationMap, { records: [] })).toBe(false);
    expect(await writeCachedDataset(DATASET_IDS.explorationMap, null)).toBe(false);
  });

  it("ignores a missing dataset id", async () => {
    expect(await writeCachedDataset(undefined, [FULL_RECORD])).toBe(false);
    expect(await readCachedDataset(undefined)).toBeNull();
    expect(await clearCachedDataset(undefined)).toBe(false);
  });

  // The cache is an optimisation. Private windows and blocked storage must
  // degrade to "no cache", never to a rejected promise.
  describe("when IndexedDB is unavailable", () => {
    let saved;

    beforeEach(() => {
      saved = globalThis.indexedDB;
      delete globalThis.indexedDB;
    });

    afterEach(() => {
      globalThis.indexedDB = saved;
    });

    it("reports the cache as unavailable", () => {
      expect(isCacheAvailable()).toBe(false);
    });

    it("resolves a read to null instead of throwing", async () => {
      await expect(readCachedDataset(DATASET_IDS.explorationMap)).resolves.toBeNull();
    });

    it("resolves a write to false instead of throwing", async () => {
      await expect(writeCachedDataset(DATASET_IDS.explorationMap, [FULL_RECORD]))
        .resolves.toBe(false);
    });
  });

  describe("when opening the database throws", () => {
    beforeEach(() => {
      vi.spyOn(globalThis.indexedDB, "open").mockImplementation(() => {
        throw new Error("Storage blocked by browser settings");
      });
    });

    it("still resolves a read to null", async () => {
      await expect(readCachedDataset(DATASET_IDS.explorationMap)).resolves.toBeNull();
    });

    it("still resolves a write to false", async () => {
      await expect(writeCachedDataset(DATASET_IDS.explorationMap, [FULL_RECORD]))
        .resolves.toBe(false);
    });
  });
});
