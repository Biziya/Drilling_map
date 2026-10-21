import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { projectRecords, useMapData } from "../../../src/pages/TechnoMap/hooks/useMapData.js";
import { MAP_ID } from "../../../src/pages/TechnoMap/config/technoMapConfig.js";
import { clearMapData, getMapData } from "../../../src/state/mapDataStore.js";
import { clearToasts } from "../../../src/components/Toast/toastStore.js";
import {
  clearCachedDataset,
  writeCachedDataset,
} from "../../../src/services/cache/drillholeCache.js";

// These tests cover backend mode; technoMap.yaml ships with the demo dataset.
vi.mock("../../../src/pages/TechnoMap/config/technoMapConfig.js", async (importOriginal) => {
  const actual = await importOriginal();

  return { ...actual, MAP_CONFIG: { ...actual.MAP_CONFIG, dataSource: "backend" } };
});

const ENDPOINT = "/api/techno-map";
const OTHER_ENDPOINT = "/api/exploration-map";
const OTHER_MAP_ID = "exploration-map";

// Inside the surveyed bounds, so these project onto the map.
const placeable = { holeId: "P-1", x: 418000, y: 4894000 };
const otherPlaceable = { holeId: "P-2", x: 418500, y: 4894500 };
const unplaceable = { holeId: "U-1", x: null, y: "" };

const response = (records, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  text: () => Promise.resolve(JSON.stringify(records)),
});
const respondWith = (records) => () => Promise.resolve(response(records));
const pending = () => new Promise(() => {});
const originalFetch = globalThis.fetch;

// Exercised through a probe component, the way the map page consumes it.
function renderMapData() {
  const seen = [];

  function Probe() {
    seen.push(useMapData());

    return null;
  }

  return { ...render(<Probe />), latest: () => seen[seen.length - 1] };
}

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

beforeEach(async () => {
  clearMapData();
  clearToasts();
  await clearCachedDataset(MAP_ID);
  await clearCachedDataset(OTHER_MAP_ID);
  globalThis.fetch = vi.fn(respondWith([]));
});

afterEach(() => {
  cleanup();
  clearToasts();
  globalThis.fetch = originalFetch;
});

describe("projectRecords", () => {
  it("drops records without usable coordinates", () => {
    expect(projectRecords([placeable, unplaceable]).map(({ holeId }) => holeId)).toEqual(["P-1"]);
  });

  it("returns an empty array for no records", () => {
    expect(projectRecords([])).toEqual([]);
  });
});

describe("useMapData", () => {
  it("uses the techno-map id", () => {
    expect(MAP_ID).toBe("techno-map");
  });

  it("asks this page's own endpoint, never the other page's", async () => {
    globalThis.fetch = vi.fn(respondWith([placeable]));
    renderMapData();
    await settle();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain(ENDPOINT);
    expect(fetch.mock.calls[0][0]).not.toContain(OTHER_ENDPOINT);
  });

  it("stores the data under this page's id only", async () => {
    globalThis.fetch = vi.fn(respondWith([placeable]));
    renderMapData();
    await settle();

    expect(getMapData(MAP_ID).records).toHaveLength(1);
    expect(getMapData(OTHER_MAP_ID).records).toBeNull();
  });

  it("is loading before anything has arrived", () => {
    globalThis.fetch = vi.fn(pending);
    const probe = renderMapData();

    expect(probe.latest().status).toBe("loading");
    expect(probe.latest().isFetching).toBe(true);
    expect(probe.latest().failure).toBeNull();
  });

  it("fetches automatically on mount and becomes ready", async () => {
    globalThis.fetch = vi.fn(respondWith([placeable, otherPlaceable]));
    const probe = renderMapData();

    await settle();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(probe.latest().status).toBe("ready");
    expect(probe.latest().drillholes).toHaveLength(2);
    expect(probe.latest().isFetching).toBe(false);
    expect(probe.latest().failure).toBeNull();
  });

  it("keeps the partially usable records when only some project", async () => {
    globalThis.fetch = vi.fn(respondWith([placeable, unplaceable]));
    const probe = renderMapData();
    await settle();

    expect(probe.latest().status).toBe("ready");
    expect(probe.latest().drillholes.map(({ holeId }) => holeId)).toEqual(["P-1"]);
  });

  it("reports 'empty' when the backend returned nothing", async () => {
    globalThis.fetch = vi.fn(respondWith([]));
    const probe = renderMapData();
    await settle();

    expect(probe.latest().status).toBe("empty");
  });

  // Distinct from 'empty': the backend had data, the map cannot place it.
  it("reports 'unplaceable' when no record has usable coordinates", async () => {
    globalThis.fetch = vi.fn(respondWith([unplaceable]));
    const probe = renderMapData();
    await settle();

    expect(probe.latest().status).toBe("unplaceable");
    expect(probe.latest().drillholes).toEqual([]);
  });

  it("reports 'unavailable' when there is no cache and the backend is unreachable", async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    const probe = renderMapData();

    // A failure settles only after the IndexedDB cache read, so poll for it.
    await waitFor(() => expect(probe.latest().status).toBe("unavailable"));
    expect(probe.latest().isFetching).toBe(false);
    expect(probe.latest().failure).toEqual({ kind: "network", status: undefined });
  });

  it("reports why the backend failed", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(response({ detail: "Database offline" }, { ok: false, status: 500 })));
    const probe = renderMapData();

    await waitFor(() => expect(probe.latest().status).toBe("unavailable"));
    expect(probe.latest().failure).toEqual({ kind: "http", status: 500 });
  });

  it("shows cached drillholes while the backend is still pending", async () => {
    await writeCachedDataset(MAP_ID, [placeable]);
    globalThis.fetch = vi.fn(pending);
    const probe = renderMapData();

    await waitFor(() => expect(probe.latest().status).toBe("ready"));
    expect(probe.latest().drillholes[0].holeId).toBe("P-1");
    expect(probe.latest().isFetching).toBe(true);
  });

  it("ignores the other page's cached dataset", async () => {
    await writeCachedDataset(OTHER_MAP_ID, [placeable]);
    globalThis.fetch = vi.fn(pending);
    const probe = renderMapData();
    await settle();

    expect(probe.latest().status).toBe("loading");
  });

  // Switching pages unmounts the map. The request keeps running and its
  // result is waiting when the page comes back, with no second request.
  it("keeps the request alive across unmount and reuses the result", async () => {
    let resolve;
    globalThis.fetch = vi.fn(() => new Promise((res) => { resolve = res; }));
    const first = renderMapData();
    first.unmount();

    await act(async () => resolve(response([placeable])));
    const second = renderMapData();
    await settle();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(second.latest().status).toBe("ready");
  });

  it("refresh() asks the backend again", async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(response([placeable]))
      .mockResolvedValueOnce(response([placeable, otherPlaceable]));
    const probe = renderMapData();
    await settle();

    act(() => probe.latest().refresh());
    expect(probe.latest().isFetching).toBe(true);
    await settle();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1][0]).toContain(ENDPOINT);
    expect(probe.latest().drillholes).toHaveLength(2);
  });
});
