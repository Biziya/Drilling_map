import { describe, expect, it } from "vitest";
import {
  BASE_MAP_SRC,
  MAP_CONFIG,
  MAP_ID,
  MAP_SETTINGS,
  MAP_UTM_BOUNDS,
} from "../../../src/pages/TechnoMap/config/technoMapConfig.js";
import { MARKER_KINDS } from "../../../src/pages/TechnoMap/utils/markerKind.js";
import {
  DRILLHOLE_TYPES,
  FILTER_IDS,
  MAP_FEATURES,
} from "../../../src/pages/TechnoMap/config/technoMapConfig.js";

describe("zoom settings", () => {
  it("exposes the page's zoom block as MAP_SETTINGS", () => {
    expect(MAP_SETTINGS).toBe(MAP_CONFIG.zoom);
    expect(MAP_SETTINGS.deviationMinZoom).toBe(10);
  });

  it("no longer carries the old Exploration-only threshold either", () => {
    expect(MAP_SETTINGS.deviationVisibleFromZoom).toBeUndefined();
  });
});

describe("Techno Map config", () => {
  it("stores its data under the techno-map id", () => {
    expect(MAP_ID).toBe("techno-map");
  });

  it("is titled Techno Map", () => {
    expect(MAP_CONFIG.title).toBe("Techno Map");
  });

  it("labels the rig 'Drill rig' and keeps the producer and injector labels", () => {
    expect(MAP_CONFIG.markerLabels).toMatchObject({
      rig: "Drill rig",
      producer: "Producer drillhole",
      injector: "Injector drillhole",
    });
  });

  it("has a label for every marker kind it can draw", () => {
    MARKER_KINDS.forEach((kind) => expect(MAP_CONFIG.markerLabels[kind]).toEqual(expect.any(String)));
  });

  it("defaults to the backend dataset", () => {
    expect(MAP_CONFIG.dataSource).toBe("backend");
  });

  it("defines exactly 12 filters: nine drillhole types and three feature layers", () => {
    expect(FILTER_IDS).toHaveLength(12);
    expect(MAP_CONFIG.drillholeTypes.map(({ id }) => id)).toEqual([...DRILLHOLE_TYPES]);
    expect(MAP_CONFIG.mapFeatures.map(({ id }) => id)).toEqual([...MAP_FEATURES]);
    expect(MAP_CONFIG.drillholeTypes.map(({ label }) => label)).toEqual([
      "Development", "Exploration", "Geotechnical", "Injector", "Monitoring",
      "Producer", "Ra-grade-sampling", "Sediment-sampling", "Water",
    ]);
    expect(MAP_CONFIG.mapFeatures.map(({ label }) => label))
      .toEqual(["Technological cells", "Drilling in progress", "Deviation line"]);
  });

  // The marker table: shapes and colour families per category. Development,
  // Exploration and both sampling categories share the orange circle.
  it("draws each drillhole type with its agreed shape and colour", () => {
    const byType = Object.fromEntries(MAP_CONFIG.drillholeTypes.map(({ id, shape, color }) => [id, [shape, color]]));
    const ORANGE = byType.development[1];

    expect(byType).toEqual({
      development: ["circle", ORANGE],
      exploration: ["circle", ORANGE],
      geotechnical: ["star", expect.any(String)],
      injector: ["triangle-down", expect.any(String)],
      monitoring: ["diamond", expect.any(String)],
      producer: ["square", expect.any(String)],
      "ra-grade-sampling": ["circle", ORANGE],
      "sediment-sampling": ["circle", ORANGE],
      water: ["square", expect.any(String)],
    });
    // Gray, red, green, blue and light teal: each its own colour, none orange.
    const others = ["geotechnical", "injector", "monitoring", "producer", "water"].map((id) => byType[id][1]);
    expect(new Set([...others, ORANGE]).size).toBe(6);
  });

  it("sizes markers from YAML, the rig larger than the shapes", () => {
    expect(MAP_CONFIG.markers).toEqual({ size: 13, polygonSize: 15, outline: 2, rigSize: 32 });
  });

  it("has no GT bands: the legend no longer shows GT and markers take their category colour", () => {
    expect(MAP_CONFIG).not.toHaveProperty("gtRanges");
    expect(MAP_CONFIG.legend).not.toHaveProperty("gt");
  });

  it("calls the image base map the Redox Map, keeping its saved id", () => {
    expect(MAP_CONFIG.baseMap.options).toEqual([
      { id: "geological", label: "Redox Map" },
      { id: "white-grid", label: "White Grid Map" },
    ]);
  });

  it("carries the display settings", () => {
    expect(MAP_CONFIG.showLegends).toBe(true);
    expect(MAP_CONFIG.deviationExaggeration).toBe(5);
    expect(MAP_CONFIG.rigIconSrc).toBe("/rig.svg");
    expect(MAP_CONFIG.deviationLine.color).toBe("#ff0000");
    expect(MAP_CONFIG.zoom.fitPadding).toBeGreaterThan(0);
    expect(Object.keys(MAP_CONFIG.redox)).toEqual(["Reduced", "Intermediate", "Oxidized"]);
  });

  it("has no fallbackMarkerKind setting any more", () => {
    expect(MAP_CONFIG).not.toHaveProperty("fallbackMarkerKind");
  });

  it("exposes the base map and its UTM bounds", () => {
    expect(BASE_MAP_SRC).toBe("/base-map.svg");
    expect(MAP_UTM_BOUNDS.maxX).toBeGreaterThan(MAP_UTM_BOUNDS.minX);
    expect(MAP_UTM_BOUNDS.maxY).toBeGreaterThan(MAP_UTM_BOUNDS.minY);
  });
});
