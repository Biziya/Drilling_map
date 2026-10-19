import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import App from "../../src/App.jsx";
import DrillMap from "../../src/pages/DrillMap/DrillMap.jsx";
import TechnoMap from "../../src/pages/TechnoMap/TechnoMap.jsx";
import { clearAllMapViews, readMapView } from "../../src/state/mapViewStore.js";
import {
  DATASET_IDS,
  clearCachedDataset,
  readCachedDataset,
  writeCachedDataset,
} from "../../src/services/cache/drillholeCache.js";

const RECORDS = [
  // PRODUCT -> triangle
  { holeId: "P-1", x: 418000, y: 4894000, holePurpose: "PRODUCT", holeStatus: "VALIDATED", gt: 0.18 },
  // INJECT -> square
  { holeId: "I-1", x: 418500, y: 4894500, holePurpose: "INJECT", holeStatus: "VALIDATED", gt: 0.08 },
  // INPROGRESS outranks HolePurpose -> drill rig, not a triangle
  { holeId: "R-1", x: 419000, y: 4895000, HolePurpose: "PRODUCT", HoleStatus: "INPROGRESS" },
  // Deviation inputs in the PascalCase the API also sends
  { holeId: "D-1", x: 419500, y: 4895500, Azimuth: 45, FinalDeviation: 25, gt: 0.3 },
  // This map's own dataset is gated to these purposes
  { holeId: "S-1", x: 420000, y: 4896000, holePurpose: "SEDIMENT", holeStatus: "VALIDATED", gt: 0.2 },
];

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(async () => {
  clearAllMapViews();
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
  vi.restoreAllMocks();
});

async function renderPage(Page) {
  const result = render(<Page />);
  await act(async () => {});

  return result;
}

const markerClassFor = (container, holeId) => [
  ...container.querySelectorAll(".techno-drillhole-marker"),
].find((node) => node.getAttribute("aria-label").includes(holeId)).className;

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

      expect(markerClassFor(container, "P-1")).toContain("techno-drillhole-marker--producer");
      expect(markerClassFor(container, "I-1")).toContain("techno-drillhole-marker--injector");
      expect(markerClassFor(container, "R-1")).toContain("techno-drillhole-marker--rig");
    });

    it("draws a triangle, a square and a rig icon", async () => {
      const { container } = await renderPage(TechnoMap);

      expect(container.querySelector(".techno-marker-symbol--triangle")).toBeTruthy();
      expect(container.querySelector(".techno-marker-symbol--square")).toBeTruthy();
      expect(container.querySelector(".techno-rig-marker-icon").getAttribute("src"))
        .toBe("/rig.svg");
    });
  });

  describe("Techno Map legend", () => {
    it("explains square, triangle and rig", async () => {
      const { container } = await renderPage(TechnoMap);
      const legend = container.querySelector(".techno-map-legend");

      expect(legend.textContent).toContain("Injector");
      expect(legend.textContent).toContain("Producer");
      expect(legend.textContent).toContain("Drill Rig");
      expect(legend.querySelector(".techno-marker-symbol--square")).toBeTruthy();
      expect(legend.querySelector(".techno-marker-symbol--triangle")).toBeTruthy();
      expect(legend.querySelector(".techno-legend-rig-icon")).toBeTruthy();
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
      const marker = [...container.querySelectorAll(".techno-drillhole-marker")]
        .find((node) => node.getAttribute("aria-label").includes("I-1"));

      expect(marker.querySelector(".techno-drillhole-tooltip").textContent)
        .toContain("Hole Status: VALIDATED");
    });
  });

  describe("duplicate records", () => {
    // Two rows for one hole used to render twice, and if the copies disagreed
    // on HoleStatus the result was a rig with a square underneath it.
    const withDuplicate = [
      ...RECORDS,
      { holeId: "P-1", x: 418000, y: 4894000, holePurpose: "PRODUCT", holeStatus: "INPROGRESS" },
    ];

    it("draws one marker per hole on the Techno Map", async () => {
      globalThis.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(withDuplicate)),
      }));

      const { container } = await renderPage(TechnoMap);
      const markers = [...container.querySelectorAll(".techno-drillhole-marker")]
        .filter((node) => node.getAttribute("aria-label").includes("P-1"));

      expect(markers).toHaveLength(1);
      expect(markers[0].querySelector(".techno-rig-marker-icon")).toBeTruthy();
      expect(markers[0].querySelector(".techno-marker-symbol")).toBeNull();
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
        expect(container.querySelectorAll(".techno-drillhole-marker").length)
          .toBe(RECORDS.length);
      });

      // Still waiting on the network, and saying so.
      expect(container.querySelector(".techno-map-header strong").textContent)
        .toContain("updating");
    });

    it("still renders when IndexedDB is unavailable", async () => {
      const saved = globalThis.indexedDB;
      delete globalThis.indexedDB;

      try {
        const { container } = await renderPage(TechnoMap);

        await waitFor(() => {
          expect(container.querySelectorAll(".techno-drillhole-marker").length)
            .toBe(RECORDS.length);
        });
      } finally {
        globalThis.indexedDB = saved;
      }
    });
  });
});
