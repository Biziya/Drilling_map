// The Techno Map page as shipped: demo dataset (dataSource: mock), filters,
// measurement, export menu. Backend mode is covered in tests/pages/mapPages.test.jsx.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import TechnoMap from "../../../src/pages/TechnoMap/TechnoMap.jsx";
import ToastContainer from "../../../src/components/Toast/ToastContainer.jsx";
import { MAP_UTM_BOUNDS } from "../../../src/pages/TechnoMap/config/technoMapConfig.js";
import { formatDistance } from "../../../src/pages/TechnoMap/utils/measurement.js";
import { FILTERS_STORAGE_KEY } from "../../../src/pages/TechnoMap/hooks/useMapFilters.js";
import { clearAllMapViews, readMapView, writeMapView } from "../../../src/state/mapViewStore.js";
import { MAP_DATA_MESSAGES, clearMapData, getMapData } from "../../../src/state/mapDataStore.js";
import { clearToasts } from "../../../src/components/Toast/toastStore.js";
import { DATASET_IDS, clearCachedDataset, readCachedDataset } from "../../../src/services/cache/drillholeCache.js";

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

async function renderPage() {
  const result = render(<><TechnoMap /><ToastContainer /></>);
  await act(async () => {});

  return result;
}

/** Fires the base map's load event with the real image's 1191 x 842 size. */
async function loadBaseMap(container) {
  const image = container.querySelector(".base-map");
  Object.defineProperty(image, "naturalWidth", { value: 1191 });
  Object.defineProperty(image, "naturalHeight", { value: 842 });
  await act(async () => fireEvent.load(image));
}

const markers = (container) => container.querySelectorAll(".drillhole-marker");
const checkbox = (name) => within(screen.getByRole("complementary", { name: "Map layers" })).getByRole("checkbox", { name });

