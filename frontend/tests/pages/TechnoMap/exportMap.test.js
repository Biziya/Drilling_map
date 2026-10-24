import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMapSvg, exportFileName, exportMap } from "../../../src/pages/TechnoMap/utils/exportMap.js";
import { ALL_VISIBLE, setAllFilters } from "../../../src/pages/TechnoMap/utils/mapFilters.js";
import { convertUtmToMapPosition } from "../../../src/pages/TechnoMap/utils/coordinates.js";
import { MAP_CONFIG } from "../../../src/pages/TechnoMap/config/technoMapConfig.js";
import { MOCK_CELLS, MOCK_DRILLHOLES } from "../../../src/pages/TechnoMap/mock/mockData.js";

const ASSETS = { baseMap: "data:image/svg+xml;base64,AAAA", rigIcon: "data:image/svg+xml;base64,BBBB" };
const drillholes = MOCK_DRILLHOLES.map((hole) => convertUtmToMapPosition(hole));

// The whole map in view at scale 1: 990 x 700 map in a 1000 x 700 viewport.
const snapshot = (overrides = {}) => ({
  viewport: { width: 1000, height: 700 },
  view: { scale: 1, translateX: 0, translateY: 0 },
  mapOrigin: { x: 5, y: 0 },
  mapSize: { width: 990, height: 700 },
  drillholes,
  cells: MOCK_CELLS,
  filters: ALL_VISIBLE,
  measurement: [],
  title: "Techno Map",
  ...overrides,
});

const parse = (svg) => new DOMParser().parseFromString(svg, "image/svg+xml");
const markerCount = (doc) => doc.querySelectorAll("image").length - 1 // minus the base map
  + doc.querySelectorAll("circle").length
  + doc.querySelectorAll("polygon[fill='#fff']").length;

afterEach(() => vi.restoreAllMocks());

describe("exportFileName", () => {
  it("uses the local date and time", () => {
    const date = new Date(2026, 9, 21, 9, 5);

    expect(exportFileName("png", date)).toBe("TechnoMap_2026-10-21_09-05.png");
    expect(exportFileName("svg", date)).toBe("TechnoMap_2026-10-21_09-05.svg");
  });
});

