import { describe, expect, it } from "vitest";
import {
  BASE_MAP_SRC,
  MAP_CONFIG,
  MAP_ID,
  MAP_SETTINGS,
  MAP_UTM_BOUNDS,
  baseMapLayout,
  getGtRange,
} from "../../../src/pages/DrillMap/config/drillMapConfig.js";
import { MAP_IMAGE_PATH, MAP_UTM_BOUNDS as ENV_UTM_BOUNDS } from "../../../src/config/env.js";
import { MARKER_KINDS } from "../../../src/pages/DrillMap/utils/markerKind.js";
import { convertUtmToMapPosition, mapRatioToUtm, utmToMapRatio } from "../../../src/pages/DrillMap/utils/coordinates.js";

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

});

describe("Exploration Map config", () => {
  it("stores its data under the exploration-map id", () => {
    expect(MAP_ID).toBe("exploration-map");
  });

  it("is titled Exploration Map", () => {
    expect(MAP_CONFIG.title).toBe("Exploration Map");
  });

  it("labels its four marker roles, the rig as 'Rig'", () => {
    expect(MAP_CONFIG.markerLabels).toEqual({
      rig: "Rig",
      producer: "Producer drillhole",
      injector: "Injector drillhole",
      drillhole: "Drillhole",
    });
  });

  it("has a label for every marker kind it can draw", () => {
    MARKER_KINDS.forEach((kind) => expect(MAP_CONFIG.markerLabels[kind]).toEqual(expect.any(String)));
  });

  it("lists Producer, Drillhole and Drill Rig in the legend", () => {
    expect(MAP_CONFIG.legendSymbols).toEqual([
      { kind: "producer", label: "Producer" },
      { kind: "drillhole", label: "Drillhole" },
      { kind: "rig", label: "Drill Rig" },
    ]);
  });

  it("carries the display settings", () => {
    expect(MAP_CONFIG.showLegends).toBe(true);
    expect(MAP_CONFIG.deviationExaggeration).toBe(5);
    expect(MAP_CONFIG.rigIconSrc).toBe("/rig.svg");
    expect(MAP_CONFIG.uniformMarkerColor).toBe("#000000");
    expect(MAP_CONFIG.legendSymbolColor).toBe("#111827");
    expect(Object.keys(MAP_CONFIG.redox)).toEqual(["Reduced", "Intermediate", "Oxidized"]);
  });

  it("has no fallbackMarkerKind setting any more", () => {
    expect(MAP_CONFIG).not.toHaveProperty("fallbackMarkerKind");
  });

  it("exposes the default base map and its UTM bounds", () => {
    expect(BASE_MAP_SRC).toBe("/base-map3.svg");
    expect(MAP_UTM_BOUNDS).toBe(baseMapLayout("redox").bounds);
  });
});

describe("base maps", () => {
  const REDOX_BOUNDS = { minX: 412499.97, maxX: 423375.13, minY: 4890500, maxY: 4898190.29 };

  it("offers Redox, Geological and White Grid, defaulting to Redox", () => {
    expect(MAP_CONFIG.baseMap.options.map(({ id, label }) => [id, label])).toEqual([
      ["redox", "Redox Map"],
      ["geological", "Geological Map"],
      ["white-grid", "White Grid Map"],
    ]);
    expect(MAP_CONFIG.baseMap.default).toBe("redox");
  });

  it("validates the Redox Map's own image and corners", () => {
    const redox = MAP_CONFIG.baseMap.options.find(({ id }) => id === "redox");

    expect(redox.src).toBe("/base-map3.svg");
    expect(redox.bounds).toEqual(REDOX_BOUNDS);
    expect(baseMapLayout("redox")).toEqual({ src: "/base-map3.svg", imageSrc: "/base-map3.svg", bounds: REDOX_BOUNDS });
  });

  it("keeps the Geological Map on the environment's image and corners", () => {
    expect(baseMapLayout("geological")).toEqual({ src: MAP_IMAGE_PATH, imageSrc: MAP_IMAGE_PATH, bounds: ENV_UTM_BOUNDS });
  });

  it("lays the White Grid out on the geological image and corners, showing no image", () => {
    expect(baseMapLayout("white-grid")).toEqual({ src: null, imageSrc: MAP_IMAGE_PATH, bounds: ENV_UTM_BOUNDS });
  });

  it("places 418000 E / 4894000 N about half way across and 54.5% down the Redox Map", () => {
    const { bounds } = baseMapLayout("redox");
    const ratio = utmToMapRatio({ x: 418000, y: 4894000 }, bounds);
    const hole = convertUtmToMapPosition({ x: 418000, y: 4894000 }, bounds);

    expect(Math.abs(ratio.x - 0.506)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(ratio.y - 0.545)).toBeLessThanOrEqual(0.001);
    expect(hole).toMatchObject({ xPercent: ratio.x * 100, yPercent: ratio.y * 100, isInsideMap: true });
    expect(mapRatioToUtm(ratio, bounds).x).toBeCloseTo(418000, 6);
    expect(mapRatioToUtm(ratio, bounds).y).toBeCloseTo(4894000, 6);
  });

  it("falls back to the default's layout for an id that is not offered", () => {
    expect(baseMapLayout("satellite")).toBe(baseMapLayout("redox"));
  });
});
