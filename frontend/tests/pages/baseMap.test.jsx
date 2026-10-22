// The base map switcher and white grid, on both map pages. Each page owns its
// copy, so every check runs once per page.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import DrillMap from "../../src/pages/DrillMap/DrillMap.jsx";
import TechnoMap from "../../src/pages/TechnoMap/TechnoMap.jsx";
import * as drillConfig from "../../src/pages/DrillMap/config/drillMapConfig.js";
import * as technoConfig from "../../src/pages/TechnoMap/config/technoMapConfig.js";
import * as drillGrid from "../../src/pages/DrillMap/utils/coordinateGrid.js";
import * as technoGrid from "../../src/pages/TechnoMap/utils/coordinateGrid.js";
import * as drillCoordinates from "../../src/pages/DrillMap/utils/coordinates.js";
import * as technoCoordinates from "../../src/pages/TechnoMap/utils/coordinates.js";
import * as drillGeometry from "../../src/pages/DrillMap/utils/geometry.js";
import * as technoGeometry from "../../src/pages/TechnoMap/utils/geometry.js";
import * as drillExport from "../../src/pages/DrillMap/utils/exportMap.js";
import * as technoExport from "../../src/pages/TechnoMap/utils/exportMap.js";
import { BASE_MAP_STORAGE_KEY as DRILL_KEY, parseBaseMap as parseDrill } from "../../src/pages/DrillMap/hooks/useBaseMap.js";
import { BASE_MAP_STORAGE_KEY as TECHNO_KEY, parseBaseMap as parseTechno } from "../../src/pages/TechnoMap/hooks/useBaseMap.js";
import { ALL_VISIBLE } from "../../src/pages/TechnoMap/utils/mapFilters.js";
import { clearAllMapViews, readMapView, writeMapView } from "../../src/state/mapViewStore.js";
import { clearMapData } from "../../src/state/mapDataStore.js";
import { clearToasts } from "../../src/components/Toast/toastStore.js";

const VIEWPORT = { width: 1000, height: 700 };
const MAP_SIZE = { width: 990, height: 700 };
const ORIGIN = { x: 5, y: 0 };

const PAGES = [
  {
    name: "Exploration Map", Page: DrillMap, config: drillConfig, grid: drillGrid, coordinates: drillCoordinates,
    geometry: drillGeometry, exporter: drillExport, key: DRILL_KEY, otherKey: TECHNO_KEY, parse: parseDrill, mapId: "exploration-map",
  },
  {
    name: "Techno Map", Page: TechnoMap, config: technoConfig, grid: technoGrid, coordinates: technoCoordinates,
    geometry: technoGeometry, exporter: technoExport, key: TECHNO_KEY, otherKey: DRILL_KEY, parse: parseTechno, mapId: "techno-map",
  },
];

beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

beforeEach(() => {
  clearAllMapViews();
  clearMapData();
  clearToasts();
  localStorage.clear();
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    ...VIEWPORT, top: 0, left: 0, right: VIEWPORT.width, bottom: VIEWPORT.height, x: 0, y: 0,
  });
  globalThis.fetch = vi.fn(() => new Promise(() => {}));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function renderPage(Page) {
  const result = render(<Page />);
  await act(async () => {});
  const image = result.container.querySelector(".base-map");
  Object.defineProperty(image, "naturalWidth", { value: 1191 });
  Object.defineProperty(image, "naturalHeight", { value: 842 });
  await act(async () => fireEvent.load(image));

  return result;
}

const openMenu = () => fireEvent.click(screen.getByRole("button", { name: "Base map" }));
const choose = (label) => {
  openMenu();
  fireEvent.click(screen.getByRole("menuitemradio", { name: label }));
};