describe("buildMapSvg", () => {
  it("is well-formed SVG at the viewport size", () => {
    const doc = parse(buildMapSvg(snapshot(), ASSETS));
    const root = doc.documentElement;

    expect(doc.querySelector("parsererror")).toBeNull();
    expect(root.getAttribute("width")).toBe("1000");
    expect(root.getAttribute("height")).toBe("700");
    expect(root.getAttribute("viewBox")).toBe("0 0 1000 700");
  });

  it("doubles the pixel size for PNG while keeping the aspect ratio", () => {
    const root = parse(buildMapSvg(snapshot(), ASSETS, 2)).documentElement;

    expect(root.getAttribute("width")).toBe("2000");
    expect(root.getAttribute("height")).toBe("1400");
    expect(root.getAttribute("viewBox")).toBe("0 0 1000 700");
  });

  it("embeds the base map under the current pan and zoom", () => {
    const view = { scale: 3, translateX: -1200, translateY: -600 };
    const base = parse(buildMapSvg(snapshot({ view }), ASSETS)).querySelector("image");

    expect(base.getAttribute("href")).toBe(ASSETS.baseMap);
    expect(base.getAttribute("x")).toBe(String(5 - 1200));
    expect(base.getAttribute("width")).toBe(String(990 * 3));
  });

  it("draws every shown drillhole as a vector shape or the rig icon, plus title, north arrow and scale bar", () => {
    const doc = parse(buildMapSvg(snapshot(), ASSETS));
    const text = [...doc.querySelectorAll("text")].map((node) => node.textContent);

    expect(markerCount(doc)).toBe(130);
    expect(doc.querySelectorAll(`image[href='${ASSETS.rigIcon}']`)).toHaveLength(10);
    expect(text).toContain("Techno Map");
    expect(text).toContain("N");
    expect(text.some((label) => /\d+ (m|km)$/.test(label))).toBe(true);
  });

  it("respects the filters but always keeps the base map and chrome", () => {
    const doc = parse(buildMapSvg(snapshot({ filters: setAllFilters(false) }), ASSETS));
    const text = [...doc.querySelectorAll("text")].map((node) => node.textContent);

    expect(markerCount(doc)).toBe(0);
    expect(doc.querySelector(`image[href='${ASSETS.baseMap}']`)).toBeTruthy();
    expect(text).not.toContain("TC-001");
    expect(text).toContain("Techno Map");
  });

  // /api/techno-map rows: no cells, an unmapped Type, a deviation endpoint.
  it("exports backend records by their category, with the API's deviation endpoint", () => {
    const records = [
      { holeId: "P-1", x: 418200, y: 4894300, holePurpose: "PRODUCT", category: "producer", deviationEndX: 418210, deviationEndY: 4894300 },
      { holeId: "U-1", x: 418250, y: 4894300, holePurpose: "SER", category: null },
    ].map((hole) => convertUtmToMapPosition(hole));
    // Zoomed onto the wellfield, past the deviation zoom.
    const view = { scale: 12, translateX: -5730, translateY: -3900 };
    const doc = parse(buildMapSvg(snapshot({ drillholes: records, cells: [], view }), ASSETS));

    expect(doc.querySelectorAll("polygon[fill='#fff']")).toHaveLength(1);
    expect(doc.querySelectorAll(`line[stroke='${MAP_CONFIG.deviationLine.color}']`)).toHaveLength(1);
    expect(doc.querySelectorAll(`polygon[stroke='${MAP_CONFIG.technologicalCells.stroke}']`)).toHaveLength(0);
  });

  it("draws the technological cells and their labels when enabled", () => {
    const doc = parse(buildMapSvg(snapshot(), ASSETS));
    const text = [...doc.querySelectorAll("text")].map((node) => node.textContent);

    expect(doc.querySelectorAll(`polygon[stroke='${MAP_CONFIG.technologicalCells.stroke}']`)).toHaveLength(5);
    expect(text).toEqual(expect.arrayContaining(["TC-001", "TC-005"]));
  });

  it("draws deviation lines only past the deviation zoom and with the layer on", () => {
    const deviationLines = (overrides) => parse(buildMapSvg(snapshot(overrides), ASSETS))
      .querySelectorAll(`line[stroke='${MAP_CONFIG.deviationLine.color}']`).length;
    // Zoomed onto the wellfield so every deviated hole is in view.
    const zoomed = { scale: 12, translateX: -5730, translateY: -3900 };

    expect(deviationLines({})).toBe(0);
    expect(deviationLines({ view: zoomed })).toBeGreaterThan(0);
    expect(deviationLines({ view: zoomed, filters: { ...ALL_VISIBLE, "deviation-line": false } })).toBe(0);
  });

  it("leaves out holes far outside the view", () => {
    const panned = { scale: 1, translateX: 5000, translateY: 0 };

    expect(markerCount(parse(buildMapSvg(snapshot({ view: panned }), ASSETS)))).toBe(0);
  });

  it("includes an active measurement with its distance label", () => {
    const measurement = [{ x: 418000, y: 4894000 }, { x: 418300, y: 4894400 }];
    const doc = parse(buildMapSvg(snapshot({ measurement, filters: setAllFilters(false) }), ASSETS));

    expect(doc.querySelector("line[stroke-dasharray]")).toBeTruthy();
    expect(doc.querySelectorAll(`g[stroke='${MAP_CONFIG.measurement.color}'] path`)).toHaveLength(2);
    expect([...doc.querySelectorAll("text")].map((node) => node.textContent)).toContain("500 m");
  });

  it("escapes the title", () => {
    const svg = buildMapSvg(snapshot({ title: "A & <B>" }), ASSETS);

    expect(parse(svg).querySelector("parsererror")).toBeNull();
    expect(svg).not.toContain("<B>");
  });
});

describe("exportMap", () => {
  // First: assets are cached once loaded, and a failed load is not cached.
  it("fails rather than exporting without the base map", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 404 }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await expect(exportMap("svg", snapshot())).rejects.toThrow();
    expect(click).not.toHaveBeenCalled();
  });

  it("downloads an SVG named after the current time", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(["<svg/>"])) }));
    const created = [];
    URL.createObjectURL = vi.fn((blob) => {
      created.push(blob);

      return "blob:export";
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function record() {
      click.downloaded = this.download;
    });

    await exportMap("svg", snapshot());

    expect(click).toHaveBeenCalledTimes(1);
    expect(click.downloaded).toMatch(/^TechnoMap_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.svg$/);
    expect(created[0].type).toBe("image/svg+xml");
  });

});
