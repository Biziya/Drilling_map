// Exploration Map toolbar: zoom, reset, measurement and export, laid out like
// the Techno Map's but with no Map Layers panel.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import DrillMap from "../../../src/pages/DrillMap/DrillMap.jsx";
import ToastContainer from "../../../src/components/Toast/ToastContainer.jsx";
import { MAP_UTM_BOUNDS } from "../../../src/pages/DrillMap/config/drillMapConfig.js";
import { formatDistance } from "../../../src/pages/DrillMap/utils/measurement.js";
import { buildMapSvg, exportFileName } from "../../../src/pages/DrillMap/utils/exportMap.js";
import { convertUtmToMapPosition } from "../../../src/pages/DrillMap/utils/coordinates.js";
import { clearAllMapViews } from "../../../src/state/mapViewStore.js";
import { clearMapData } from "../../../src/state/mapDataStore.js";
import { clearToasts } from "../../../src/components/Toast/toastStore.js";
import { DATASET_IDS, clearCachedDataset } from "../../../src/services/cache/drillholeCache.js";

const RECORDS = [
  { holeId: "P-1", x: 418000, y: 4894000, holePurpose: "PRODUCT", gt: 0.18 },
  { holeId: "S-1", x: 418500, y: 4894500, holePurpose: "SEDIMENT" },
  { holeId: "R-1", x: 419000, y: 4895000, holePurpose: "DEVELOP", holeStatus: "INPROGRESS" },
];
const VIEWPORT = { width: 1000, height: 700 };
// 300 px at zoom 1: the 1191 x 842 base map is fitted to 700 px high, and spans the UTM bounds.
const THREE_HUNDRED_PX = formatDistance((300 / ((1191 * 700) / 842)) * (MAP_UTM_BOUNDS.maxX - MAP_UTM_BOUNDS.minX));

beforeAll(() => {
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
  await clearCachedDataset(DATASET_IDS.explorationMap);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    ...VIEWPORT, top: 0, left: 0, right: VIEWPORT.width, bottom: VIEWPORT.height, x: 0, y: 0,
  });
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, text: () => Promise.resolve(JSON.stringify(RECORDS)) }));
});

afterEach(() => {
  cleanup();
  clearToasts();
  vi.restoreAllMocks();
});

async function renderLoaded() {
  const result = render(<><DrillMap /><ToastContainer /></>);
  await waitFor(() => expect(result.container.querySelectorAll(".drillhole-marker")).toHaveLength(RECORDS.length));
  const image = result.container.querySelector(".base-map");
  Object.defineProperty(image, "naturalWidth", { value: 1191 });
  Object.defineProperty(image, "naturalHeight", { value: 842 });
  await act(async () => fireEvent.load(image));

  return result;
}

const viewport = (container) => container.querySelector(".map-viewport");
const press = (target, release, x, y) => {
  fireEvent.pointerDown(target, { button: 0, pointerId: 1, clientX: x, clientY: y });
  fireEvent.pointerUp(release, { button: 0, pointerId: 1, clientX: x, clientY: y });
};
const ends = (container) => container.querySelectorAll(".measurement-layer path").length;
const label = (container) => container.querySelector(".measurement-label")?.textContent;

describe("Exploration Map toolbar", () => {
  it("has zoom, reset, measure and a single export button, and no Map Layers panel", async () => {
    const { container } = await renderLoaded();
    const toolbar = container.querySelector(".map-toolbar");

    ["Zoom in", "Zoom out", "Reset", "Measure distance", "Screenshot map"].forEach((name) => {
      expect(within(toolbar).getByRole("button", { name })).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: "Export as SVG" })).toBeNull();
    expect(document.querySelectorAll('.map-controls button')).toHaveLength(5);
    expect(container.querySelector(".map-layers")).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Map layers" })).toBeNull();
  });

  it("camera cancels on a second click, suspends the ruler and removes zoom percentage", async () => {
    const { container } = await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Measure distance" }));
    const camera = screen.getByRole("button", { name: "Screenshot map" });
    fireEvent.click(camera);
    expect(screen.getByRole("button", { name: "Measure distance" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Zoom in" }).disabled).toBe(true);
    expect(container.querySelector(".map-controls__level")).toBeNull();
    expect(container.querySelector(".map-scale-bar")).toBeTruthy();
    fireEvent.click(camera);
    expect(screen.queryByLabelText("Screenshot selection")).toBeNull();
    expect(screen.getByRole("button", { name: "Zoom in" }).disabled).toBe(false);
  });

  it("restores map interaction after a selected capture fails", async () => {
    await renderLoaded();
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Asset unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "Screenshot map" }));
    const overlay = screen.getByLabelText("Screenshot selection");
    Object.defineProperties(overlay, { clientWidth: { value: 1000 }, clientHeight: { value: 700 } });
    fireEvent.pointerDown(overlay, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(overlay, { clientX: 400, clientY: 300 });
    expect(screen.getByRole("dialog", { name: "Export Screenshot" })).toBeTruthy();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Export", exact: true }));
    expect(screen.queryByLabelText("Screenshot selection")).toBeNull();
    expect(await screen.findByText("Map export failed.")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Screenshot map" }).disabled).toBe(false));
    expect(screen.getByRole("button", { name: "Zoom in" }).disabled).toBe(false);
  });

  it("offers PNG and SVG through the camera without a standalone SVG button", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Screenshot map" }));
    expect(screen.getByLabelText("Screenshot selection")).toBeTruthy();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByRole("button", { name: "Export as SVG" })).toBeNull();
    const overlay = screen.getByLabelText("Screenshot selection");
    fireEvent.pointerDown(overlay, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(overlay, { clientX: 400, clientY: 300 });
    expect(screen.getByRole("dialog", { name: "Export Screenshot" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "PNG" }).checked).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "SVG" }));
    expect(screen.getByRole("radio", { name: "SVG" }).checked).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByLabelText("Screenshot selection")).toBeNull();
  });

  it("keeps Reset returning to the full map", async () => {
    const { container } = await renderLoaded();

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    await waitFor(() => expect(container.querySelector(".map-canvas").style.transform).not.toContain("scale(1)"));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    await waitFor(() => expect(container.querySelector(".map-canvas").style.transform).toBe("translate(0px, 0px) scale(1)"));
  });
});

