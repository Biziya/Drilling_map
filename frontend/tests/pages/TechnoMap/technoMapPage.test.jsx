// The Techno Map page on its demo dataset (dataSource: mock): filters,
// measurement, export menu. Backend mode, which technoMap.yaml ships with, is
// covered in tests/pages/mapPages.test.jsx.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import TechnoMap from "../../../src/pages/TechnoMap/TechnoMap.jsx";
import ToastContainer from "../../../src/components/Toast/ToastContainer.jsx";
import { MAP_CONFIG, MAP_UTM_BOUNDS } from "../../../src/pages/TechnoMap/config/technoMapConfig.js";
import { formatDistance } from "../../../src/pages/TechnoMap/utils/measurement.js";
import { FILTERS_STORAGE_KEY } from "../../../src/pages/TechnoMap/hooks/useMapFilters.js";
import { clearAllMapViews, readMapView, writeMapView } from "../../../src/state/mapViewStore.js";
import { MAP_DATA_MESSAGES, clearMapData, getMapData } from "../../../src/state/mapDataStore.js";
import { clearToasts } from "../../../src/components/Toast/toastStore.js";
import { DATASET_IDS, clearCachedDataset, readCachedDataset } from "../../../src/services/cache/drillholeCache.js";
import { MOCK_DRILLHOLES } from "../../../src/pages/TechnoMap/mock/mockData.js";
import { clickAt, drawnKinds, drawnMarkerCount, hoverAt, loadMapImages } from "./canvasMap.js";

vi.mock("../../../src/pages/TechnoMap/config/technoMapConfig.js", async (importOriginal) => {
  const actual = await importOriginal();

  return { ...actual, MAP_CONFIG: { ...actual.MAP_CONFIG, dataSource: "mock" } };
});

const VIEWPORT = { width: 1000, height: 700 };
// 300 px at zoom 1: the 1191 x 842 base map is fitted to 700 px high, and spans the UTM bounds.
const THREE_HUNDRED_PX = formatDistance((300 / ((1191 * 700) / 842)) * (MAP_UTM_BOUNDS.maxX - MAP_UTM_BOUNDS.minX));

beforeAll(() => {
  // jsdom has no layout or pointer events; give the map a size and real pointer events.
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.PointerEvent ??= class PointerEvent extends MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  };
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
});

beforeEach(async () => {
  clearAllMapViews();
  clearMapData();
  clearToasts();
  localStorage.clear();
  await clearCachedDataset(DATASET_IDS.technoMap);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    ...VIEWPORT, top: 0, left: 0, right: VIEWPORT.width, bottom: VIEWPORT.height, x: 0, y: 0,
  });
  globalThis.fetch = vi.fn(() => new Promise(() => {}));
});

afterEach(() => {
  cleanup();
  clearToasts();
  vi.restoreAllMocks();
});

/** The page with its base map and rig icon loaded, so the canvas draws every marker. */
async function renderPage({ loadImages = true } = {}) {
  const result = render(<><TechnoMap /><ToastContainer /></>);
  await act(async () => {});
  if (loadImages) await loadMapImages(result.container);

  return result;
}

const rigCount = (container) => drawnKinds(container).filter((kind) => kind === "rig").length;
const checkbox = (name) => within(screen.getByRole("complementary", { name: "Legends" })).getByRole("checkbox", { name });
// A demo hole that is not being drilled, to point at.
const HOLE = MOCK_DRILLHOLES.find((hole) => hole.holeStatus !== "INPROGRESS");

