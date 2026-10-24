import { describe, expect, it } from "vitest";
import {
  BASE_MAP_SRC,
  MAP_CONFIG,
  MAP_ID,
  MAP_SETTINGS,
  MAP_UTM_BOUNDS,
  getGtRange,
} from "../../../src/pages/TechnoMap/config/technoMapConfig.js";
import { MARKER_KINDS } from "../../../src/pages/TechnoMap/utils/markerKind.js";
import {
  DRILLHOLE_TYPES,
  FILTER_IDS,
  MAP_FEATURES,
} from "../../../src/pages/TechnoMap/config/technoMapConfig.js";

describe("getGtRange", () => {
  it("puts a mid-band value in the right band", () => {
    expect(getGtRange(0.18).label).toBe("0.1 – 0.25");
  });

  it("treats each band as inclusive of its lower bound", () => {
    expect(getGtRange(0.025).label).toBe("0.025 – 0.05");
    expect(getGtRange(0.05).label).toBe("0.05 – 0.1");
    expect(getGtRange(0.5).label).toBe("0.5 – 4");
  });

  it("places a true zero in the lowest band", () => {
    expect(getGtRange(0).label).toBe("0 – 0.025");
  });

  it("includes the top of the final band", () => {
    expect(getGtRange(4).label).toBe("0.5 – 4");
  });

  it("rejects values outside the measurable range", () => {
    expect(getGtRange(4.0001)).toBeNull();
    expect(getGtRange(-0.1)).toBeNull();
  });

  it("accepts numeric strings from the API", () => {
    expect(getGtRange("0.3").label).toBe("0.25 – 0.5");
  });

  it("rejects missing values instead of colouring them as zero", () => {
    expect(getGtRange(null)).toBeNull();
    expect(getGtRange(undefined)).toBeNull();
    expect(getGtRange("")).toBeNull();
  });

  it("rejects a whitespace-only string", () => {
    // "   " coerces to 0 and would otherwise be painted as a real low-GT hole.
    expect(getGtRange("   ")).toBeNull();
  });

  it("rejects booleans", () => {
    expect(getGtRange(true)).toBeNull();
    expect(getGtRange(false)).toBeNull();
  });

  it("rejects non-numeric text", () => {
    expect(getGtRange("n/a")).toBeNull();
    expect(getGtRange(NaN)).toBeNull();
  });

  it("covers the whole 0–4 span with no gaps", () => {
    for (let v = 0; v <= 4; v += 0.01) {
      expect(getGtRange(Number(v.toFixed(2)))).not.toBeNull();
    }
  });

  it("returns a band carrying a label and a colour", () => {
    expect(getGtRange(0.18)).toMatchObject({
      label: expect.any(String),
      color: expect.stringMatching(/^#/),
    });
    expect(MAP_CONFIG.gtRanges).toHaveLength(6);
  });

  it("returns a band from this page's own config", () => {
    expect(MAP_CONFIG.gtRanges).toContain(getGtRange(0.18));
  });
});

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

  it("gives every drillhole type a distinct colour", () => {
    const colours = MAP_CONFIG.drillholeTypes.map(({ color }) => color);

    expect(new Set(colours).size).toBe(colours.length);
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
