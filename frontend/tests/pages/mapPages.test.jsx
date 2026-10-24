import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../../src/App.jsx";
import { asBackendRecord } from "./TechnoMap/backendRecord.js";
import DrillMap from "../../src/pages/DrillMap/DrillMap.jsx";
import TechnoMap from "../../src/pages/TechnoMap/TechnoMap.jsx";
import { clearAllMapViews, readMapView, writeMapView } from "../../src/state/mapViewStore.js";
import { MAP_DATA_MESSAGES, clearMapData } from "../../src/state/mapDataStore.js";
import { clearToasts } from "../../src/components/Toast/toastStore.js";
import ToastContainer from "../../src/components/Toast/ToastContainer.jsx";
import {
  DATASET_IDS,
  clearCachedDataset,
  readCachedDataset,
  writeCachedDataset,
} from "../../src/services/cache/drillholeCache.js";

// These tests cover backend mode; technoMap.yaml ships with the demo dataset.
vi.mock("../../src/pages/TechnoMap/config/technoMapConfig.js", async (importOriginal) => {
  const actual = await importOriginal();

  return { ...actual, MAP_CONFIG: { ...actual.MAP_CONFIG, dataSource: "backend" } };
});

// One payload for both endpoints. The Exploration Map reads holePurpose and
// azimuth/finalDeviation; the Techno Map reads the category and deviation
// endpoint its API adds (asBackendRecord mirrors the backend).
const RECORDS = [
  // PRODUCT -> triangle
  { holeId: "P-1", x: 418000, y: 4894000, holePurpose: "PRODUCT", holeStatus: "VALIDATED", gt: 0.18 },
  // INJECT -> square
  { holeId: "I-1", x: 418500, y: 4894500, holePurpose: "INJECT", holeStatus: "VALIDATED", gt: 0.08 },
  // INPROGRESS outranks HolePurpose -> drill rig, not a triangle
  { holeId: "R-1", x: 419000, y: 4895000, HolePurpose: "PRODUCT", HoleStatus: "INPROGRESS" },
  // Deviation inputs in the PascalCase the API also sends
  { holeId: "D-1", x: 419500, y: 4895500, Azimuth: 45, FinalDeviation: 25, gt: 0.3, category: "exploration" },
  // The Exploration Map's dataset is gated to these purposes; on the Techno
  // Map the Sediment_Sampling flag files it under Sediment-sampling.
  { holeId: "S-1", x: 420000, y: 4896000, holePurpose: "SEDIMENT", sedimentSampling: true, holeStatus: "VALIDATED", gt: 0.2 },
].map(asBackendRecord);

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(async () => {
  clearAllMapViews();
  clearMapData();
  clearToasts();
  await clearCachedDataset(DATASET_IDS.explorationMap);
  await clearCachedDataset(DATASET_IDS.technoMap);
  globalThis.ResizeObserver = ResizeObserverStub;
  globalThis.fetch = vi.fn(() => Promise.resolve({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(RECORDS)),
  }));
});

afterEach(() => {
  cleanup();
  clearToasts();
  vi.restoreAllMocks();
});

async function renderPage(Page) {
  const result = render(<Page />);
  await act(async () => {});

  return result;
}

const markerFor = (container, holeId) => [
  ...container.querySelectorAll(".drillhole-marker"),
].find((node) => node.getAttribute("aria-label").includes(holeId));
const markerClassFor = (container, holeId) => markerFor(container, holeId).className;

