import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { projectRecords, useMapData } from "../../../src/map/hooks/useMapData.js";
import { clearMapData } from "../../../src/state/mapDataStore.js";
import { clearToasts } from "../../../src/components/Toast/toastStore.js";
import {
  clearCachedDataset,
  writeCachedDataset,
} from "../../../src/services/cache/drillholeCache.js";

const MAP_ID = "techno-map";
// Inside the surveyed bounds, so these project onto the map.
const placeable = { holeId: "P-1", x: 418000, y: 4894000 };
const otherPlaceable = { holeId: "P-2", x: 418500, y: 4894500 };
const unplaceable = { holeId: "U-1", x: null, y: "" };

// Exercised through a probe component, the way the map page consumes it.
function renderMapData(fetchRecords) {
  const seen = [];

  function Probe() {
    seen.push(useMapData(MAP_ID, fetchRecords));

    return null;
  }

  return { ...render(<Probe />), latest: () => seen[seen.length - 1] };
}

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

beforeEach(async () => {
  clearMapData();
  clearToasts();
  await clearCachedDataset(MAP_ID);
});

afterEach(() => {
  cleanup();
  clearToasts();
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
  it("is loading before anything has arrived", () => {
    const probe = renderMapData(() => new Promise(() => {}));

    expect(probe.latest().status).toBe("loading");
    expect(probe.latest().isFetching).toBe(true);
  });

  it("fetches automatically on mount and becomes ready", async () => {
    const fetchRecords = vi.fn(() => Promise.resolve([placeable, otherPlaceable]));
    const probe = renderMapData(fetchRecords);

    await settle();

    expect(fetchRecords).toHaveBeenCalledTimes(1);
    expect(probe.latest().status).toBe("ready");
    expect(probe.latest().drillholes).toHaveLength(2);
    expect(probe.latest().isFetching).toBe(false);
  });

  it("keeps the partially usable records when only some project", async () => {
    const probe = renderMapData(() => Promise.resolve([placeable, unplaceable]));
    await settle();

    expect(probe.latest().status).toBe("ready");
    expect(probe.latest().drillholes.map(({ holeId }) => holeId)).toEqual(["P-1"]);
  });

  it("reports 'empty' when the backend returned nothing", async () => {
    const probe = renderMapData(() => Promise.resolve([]));
    await settle();

    expect(probe.latest().status).toBe("empty");
  });

  // Distinct from 'empty': the backend had data, the map cannot place it.
  it("reports 'unplaceable' when no record has usable coordinates", async () => {
    const probe = renderMapData(() => Promise.resolve([unplaceable]));
    await settle();

    expect(probe.latest().status).toBe("unplaceable");
    expect(probe.latest().drillholes).toEqual([]);
  });

  it("reports 'unavailable' when there is no cache and the backend fails", async () => {
    const probe = renderMapData(() => Promise.reject(new Error("Database offline")));
    await settle();

    expect(probe.latest().status).toBe("unavailable");
    expect(probe.latest().isFetching).toBe(false);
  });

  it("shows cached drillholes while the backend is still pending", async () => {
    await writeCachedDataset(MAP_ID, [placeable]);
    const probe = renderMapData(() => new Promise(() => {}));

    await waitFor(() => expect(probe.latest().status).toBe("ready"));
    expect(probe.latest().drillholes[0].holeId).toBe("P-1");
    expect(probe.latest().isFetching).toBe(true);
  });

  // Switching pages unmounts the map. The request keeps running and its
  // result is waiting when the page comes back, with no second request.
  it("keeps the request alive across unmount and reuses the result", async () => {
    let resolve;
    const fetchRecords = vi.fn(() => new Promise((res) => { resolve = res; }));
    const first = renderMapData(fetchRecords);
    first.unmount();

    await act(async () => resolve([placeable]));
    const second = renderMapData(fetchRecords);
    await settle();

    expect(fetchRecords).toHaveBeenCalledTimes(1);
    expect(second.latest().status).toBe("ready");
  });

  it("refresh() asks the backend again", async () => {
    const fetchRecords = vi.fn()
      .mockResolvedValueOnce([placeable])
      .mockResolvedValueOnce([placeable, otherPlaceable]);
    const probe = renderMapData(fetchRecords);
    await settle();

    act(() => probe.latest().refresh());
    expect(probe.latest().isFetching).toBe(true);
    await settle();

    expect(fetchRecords).toHaveBeenCalledTimes(2);
    expect(probe.latest().drillholes).toHaveLength(2);
  });
});