describe("Exploration Map measurement", () => {
  it("places A, then B with a distance, then starts over", async () => {
    const { container } = await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Measure distance" }));

    press(viewport(container), viewport(container), 200, 300);
    expect(ends(container)).toBe(1);
    press(viewport(container), viewport(container), 500, 300);
    expect(label(container)).toBe(THREE_HUNDRED_PX);
    press(viewport(container), viewport(container), 600, 400);
    expect(ends(container)).toBe(1);
  });

  it("places a point when the press lands on a drillhole marker", async () => {
    const { container } = await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Measure distance" }));

    press(container.querySelector(".drillhole-marker"), viewport(container), 200, 300);

    expect(ends(container)).toBe(1);
    expect(viewport(container).className).toContain("is-measuring");
  });

  it("pans on drag without placing a point", async () => {
    const { container } = await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Measure distance" }));

    fireEvent.pointerDown(viewport(container), { button: 0, pointerId: 1, clientX: 200, clientY: 300 });
    fireEvent.pointerMove(viewport(container), { button: 0, pointerId: 1, clientX: 260, clientY: 330 });
    fireEvent.pointerUp(viewport(container), { button: 0, pointerId: 1, clientX: 260, clientY: 330 });

    expect(ends(container)).toBe(0);
  });

  it("clears the measurement and gives markers back their tooltips when switched off", async () => {
    const { container } = await renderLoaded();
    const ruler = screen.getByRole("button", { name: "Measure distance" });
    fireEvent.click(ruler);
    press(viewport(container), viewport(container), 200, 300);

    fireEvent.click(ruler);
    const marker = container.querySelector(".drillhole-marker");
    fireEvent.click(marker);

    expect(container.querySelector(".measurement-layer")).toBeNull();
    expect(viewport(container).className).not.toContain("is-measuring");
    expect(marker.className).toContain("is-open");
  });
});

describe("Exploration Map export", () => {
  const ASSETS = { baseMap: "data:image/svg+xml;base64,AAAA", rigIcon: "data:image/svg+xml;base64,BBBB" };
  const snapshot = {
    viewport: VIEWPORT,
    view: { scale: 1, translateX: 0, translateY: 0 },
    mapOrigin: { x: 5, y: 0 },
    mapSize: { width: 990, height: 700 },
    drillholes: RECORDS.map((record) => convertUtmToMapPosition(record)),
    measurement: [{ x: 418000, y: 4894000 }, { x: 418300, y: 4894400 }],
    title: "Exploration Map",
  };

  it("names files after the page and the local time", () => {
    expect(exportFileName("png", new Date(2026, 9, 21, 9, 5))).toBe("DrillMap_2026-10-21_09-05-00.png");
  });

  it("builds a well-formed SVG with the markers, measurement and title", () => {
    const doc = new DOMParser().parseFromString(buildMapSvg(snapshot, ASSETS, 2), "image/svg+xml");
    const text = [...doc.querySelectorAll("text")].map((node) => node.textContent);

    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.documentElement.getAttribute("width")).toBe("2000");
    expect(doc.querySelectorAll(`image[href='${ASSETS.rigIcon}']`)).toHaveLength(1);
    expect(text).toEqual(expect.arrayContaining(["Exploration Map", "N", "500 m"]));
  });
});