describe.each(PAGES)("$name base map", ({ Page, config, grid, coordinates, geometry, exporter, key, otherKey, parse, mapId }) => {
  describe("configuration", () => {
    it("offers Geological Map then White Grid Map, defaulting to Geological", () => {
      expect(config.MAP_CONFIG.baseMap.options.map(({ label }) => label)).toEqual(["Geological Map", "White Grid Map"]);
      expect(config.MAP_CONFIG.baseMap.default).toBe("geological");
    });

    it("falls back to the default for a missing or unknown stored choice", () => {
      expect(parse(null)).toBe("geological");
      expect(parse("satellite")).toBe("geological");
      expect(parse("white-grid")).toBe("white-grid");
    });

    it("stores the choice under this page's own key", () => {
      expect(key).toBe(`${mapId}:base-map`);
      expect(key).not.toBe(otherKey);
    });
  });

  describe("coordinate grid", () => {
    const options = (view, overrides = {}) => ({
      viewport: VIEWPORT, view, mapOrigin: ORIGIN, mapSize: MAP_SIZE, minLineSpacing: 90, labelFontSize: 10.5, ...overrides,
    });
    const fullView = { scale: 1, translateX: 0, translateY: 0 };

    it("picks round 1/2/5 steps", () => {
      expect(grid.niceStepAtLeast(0.3)).toBeCloseTo(0.5);
      expect(grid.niceStepAtLeast(1)).toBe(1);
      expect(grid.niceStepAtLeast(1.2)).toBe(2);
      expect(grid.niceStepAtLeast(430)).toBe(500);
      expect(grid.niceStepAtLeast(501)).toBe(1000);
    });

    it("covers exactly the map's UTM bounds", () => {
      const { sheet } = grid.computeCoordinateGrid(options(fullView));

      expect(sheet).toEqual({ left: 5, top: 0, right: 995, bottom: 700 });
    });

    it("draws each easting and northing exactly where a drillhole at that coordinate is placed", () => {
      const view = { scale: 4, translateX: -1500, translateY: -900 };
      const result = grid.computeCoordinateGrid(options(view));
      const vertical = result.lines.filter(({ x1, x2 }) => x1 === x2).map(({ x1 }) => x1);
      const horizontal = result.lines.filter(({ y1, y2 }) => y1 === y2).map(({ y1 }) => y1);
      const eastings = result.labels.filter(({ text }) => text.startsWith("E "));
      expect(vertical.length).toBeGreaterThan(2);
      expect(horizontal.length).toBeGreaterThan(2);
      expect(eastings.length).toBeGreaterThan(1);

      // A drillhole collared on a grid intersection is drawn on it: the
      // marker's percentage position, under the same view, lands on both lines.
      const topLeft = coordinates.mapRatioToUtm(geometry.viewportToMapRatio({ x: 0, y: 0 }, view, ORIGIN, MAP_SIZE));
      const hole = coordinates.convertUtmToMapPosition({
        x: Math.ceil(topLeft.x / result.step) * result.step,
        y: Math.floor(topLeft.y / result.step) * result.step,
      });
      const at = geometry.mapRatioToViewport({ x: hole.xPercent / 100, y: hole.yPercent / 100 }, view, ORIGIN, MAP_SIZE);

      expect(vertical.some((x) => Math.abs(x - at.x) < 1e-6)).toBe(true);
      expect(horizontal.some((y) => Math.abs(y - at.y) < 1e-6)).toBe(true);
    });

    it("keeps lines at least the configured spacing apart and refines the step as the map zooms in", () => {
      const far = grid.computeCoordinateGrid(options(fullView));
      const near = grid.computeCoordinateGrid(options({ scale: 20, translateX: -9000, translateY: -6000 }));
      const gap = (result) => {
        const xs = result.lines.filter(({ x1, x2 }) => x1 === x2).map(({ x1 }) => x1);

        return xs[1] - xs[0];
      };

      expect(near.step).toBeLessThan(far.step);
      expect(gap(far)).toBeGreaterThanOrEqual(90);
      expect(gap(near)).toBeGreaterThanOrEqual(90);
    });

    it("draws nothing when the map is panned out of view", () => {
      expect(grid.computeCoordinateGrid(options({ scale: 1, translateX: 5000, translateY: 0 }))).toBeNull();
    });
  });

  describe("header switcher", () => {
    it("sits between Refresh and the drillhole count", async () => {
      const { container } = await renderPage(Page);
      const group = container.querySelector(".map-header > div:last-child");
      const children = [...group.children];
      const refresh = screen.getByRole("button", { name: "Refresh map data" });
      const switcher = screen.getByRole("button", { name: "Base map" });

      expect(children.indexOf(refresh)).toBe(0);
      expect(children[1].contains(switcher)).toBe(true);
      expect(children[2].tagName).toBe("STRONG");
    });

    it("opens a menu with both base maps, Geological ticked first time", async () => {
      await renderPage(Page);
      openMenu();
      const items = within(screen.getByRole("menu", { name: "Base map" })).getAllByRole("menuitemradio");

      expect(items.map((item) => item.textContent)).toEqual(["Geological Map", "White Grid Map"]);
      expect(items.map((item) => item.getAttribute("aria-checked"))).toEqual(["true", "false"]);
    });

    it("switches the background in place, closes the menu, and keeps the view and features", async () => {
      writeMapView(mapId, { scale: 1.8, translateX: -120, translateY: -40 });
      const { container } = await renderPage(Page);
      const before = [...container.querySelectorAll(".drillhole-marker")].map((marker) => marker.parentElement.getAttribute("style"));
      const canvasStyle = container.querySelector(".map-canvas").getAttribute("style");

      choose("White Grid Map");

      expect(screen.queryByRole("menu")).toBeNull();
      expect(container.querySelector(".base-map").classList.contains("is-hidden")).toBe(true);
      expect(container.querySelector(".coordinate-grid")).not.toBeNull();
      expect(container.querySelector(".coordinate-grid").nextElementSibling.classList.contains("map-canvas")).toBe(true);
      expect(container.querySelector(".map-canvas").getAttribute("style")).toBe(canvasStyle);
      expect([...container.querySelectorAll(".drillhole-marker")].map((marker) => marker.parentElement.getAttribute("style"))).toEqual(before);
      expect(readMapView(mapId, null)).toEqual({ scale: 1.8, translateX: -120, translateY: -40 });

      choose("Geological Map");

      expect(container.querySelector(".base-map").classList.contains("is-hidden")).toBe(false);
      expect(container.querySelector(".coordinate-grid")).toBeNull();
      expect(container.querySelector(".map-canvas").getAttribute("style")).toBe(canvasStyle);
    });

    it("remembers the choice across a remount, without touching the other page's choice", async () => {
      const first = await renderPage(Page);
      choose("White Grid Map");
      first.unmount();

      expect(JSON.parse(localStorage.getItem(key))).toBe("white-grid");
      expect(localStorage.getItem(otherKey)).toBeNull();

      const { container } = await renderPage(Page);
      expect(container.querySelector(".coordinate-grid")).not.toBeNull();
      openMenu();
      expect(screen.getByRole("menuitemradio", { name: "White Grid Map" }).getAttribute("aria-checked")).toBe("true");
    });

    it("closes on Escape without changing the background", async () => {
      const { container } = await renderPage(Page);
      openMenu();
      fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });

      expect(screen.queryByRole("menu")).toBeNull();
      expect(container.querySelector(".coordinate-grid")).toBeNull();
    });
  });

  describe("export", () => {
    const snapshot = (baseMap) => ({
      viewport: VIEWPORT,
      view: { scale: 1, translateX: 0, translateY: 0 },
      mapOrigin: ORIGIN,
      mapSize: MAP_SIZE,
      drillholes: [],
      cells: [],
      filters: ALL_VISIBLE,
      measurement: [{ x: 415000, y: 4893000 }, { x: 418000, y: 4895000 }],
      title: "Map",
      baseMap,
    });
    const ASSETS = { baseMap: "data:image/png;base64,AAAA", rigIcon: "data:image/svg+xml;base64,BBBB" };
    const parse = (svg) => new DOMParser().parseFromString(svg, "image/svg+xml");

    it("embeds the geological image when it is selected", () => {
      const doc = parse(exporter.buildMapSvg(snapshot("geological"), ASSETS));

      expect(doc.querySelector(`image[href='${ASSETS.baseMap}']`)).not.toBeNull();
      expect([...doc.querySelectorAll("text")].some(({ textContent }) => textContent.startsWith("E "))).toBe(false);
    });

    it("draws the white sheet, grid and coordinate labels instead when the white grid is selected", () => {
      const doc = parse(exporter.buildMapSvg(snapshot("white-grid"), { ...ASSETS, baseMap: null }));
      const labels = [...doc.querySelectorAll("text")].map(({ textContent }) => textContent);
      const sheet = doc.querySelector(`rect[fill='${config.MAP_CONFIG.baseMap.whiteGrid.background}']`);

      expect(doc.querySelector("parsererror")).toBeNull();
      expect(doc.querySelector(`image[href='${ASSETS.baseMap}']`)).toBeNull();
      expect(sheet.getAttribute("x")).toBe("5");
      expect(sheet.getAttribute("width")).toBe("990");
      expect(doc.querySelectorAll(`g[stroke='${config.MAP_CONFIG.baseMap.whiteGrid.lineColor}'] line`).length).toBeGreaterThan(4);
      expect(labels.some((text) => text.startsWith("E "))).toBe(true);
      expect(labels.some((text) => text.startsWith("N "))).toBe(true);
      // The measurement, title, north arrow and scale bar are still drawn.
      expect(labels).toEqual(expect.arrayContaining(["Map", "N"]));
      expect(labels.some((text) => /\d+(\.\d+)? (m|km)$/.test(text))).toBe(true);
    });
  });
});