describe("demo dataset", () => {
  it("shows 130 drillholes and a Demo badge by the title", async () => {
    const { container } = await renderPage();

    expect(container.querySelector(".map-header strong").textContent).toBe("130 drillholes");
    expect(drawnMarkerCount(container)).toBe(130);
    expect(rigCount(container)).toBe(10);
    expect(screen.getByRole("heading", { name: "Techno Map" }).nextElementSibling.textContent).toBe("Demo");
  });

  it("never asks the backend or touches IndexedDB", async () => {
    await renderPage();
    await act(async () => {});

    expect(fetch).not.toHaveBeenCalled();
    expect(getMapData("techno-map").records).toBeNull();
    expect(await readCachedDataset(DATASET_IDS.technoMap)).toBeNull();
  });

  it("refreshes without a request, spinning the icon and keeping the map and view", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    try {
      writeMapView("techno-map", { scale: 4, translateX: -120, translateY: 60 });
      const { container } = render(<><TechnoMap /><ToastContainer /></>);
      await loadMapImages(container);
      const drawn = drawnMarkerCount(container);
      const button = screen.getByRole("button", { name: "Refresh map data" });

      fireEvent.click(button);
      fireEvent.click(button);

      expect(drawn).toBeGreaterThan(0);
      expect(button.disabled).toBe(true);
      expect(button.querySelector("svg").getAttribute("class")).toContain("motion-safe:animate-spin");
      expect(drawnMarkerCount(container)).toBe(drawn);

      await act(async () => vi.advanceTimersByTime(600));

      expect(screen.getByText(MAP_DATA_MESSAGES.refreshed)).toBeTruthy();
      expect(button.disabled).toBe(false);
      expect(drawnMarkerCount(container)).toBe(drawn);
      expect(container.querySelector(".map-canvas").style.transform).toBe("translate(-120px, 60px) scale(4)");
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Legends panel", () => {
  it("lists 12 checked filters in two groups, expanded", async () => {
    await renderPage();
    const panel = screen.getByRole("complementary", { name: "Legends" });

    expect(within(panel).getAllByRole("checkbox")).toHaveLength(12);
    expect(within(panel).getAllByRole("checkbox").every((box) => box.checked)).toBe(true);
    expect(within(panel).getByRole("group", { name: "Drillhole Types" })).toBeTruthy();
    expect(within(panel).getByRole("group", { name: "Map Features" })).toBeTruthy();
    expect(within(panel).getByText("12/12")).toBeTruthy();
    expect(within(panel).getByRole("button", { name: /^Legends/ })).toBeTruthy();
  });

  it("colours each type's label like its marker, from technoMap.yaml", async () => {
    await renderPage();
    const labelColour = (name) => checkbox(name).closest("label").querySelector(".map-layers__label").style.color;
    const hex = (colour) => {
      const probe = document.createElement("span");
      probe.style.color = colour;

      return probe.style.color;
    };

    MAP_CONFIG.drillholeTypes.forEach(({ label, color }) => expect(labelColour(label)).toBe(hex(color)));
    expect(labelColour("Technological cells")).toBe(hex(MAP_CONFIG.technologicalCells.stroke));
    expect(labelColour("Deviation line")).toBe(hex(MAP_CONFIG.deviationLine.color));
    expect(labelColour("Drilling in progress")).toBe("");
  });

  it("hides a type's markers and fades it in the legend", async () => {
    const { container } = await renderPage();

    fireEvent.click(checkbox("Water"));

    expect(drawnMarkerCount(container)).toBe(120);
    expect(drawnKinds(container)).not.toContain("water");
    expect([...container.querySelectorAll(".map-legend li.is-hidden")].map((li) => li.textContent)).toEqual(["Water"]);
  });

  it("hides rigs, and only rigs, when Drilling in progress is unchecked", async () => {
    const { container } = await renderPage();

    fireEvent.click(checkbox("Drilling in progress"));

    expect(drawnMarkerCount(container)).toBe(120);
    expect(rigCount(container)).toBe(0);
  });

  it("hides an in-progress producer when Producer is unchecked, instead of showing a plain marker", async () => {
    const { container } = await renderPage();
    const before = rigCount(container);

    fireEvent.click(checkbox("Producer"));

    expect(drawnKinds(container)).not.toContain("producer");
    expect(rigCount(container)).toBe(before - 3);
  });

  it("toggles the technological cells on their own", async () => {
    const { container } = await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Hide All" }));
    fireEvent.click(checkbox("Technological cells"));

    expect(drawnMarkerCount(container)).toBe(0);
    expect(container.querySelectorAll(".tech-cell-layer polygon")).toHaveLength(5);
    expect(container.querySelectorAll(".tech-cell-label")).toHaveLength(5);

    fireEvent.click(checkbox("Technological cells"));
    expect(container.querySelector(".tech-cell-layer")).toBeNull();
  });

  it("Hide All hides every layer but keeps the base map, chrome and view; Show All restores them", async () => {
    writeMapView("techno-map", { scale: 3, translateX: -50, translateY: 20 });
    const { container } = await renderPage();
    const drawn = drawnMarkerCount(container);

    fireEvent.click(screen.getByRole("button", { name: "Hide All" }));

    expect(drawnMarkerCount(container)).toBe(0);
    expect(container.querySelector(".tech-cell-layer")).toBeNull();
    expect(container.querySelector(".base-map")).toBeTruthy();
    expect(container.querySelector(".map-legend")).toBeTruthy();
    expect(container.querySelector(".map-scale-bar")).toBeTruthy();
    expect(container.querySelector(".map-canvas").style.transform).toBe("translate(-50px, 20px) scale(3)");
    expect(screen.getByText("0/12")).toBeTruthy();
    expect(container.querySelectorAll(".map-legend li")).toHaveLength(11);

    fireEvent.click(screen.getByRole("button", { name: "Show All" }));

    expect(drawn).toBeGreaterThan(0);
    expect(drawnMarkerCount(container)).toBe(drawn);
    expect(container.querySelectorAll(".tech-cell-layer polygon")).toHaveLength(5);
  });

  it("collapses and expands without changing the filters", async () => {
    const { container } = await renderPage();
    fireEvent.click(checkbox("Water"));
    const header = screen.getByRole("button", { name: /^Legends/ });

    fireEvent.click(header);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(drawnMarkerCount(container)).toBe(120);

    fireEvent.click(header);
    expect(checkbox("Water").checked).toBe(false);
  });

  it("remembers the filters across remounts and refreshes, under its own key", async () => {
    await renderPage();
    fireEvent.click(checkbox("Monitoring"));
    cleanup();

    expect(JSON.parse(localStorage.getItem(FILTERS_STORAGE_KEY)).monitoring).toBe(false);
    expect(FILTERS_STORAGE_KEY).toBe("techno-map:filters");

    const { container } = await renderPage();
    expect(checkbox("Monitoring").checked).toBe(false);
    expect(drawnMarkerCount(container)).toBe(120);
  });

  it("does not let a double-click in the panel zoom the map", async () => {
    const { container } = await renderPage();

    fireEvent.doubleClick(checkbox("Water"));
    await act(async () => {});

    expect(container.querySelector(".map-canvas").style.transform).toContain("scale(1)");
  });
});

describe("toolbar", () => {
  it("has zoom, reset, measure and a single export button", async () => {
    await renderPage();

    ["Zoom in", "Zoom out", "Reset", "Measure distance", "Export map"].forEach((name) => {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens an export menu with PNG and SVG", async () => {
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Export map" }));

    expect(within(screen.getByRole("menu")).getAllByRole("menuitem").map((item) => item.textContent))
      .toEqual(["Export as PNG", "Export as SVG"]);
  });

  it("refuses to export before the base map has loaded", async () => {
    await renderPage({ loadImages: false });

    fireEvent.click(screen.getByRole("button", { name: "Export map" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Export as PNG" }));

    expect(await screen.findByText("Map export failed: the base map is not loaded.")).toBeTruthy();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Reset fits all drillholes rather than returning to the full map", async () => {
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(readMapView("techno-map", null)?.scale).toBeGreaterThan(1));
  });
});

describe("measurement", () => {
  const viewport = (container) => container.querySelector(".map-viewport");
  const click = (container, x, y) => {
    fireEvent.pointerDown(viewport(container), { button: 0, pointerId: 1, clientX: x, clientY: y });
    fireEvent.pointerUp(viewport(container), { button: 0, pointerId: 1, clientX: x, clientY: y });
  };
  const ends = (container) => container.querySelectorAll(".measurement-layer path").length;
  const label = (container) => container.querySelector(".measurement-label")?.textContent;

  async function startMeasuring() {
    const result = await renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Measure distance" }));

    return result;
  }

  it("places A, then B with a distance, then starts over on the third click", async () => {
    const { container } = await startMeasuring();

    click(container, 200, 300);
    expect(ends(container)).toBe(1);
    expect(label(container)).toBeUndefined();

    click(container, 500, 300);
    expect(ends(container)).toBe(2);
    expect(container.querySelector(".measurement-layer line")).toBeTruthy();
    expect(label(container)).toBe(THREE_HUNDRED_PX);

    click(container, 600, 400);
    expect(ends(container)).toBe(1);
    expect(label(container)).toBeUndefined();
  });

  it("pans on drag without placing a point", async () => {
    const { container } = await startMeasuring();

    fireEvent.pointerDown(viewport(container), { button: 0, pointerId: 1, clientX: 200, clientY: 300 });
    fireEvent.pointerMove(viewport(container), { button: 0, pointerId: 1, clientX: 260, clientY: 330 });
    fireEvent.pointerUp(viewport(container), { button: 0, pointerId: 1, clientX: 260, clientY: 330 });

    expect(ends(container)).toBe(0);
  });

  it("keeps the distance when the map is zoomed and survives Hide All", async () => {
    const { container } = await startMeasuring();
    click(container, 200, 300);
    click(container, 500, 300);

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    await waitFor(() => expect(container.querySelector(".map-canvas").style.transform).not.toContain("scale(1)"));
    fireEvent.click(screen.getByRole("button", { name: "Hide All" }));

    expect(label(container)).toBe(THREE_HUNDRED_PX);
    expect(ends(container)).toBe(2);
  });

  it("clears everything when the tool is switched off", async () => {
    const { container } = await startMeasuring();
    click(container, 200, 300);
    click(container, 500, 300);

    fireEvent.click(screen.getByRole("button", { name: "Measure distance" }));

    expect(ends(container)).toBe(0);
    expect(label(container)).toBeUndefined();
    click(container, 200, 300);
    expect(ends(container)).toBe(0);
  });

  // Markers are drawn on a canvas that takes no pointer events, so a press on
  // one is a press on the map: it places a point there and opens no tooltip.
  it("places a point when the press lands on a drillhole marker, with no tooltip", async () => {
    const { container } = await startMeasuring();

    expect(hoverAt(container, HOLE)).toBeNull();
    clickAt(container, HOLE);

    expect(ends(container)).toBe(1);
    expect(container.querySelector(".marker-tooltip")).toBeNull();
    expect(viewport(container).className).toContain("is-measuring");
  });

  it("leaves markers to their tooltips again once the tool is off", async () => {
    const { container } = await startMeasuring();
    fireEvent.click(screen.getByRole("button", { name: "Measure distance" }));

    clickAt(container, HOLE);

    expect(viewport(container).className).not.toContain("is-measuring");
    expect(container.querySelector(".measurement-layer")).toBeNull();
    const tooltip = container.querySelector(".marker-tooltip");
    expect(tooltip.dataset.hole).toBe(HOLE.holeId);
    expect(tooltip.className).toContain("is-pinned");
  });

  it("does nothing while the tool is off", async () => {
    const { container } = await renderPage();

    click(container, 200, 300);

    expect(container.querySelector(".measurement-layer")).toBeNull();
  });
});

describe("tooltip", () => {
  it("shows the hovered hole's details, and only that one tooltip", async () => {
    const { container } = await renderPage();
    const tooltip = hoverAt(container, HOLE);

    expect(tooltip.dataset.hole).toBe(HOLE.holeId);
    expect(container.querySelectorAll(".drillhole-tooltip")).toHaveLength(1);
    expect(tooltip.textContent).toContain(HOLE.holeId);
    expect(container.querySelector(".map-viewport").className).toContain("is-over-marker");
  });

  it("goes when the pointer moves off the marker or leaves the map", async () => {
    const { container } = await renderPage();
    hoverAt(container, HOLE);

    expect(hoverAt(container, { x: HOLE.x, y: HOLE.y + 3000 })).toBeNull();
    hoverAt(container, HOLE);
    fireEvent.pointerLeave(container.querySelector(".map-viewport"));
    expect(container.querySelector(".marker-tooltip")).toBeNull();
  });

  it("stays pinned after a click until a click on empty map", async () => {
    const { container } = await renderPage();
    clickAt(container, HOLE);
    fireEvent.pointerLeave(container.querySelector(".map-viewport"));

    expect(container.querySelector(".marker-tooltip.is-pinned").dataset.hole).toBe(HOLE.holeId);
    clickAt(container, { x: HOLE.x, y: HOLE.y + 3000 });
    expect(container.querySelector(".marker-tooltip")).toBeNull();
  });

  it("closes when its hole is filtered out", async () => {
    const { container } = await renderPage();
    clickAt(container, HOLE);

    fireEvent.click(screen.getByRole("button", { name: "Hide All" }));

    expect(container.querySelector(".marker-tooltip")).toBeNull();
  });
});

describe("layout", () => {
  it("anchors the legend inside the map, and has no compass", async () => {
    const { container } = await renderPage();

    expect(container.querySelector(".map-viewport .map-legend")).toBeTruthy();
    expect(container.querySelector(".north-arrow")).toBeNull();
  });

  it("shows a camera on the export button", async () => {
    await renderPage();

    expect(screen.getByRole("button", { name: "Export map" }).querySelector('svg[data-icon="camera"]')).toBeTruthy();
  });
});
