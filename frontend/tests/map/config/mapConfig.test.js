import { describe, expect, it } from "vitest";
import {
  MAP_CONFIG,
  MAP_SETTINGS,
  getGtRange,
  parseMapPageConfig,
} from "../../../src/map/config/mapConfig.js";
import drillMapYaml from "../../../src/pages/DrillMap/config/drillMap.yaml";
import technoMapYaml from "../../../src/pages/TechnoMap/config/technoMap.yaml";

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
});

describe("zoom settings", () => {
  // Both maps read the one shared zoom block, so the deviation lines appear
  // from the same zoom level on each.
  it("exposes the shared zoom block as MAP_SETTINGS", () => {
    expect(MAP_SETTINGS).toBe(MAP_CONFIG.zoom);
    expect(MAP_SETTINGS.deviationMinZoom).toBe(10);
  });

  it("no longer carries an Exploration-only threshold", () => {
    expect(MAP_SETTINGS.deviationVisibleFromZoom).toBeUndefined();
  });
});

describe("parseMapPageConfig", () => {
  it("accepts the Exploration Map page file", () => {
    const config = parseMapPageConfig(structuredClone(drillMapYaml), "drillMap.yaml");

    expect(config.id).toBe("exploration-map");
    expect(config.fallbackMarkerKind).toBe("drillhole");
    expect(config.markerLabels.rig).toBe("Rig");
    expect(config.legendSymbols.map(({ kind }) => kind)).toEqual(["producer", "drillhole", "rig"]);
  });

  it("accepts the Techno Map page file", () => {
    const config = parseMapPageConfig(structuredClone(technoMapYaml), "technoMap.yaml");

    expect(config.id).toBe("techno-map");
    expect(config.fallbackMarkerKind).toBe("injector");
    expect(config.markerLabels.rig).toBe("Drill rig");
    expect(config.legendSymbols.map(({ kind }) => kind)).toEqual(["injector", "producer", "rig"]);
  });

  it("rejects an unknown fallbackMarkerKind, naming the file and path", () => {
    const bad = { ...structuredClone(drillMapYaml), fallbackMarkerKind: "circle" };

    expect(() => parseMapPageConfig(bad, "bad.yaml")).toThrow(/bad\.yaml\.fallbackMarkerKind/);
  });
});