describe("map pages", () => {
  describe("titles", () => {
    it("titles the browser tab and the sidebar brand Drilling Map", async () => {
      await renderPage(App);

      expect(document.title).toBe("Drilling Map");
      expect(screen.getByLabelText("Drilling Map")).toBeTruthy();
    });

    it("keeps the two page headings", async () => {
      await renderPage(DrillMap);
      expect(screen.getByRole("heading", { name: "Exploration Map" })).toBeTruthy();
      cleanup();

      await renderPage(TechnoMap);
      expect(screen.getByRole("heading", { name: "Techno Map" })).toBeTruthy();
    });
  });

  describe("Exploration Map legend", () => {
    it("names the rig icon Drill Rig", async () => {
      const { container } = await renderPage(DrillMap);

      expect(screen.getByText("Drill Rig")).toBeTruthy();
      expect(container.querySelector(".legend-rig-icon").getAttribute("src")).toBe("/rig.svg");
    });
  });

  describe("Techno Map markers", () => {
    it("applies the documented priority", async () => {
      const { container } = await renderPage(TechnoMap);

      expect(markerClassFor(container, "P-1")).toContain("drillhole-marker--producer");
      expect(markerClassFor(container, "I-1")).toContain("drillhole-marker--injector");
      expect(markerClassFor(container, "R-1")).toContain("drillhole-marker--rig");
    });

    it("draws a triangle, a square and a rig icon", async () => {
      const { container } = await renderPage(TechnoMap);

      expect(container.querySelector(".marker-symbol--triangle")).toBeTruthy();
      expect(container.querySelector(".marker-symbol--square")).toBeTruthy();
      expect(container.querySelector(".rig-marker-icon").getAttribute("src"))
        .toBe("/rig.svg");
    });
  });

  describe("Techno Map legend", () => {
    it("explains square, triangle and rig", async () => {
      const { container } = await renderPage(TechnoMap);
      const legend = container.querySelector(".map-legend");

      expect(legend.textContent).toContain("Injector");
      expect(legend.textContent).toContain("Producer");
      expect(legend.textContent).toContain("Drilling in progress");
      expect(legend.querySelector(".marker-symbol--square")).toBeTruthy();
      expect(legend.querySelector(".marker-symbol--triangle")).toBeTruthy();
      expect(legend.querySelector(".legend-rig-icon")).toBeTruthy();
    });
  });

  describe("Exploration Map markers", () => {
    const explMarkerClass = (container, holeId) => [
      ...container.querySelectorAll(".drillhole-marker"),
    ].find((node) => node.getAttribute("aria-label").includes(holeId)).className;

    it("applies the documented priority", async () => {
      const { container } = await renderPage(DrillMap);

      expect(explMarkerClass(container, "P-1")).toContain("drillhole-marker--producer");
      expect(explMarkerClass(container, "I-1")).toContain("drillhole-marker--injector");
      expect(explMarkerClass(container, "R-1")).toContain("drillhole-marker--rig");
      expect(explMarkerClass(container, "S-1")).toContain("drillhole-marker--drillhole");
    });

    it("draws a triangle, a square and a rig icon", async () => {
      const { container } = await renderPage(DrillMap);

      expect(container.querySelector(".marker-symbol--triangle")).toBeTruthy();
      expect(container.querySelector(".marker-symbol--square")).toBeTruthy();
      expect(container.querySelector(".rig-marker-icon").getAttribute("src"))
        .toBe("/rig.svg");
    });

    // "Never display both the rig and drillhole marker for the same drillhole."
    it("gives the in-progress producer a rig and no triangle beneath it", async () => {
      const { container } = await renderPage(DrillMap);
      const rig = [...container.querySelectorAll(".drillhole-marker")]
        .find((node) => node.getAttribute("aria-label").includes("R-1"));

      expect(rig.querySelector(".rig-marker-icon")).toBeTruthy();
      expect(rig.querySelector(".marker-symbol")).toBeNull();
    });

    it("shows HoleStatus in the tooltip", async () => {
      const { container } = await renderPage(DrillMap);
      const marker = [...container.querySelectorAll(".drillhole-marker")]
        .find((node) => node.getAttribute("aria-label").includes("I-1"));

      expect(marker.querySelector(".drillhole-tooltip").textContent)
        .toContain("Hole Status: VALIDATED");
    });
  });

  describe("Techno Map tooltip", () => {
    it("shows HoleStatus", async () => {
      const { container } = await renderPage(TechnoMap);
      const marker = [...container.querySelectorAll(".drillhole-marker")]
        .find((node) => node.getAttribute("aria-label").includes("I-1"));

      expect(marker.querySelector(".drillhole-tooltip").textContent)
        .toContain("Status: VALIDATED");
    });
  });

  describe("duplicate records", () => {
    // Two rows for one hole used to render twice, and if the copies disagreed
    // on HoleStatus the result was a rig with a square underneath it.
    const withDuplicate = [
      ...RECORDS,
      { holeId: "P-1", x: 418000, y: 4894000, holePurpose: "PRODUCT", holeStatus: "INPROGRESS", category: "producer" },
    ];

    it("draws one marker per hole on the Techno Map", async () => {
      globalThis.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(withDuplicate)),
      }));

      const { container } = await renderPage(TechnoMap);
      const markers = [...container.querySelectorAll(".drillhole-marker")]
        .filter((node) => node.getAttribute("aria-label").includes("P-1"));

      expect(markers).toHaveLength(1);
      expect(markers[0].querySelector(".rig-marker-icon")).toBeTruthy();
      expect(markers[0].querySelector(".marker-symbol")).toBeNull();
    });

    it("draws one marker per hole on the Exploration Map", async () => {
      globalThis.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(withDuplicate)),
      }));

      const { container } = await renderPage(DrillMap);
      const markers = [...container.querySelectorAll(".drillhole-marker")]
        .filter((node) => node.getAttribute("aria-label").includes("P-1"));

      expect(markers).toHaveLength(1);
      expect(markers[0].querySelector(".rig-marker-icon")).toBeTruthy();
      expect(markers[0].querySelector(".marker-symbol")).toBeNull();
    });
  });

  describe("view persistence", () => {
    it("stores each map's view under its own key", async () => {
      const exploration = await renderPage(DrillMap);
      exploration.unmount();

      expect(readMapView("exploration-map", null)).toBeTruthy();
      expect(readMapView("techno-map", null)).toBeNull();

      const techno = await renderPage(TechnoMap);
      techno.unmount();

      expect(readMapView("techno-map", null)).toBeTruthy();
    });
  });

  describe("IndexedDB caching", () => {
    it("caches the full API response for each map separately", async () => {
      await renderPage(DrillMap);

      await waitFor(async () => {
        const cached = await readCachedDataset(DATASET_IDS.explorationMap);
        expect(cached.records).toEqual(RECORDS);
      });

      expect(await readCachedDataset(DATASET_IDS.technoMap)).toBeNull();
    });

    // The reason for the whole cache: drillholes visible without waiting on a
    // 5-15 second request.
    it("draws cached drillholes while the API is still pending", async () => {
      await writeCachedDataset(DATASET_IDS.technoMap, RECORDS);
      globalThis.fetch = vi.fn(() => new Promise(() => {}));

      const { container } = await renderPage(TechnoMap);

      await waitFor(() => {
        expect(container.querySelectorAll(".drillhole-marker").length)
          .toBe(RECORDS.length);
      });

      // Still waiting on the network, and saying so on the refresh button.
      expect(screen.getByRole("button", { name: "Refresh map data" }).getAttribute("aria-busy"))
        .toBe("true");
    });

    it("still renders when IndexedDB is unavailable", async () => {
      const saved = globalThis.indexedDB;
      delete globalThis.indexedDB;

      try {
        const { container } = await renderPage(TechnoMap);

        await waitFor(() => {
          expect(container.querySelectorAll(".drillhole-marker").length)
            .toBe(RECORDS.length);
        });
      } finally {
        globalThis.indexedDB = saved;
      }
    });
  });

  describe("automatic loading and toasts", () => {
    const failingFetch = () => vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));

    it("keeps cached drillholes and warns when the backend is down", async () => {
      await writeCachedDataset(DATASET_IDS.technoMap, RECORDS);
      globalThis.fetch = failingFetch();

      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Techno Map" }));

      await screen.findByText(MAP_DATA_MESSAGES.showingCached({ kind: "network" }));
      expect(document.querySelectorAll(".drillhole-marker")).toHaveLength(RECORDS.length);
      // No large inline banner or retry button any more.
      expect(screen.queryByText(/Showing cached drillholes/)).toBeNull();
      expect(screen.queryByRole("button", { name: /retry|try again/i })).toBeNull();
    });

    it("shows a small empty state, an error toast and a usable refresh button with no data at all", async () => {
      globalThis.fetch = failingFetch();
      const { container } = render(<App />);

      expect((await screen.findByRole("alert")).textContent).toContain(MAP_DATA_MESSAGES.failed);
      expect(container.querySelector(".map-state--unavailable")).toBeTruthy();
      expect(container.querySelectorAll(".drillhole-marker")).toHaveLength(0);
      expect(screen.getByRole("button", { name: "Refresh map data" }).disabled).toBe(false);
    });

    it("renders toasts in the application's notification region", async () => {
      globalThis.fetch = failingFetch();
      render(<App />);

      const region = screen.getByRole("region", { name: "Notifications" });
      await waitFor(() => expect(within(region).getByRole("alert")).toBeTruthy());
    });

    it("does not refetch when switching back to a loaded page", async () => {
      render(<App />);
      await waitFor(() => expect(document.querySelectorAll(".drillhole-marker").length).toBeGreaterThan(0));
      const mapRequests = () => fetch.mock.calls.filter(([url]) => String(url).includes("/api/exploration-map"));
      expect(mapRequests()).toHaveLength(1);

      fireEvent.click(screen.getByRole("button", { name: "Techno Map" }));
      fireEvent.click(screen.getByRole("button", { name: "Exploration Map" }));
      await act(async () => {});

      expect(mapRequests()).toHaveLength(1);
      expect(document.querySelectorAll(".drillhole-marker").length).toBeGreaterThan(0);
    });
  });

  describe("manual refresh", () => {
    const refreshButton = () => screen.getByRole("button", { name: "Refresh map data" });
    const technoRequests = () => fetch.mock.calls.filter(([url]) => String(url).includes("/api/techno-map"));

    // The page plus the toast region App normally provides.
    async function renderLoadedTechnoMap() {
      const result = await renderPage(() => <><TechnoMap /><ToastContainer /></>);
      await waitFor(() => expect(refreshButton().disabled).toBe(false));

      return result;
    }

    it.each([["Exploration Map", DrillMap], ["Techno Map", TechnoMap]])(
      "sits in the %s header, followed by the base map switcher and the drillhole count",
      async (_title, Page) => {
        const { container } = await renderPage(Page);
        const count = container.querySelector(".map-header strong");
        const switcher = refreshButton().nextElementSibling;

        expect(switcher.contains(screen.getByRole("button", { name: "Base map" }))).toBe(true);
        expect(switcher.nextElementSibling).toBe(count);
        expect(count.textContent).toMatch(/^\d+ drillholes$/);
        expect(container.querySelector(".map-header").contains(refreshButton())).toBe(true);
        expect(container.querySelector(".map-viewport").contains(refreshButton())).toBe(false);
        expect(screen.getAllByRole("button", { name: "Refresh map data" })).toHaveLength(1);
      },
    );

    it("uses the circular two-arrow icon", async () => {
      await renderPage(TechnoMap);
      const icon = refreshButton().querySelector('svg[data-icon="refresh"]');

      // Two arcs and two arrow heads.
      expect(icon.querySelectorAll("path")).toHaveLength(4);
      expect(refreshButton().querySelector("img")).toBeNull();
    });

    it("spins only the icon while the request runs, then stops", async () => {
      await renderLoadedTechnoMap();
      let respond;
      globalThis.fetch = vi.fn(() => new Promise((resolve) => { respond = resolve; }));
      const iconClass = () => refreshButton().querySelector("svg").getAttribute("class");

      fireEvent.click(refreshButton());

      expect(iconClass()).toContain("motion-safe:animate-spin");
      expect(refreshButton().className).not.toContain("animate-spin");

      await act(async () => respond({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(RECORDS)) }));
      await screen.findByText(MAP_DATA_MESSAGES.refreshed);

      expect(iconClass()).not.toContain("animate-spin");
      expect(refreshButton().disabled).toBe(false);
    });

    it("says the backend errored, not that it is unavailable, on HTTP 500", async () => {
      await renderLoadedTechnoMap();
      globalThis.fetch = vi.fn(() => Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Microsoft.Data.SqlClient.SqlException: A network-related error..."),
      }));

      fireEvent.click(refreshButton());

      await screen.findByText("Backend error (HTTP 500). Showing cached data.");
      expect(screen.queryByText(/Backend unavailable/)).toBeNull();
      expect(screen.queryByText(/SqlException/)).toBeNull();
    });

    it("asks the backend, updates the map and IndexedDB, and confirms", async () => {
      const { container } = await renderLoadedTechnoMap();
      const fresh = [{ holeId: "NEW-1", x: 418200, y: 4894200, holePurpose: "PRODUCT", category: "producer" }];
      globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(fresh)) }));

      fireEvent.click(refreshButton());

      await screen.findByText(MAP_DATA_MESSAGES.refreshed);
      expect(technoRequests()).toHaveLength(1);
      expect(markerFor(container, "NEW-1")).toBeTruthy();
      await waitFor(async () => {
        expect((await readCachedDataset(DATASET_IDS.technoMap)).records).toEqual(fresh);
      });
    });

    it("keeps the drillholes visible while refreshing and ignores repeat clicks", async () => {
      const { container } = await renderLoadedTechnoMap();
      globalThis.fetch = vi.fn(() => new Promise(() => {}));

      fireEvent.click(refreshButton());
      fireEvent.click(refreshButton());
      fireEvent.click(refreshButton());

      expect(technoRequests()).toHaveLength(1);
      expect(refreshButton().disabled).toBe(true);
      expect(container.querySelectorAll(".drillhole-marker")).toHaveLength(RECORDS.length);
    });

    it("keeps the data and stays usable after a failed refresh", async () => {
      const { container } = await renderLoadedTechnoMap();
      globalThis.fetch = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));

      fireEvent.click(refreshButton());

      await screen.findByText(MAP_DATA_MESSAGES.showingCached({ kind: "network" }));
      expect(container.querySelectorAll(".drillhole-marker")).toHaveLength(RECORDS.length);
      expect(refreshButton().disabled).toBe(false);
      expect((await readCachedDataset(DATASET_IDS.technoMap)).records).toEqual(RECORDS);
    });

    it("preserves the current pan and zoom", async () => {
      const zoomed = { scale: 12, translateX: -340, translateY: 125 };
      writeMapView("techno-map", zoomed);
      const { container } = await renderLoadedTechnoMap();

      fireEvent.click(refreshButton());
      await screen.findByText(MAP_DATA_MESSAGES.refreshed);

      expect(container.querySelector(".map-canvas").style.transform)
        .toBe("translate(-340px, 125px) scale(12)");
    });
  });
});