describe("demo dataset", () => {
  it("shows 130 drillholes and a Demo badge by the title", async () => {
    const { container } = await renderPage();

    expect(container.querySelector(".map-header strong").textContent).toBe("130 drillholes");
    expect(markers(container)).toHaveLength(130);
    expect(container.querySelectorAll(".rig-marker-icon")).toHaveLength(10);
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
      const button = screen.getByRole("button", { name: "Refresh map data" });

      fireEvent.click(button);
      fireEvent.click(button);

      expect(button.disabled).toBe(true);
      expect(button.querySelector("svg").getAttribute("class")).toContain("motion-safe:animate-spin");
      expect(markers(container)).toHaveLength(130);

      await act(async () => vi.advanceTimersByTime(600));

      expect(screen.getByText(MAP_DATA_MESSAGES.refreshed)).toBeTruthy();
      expect(button.disabled).toBe(false);
      expect(markers(container)).toHaveLength(130);
      expect(container.querySelector(".map-canvas").style.transform).toBe("translate(-120px, 60px) scale(4)");
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("map layers panel", () => {
  it("lists 12 checked filters in two groups, expanded", async () => {
    await renderPage();
    const panel = screen.getByRole("complementary", { name: "Map layers" });

    expect(within(panel).getAllByRole("checkbox")).toHaveLength(12);
    expect(within(panel).getAllByRole("checkbox").every((box) => box.checked)).toBe(true);
    expect(within(panel).getByRole("group", { name: "Drillhole Types" })).toBeTruthy();
    expect(within(panel).getByRole("group", { name: "Map Features" })).toBeTruthy();
    expect(within(panel).getByText("12/12")).toBeTruthy();
  });

  it("hides a type's markers and fades it in the legend", async () => {
    const { container } = await renderPage();

    fireEvent.click(checkbox("Water"));

    expect(markers(container)).toHaveLength(120);
    expect([...container.querySelectorAll(".map-legend li.is-hidden")].map((li) => li.textContent)).toEqual(["Water"]);
  });

  it("hides rigs, and only rigs, when Drilling in progress is unchecked", async () => {
    const { container } = await renderPage();

    fireEvent.click(checkbox("Drilling in progress"));

    expect(markers(container)).toHaveLength(120);
    expect(container.querySelector(".rig-marker-icon")).toBeNull();
  });

  it("hides an in-progress producer when Producer is unchecked, instead of showing a plain marker", async () => {
    const { container } = await renderPage();
    const rigCount = () => container.querySelectorAll(".drillhole-marker--rig").length;
    const before = rigCount();

    fireEvent.click(checkbox("Producer"));

    expect(container.querySelector(".drillhole-marker--producer")).toBeNull();
    expect(rigCount()).toBe(before - 3);
  });

  it("toggles the technological cells on their own", async () => {
    const { container } = await renderPage();
    await loadBaseMap(container);

    fireEvent.click(screen.getByRole("button", { name: "Hide All" }));
    fireEvent.click(checkbox("Technological cells"));

    expect(markers(container)).toHaveLength(0);
    expect(container.querySelectorAll(".tech-cell-layer polygon")).toHaveLength(5);
    expect(container.querySelectorAll(".tech-cell-label")).toHaveLength(5);

    fireEvent.click(checkbox("Technological cells"));
    expect(container.querySelector(".tech-cell-layer")).toBeNull();
  });

  it("Hide All hides every layer but keeps the base map, chrome and view; Show All restores them", async () => {
    writeMapView("techno-map", { scale: 3, translateX: -50, translateY: 20 });
    const { container } = await renderPage();
    await loadBaseMap(container);

    fireEvent.click(screen.getByRole("button", { name: "Hide All" }));

    expect(markers(container)).toHaveLength(0);
    expect(container.querySelector(".tech-cell-layer")).toBeNull();
    expect(container.querySelector(".base-map")).toBeTruthy();
    expect(container.querySelector(".north-arrow")).toBeTruthy();
    expect(container.querySelector(".map-scale-bar")).toBeTruthy();
    expect(container.querySelector(".map-canvas").style.transform).toBe("translate(-50px, 20px) scale(3)");
    expect(screen.getByText("0/12")).toBeTruthy();
    expect(container.querySelectorAll(".map-legend__symbols li")).toHaveLength(12);

    fireEvent.click(screen.getByRole("button", { name: "Show All" }));

    expect(markers(container)).toHaveLength(130);
    expect(container.querySelectorAll(".tech-cell-layer polygon")).toHaveLength(5);
  });

  it("collapses and expands without changing the filters", async () => {
    const { container } = await renderPage();
    fireEvent.click(checkbox("Water"));
    const header = screen.getByRole("button", { name: /Map Layers/ });

    fireEvent.click(header);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(markers(container)).toHaveLength(120);

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
    expect(markers(container)).toHaveLength(120);
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
    await renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Export map" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Export as PNG" }));

    expect(await screen.findByText("Map export failed: the base map is not loaded.")).toBeTruthy();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Reset fits all drillholes rather than returning to the full map", async () => {
    const { container } = await renderPage();
    await loadBaseMap(container);

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
    await loadBaseMap(result.container);
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

  // In the browser the marker also stops catching the pointer (CSS); here the
  // press is dispatched on the marker itself, the harder case.
  it("places a point when the press lands on a drillhole marker", async () => {
    const { container } = await startMeasuring();
    const marker = container.querySelector(".drillhole-marker");

    fireEvent.pointerDown(marker, { button: 0, pointerId: 1, clientX: 200, clientY: 300 });
    fireEvent.pointerUp(viewport(container), { button: 0, pointerId: 1, clientX: 200, clientY: 300 });

    expect(ends(container)).toBe(1);
    expect(viewport(container).className).toContain("is-measuring");
  });

  it("leaves markers to their tooltips again once the tool is off", async () => {
    const { container } = await startMeasuring();
    fireEvent.click(screen.getByRole("button", { name: "Measure distance" }));
    const marker = container.querySelector(".drillhole-marker");

    fireEvent.pointerDown(marker, { button: 0, pointerId: 1, clientX: 200, clientY: 300 });
    fireEvent.pointerUp(viewport(container), { button: 0, pointerId: 1, clientX: 200, clientY: 300 });
    fireEvent.click(marker);

    expect(viewport(container).className).not.toContain("is-measuring");
    expect(container.querySelector(".measurement-layer")).toBeNull();
    expect(marker.className).toContain("is-open");
  });

  it("does nothing while the tool is off", async () => {
    const { container } = await renderPage();
    await loadBaseMap(container);

    click(container, 200, 300);

    expect(container.querySelector(".measurement-layer")).toBeNull();
  });
});
