import { describe, expect, it } from "vitest";
import {
  calculateDeviationEndpoint,
  convertUtmToMapPosition,
} from "../../../src/pages/DrillMap/utmCoordinates.js";
import {
  calculateTechnoMapDeviationEndpoint,
  convertUtmToTechnoMapPosition,
} from "../../../src/pages/TechnoMap/technoMapCoordinates.js";
import { DEVIATION_LINE_EXAGGERATION, MAP_UTM_BOUNDS } from "../../../src/pages/DrillMap/drillMapConfig.js";

// The two modules are the same algorithm under different export names.
const copies = [
  ["DrillMap", convertUtmToMapPosition, calculateDeviationEndpoint],
  ["TechnoMap", convertUtmToTechnoMapPosition, calculateTechnoMapDeviationEndpoint],
];

describe.each(copies)("%s coordinates", (_name, convert, calculateEndpoint) => {
  describe("convertUtmToMapPosition", () => {
    it("maps the bounds minimum corner to the top-left", () => {
      // minY maps to yPercent 100 because screen Y grows downward.
      const result = convert({ x: MAP_UTM_BOUNDS.minX, y: MAP_UTM_BOUNDS.maxY });

      expect(result.xPercent).toBeCloseTo(0);
      expect(result.yPercent).toBeCloseTo(0);
      expect(result.isInsideMap).toBe(true);
    });

    it("maps the opposite corner to the bottom-right", () => {
      const result = convert({ x: MAP_UTM_BOUNDS.maxX, y: MAP_UTM_BOUNDS.minY });

      expect(result.xPercent).toBeCloseTo(100);
      expect(result.yPercent).toBeCloseTo(100);
      expect(result.isInsideMap).toBe(true);
    });

    it("inverts the Y axis", () => {
      const north = convert({ x: 418000, y: 4897000 });
      const south = convert({ x: 418000, y: 4891000 });

      expect(north.yPercent).toBeLessThan(south.yPercent);
    });

    it("preserves the original record fields", () => {
      const result = convert({ holeId: "GTZO-1", x: 418000, y: 4894000, gt: 0.3 });

      expect(result.holeId).toBe("GTZO-1");
      expect(result.gt).toBe(0.3);
    });

    it("flags a point outside the bounds without discarding it", () => {
      const result = convert({ x: MAP_UTM_BOUNDS.maxX + 5000, y: 4894000 });

      expect(result.isInsideMap).toBe(false);
      expect(result.xPercent).toBeGreaterThan(100);
    });

    it("returns null for non-numeric coordinates", () => {
      expect(convert({ x: "abc", y: 4894000 })).toBeNull();
      expect(convert({ x: 418000, y: null })).toBeNull();
      expect(convert({})).toBeNull();
    });

    it("throws when the configured bounds are unusable", () => {
      // A bad config must fail loudly rather than silently plotting NaN.
      expect(() => convert({ x: 1, y: 1 }, { minX: 0, maxX: 0, minY: 0, maxY: 1 }))
        .toThrow(/bounds/i);
      expect(() => convert({ x: 1, y: 1 }, { minX: NaN, maxX: 1, minY: 0, maxY: 1 }))
        .toThrow(/bounds/i);
    });
  });

  describe("calculateDeviationEndpoint", () => {
    const base = { x: 418000, y: 4894000, finalDeviation: 10 };

    it("projects due north for azimuth 0", () => {
      const end = calculateEndpoint({ ...base, azimuth: 0 });

      expect(end.x).toBeCloseTo(418000);
      expect(end.y).toBeCloseTo(4894000 + 10 * DEVIATION_LINE_EXAGGERATION);
    });

    it("projects due east for azimuth 90", () => {
      const end = calculateEndpoint({ ...base, azimuth: 90 });

      expect(end.x).toBeCloseTo(418000 + 10 * DEVIATION_LINE_EXAGGERATION);
      expect(end.y).toBeCloseTo(4894000);
    });

    it("treats azimuth 360 the same as 0", () => {
      const at0 = calculateEndpoint({ ...base, azimuth: 0 });
      const at360 = calculateEndpoint({ ...base, azimuth: 360 });

      expect(at360.x).toBeCloseTo(at0.x);
      expect(at360.y).toBeCloseTo(at0.y);
    });

    it("applies the exaggeration factor", () => {
      const end = calculateEndpoint({ ...base, azimuth: 90, finalDeviation: 1 });

      expect(end.x - base.x).toBeCloseTo(DEVIATION_LINE_EXAGGERATION);
    });

    it("accepts numeric strings from the API", () => {
      const end = calculateEndpoint({ x: "418000", y: "4894000", azimuth: "90", finalDeviation: "10" });

      expect(end.x).toBeCloseTo(418000 + 50);
    });

    it("returns null for an out-of-range azimuth", () => {
      expect(calculateEndpoint({ ...base, azimuth: 361 })).toBeNull();
      expect(calculateEndpoint({ ...base, azimuth: -1 })).toBeNull();
    });

    it("returns null when there is no deviation to draw", () => {
      expect(calculateEndpoint({ ...base, azimuth: 45, finalDeviation: 0 })).toBeNull();
      expect(calculateEndpoint({ ...base, azimuth: 45, finalDeviation: -5 })).toBeNull();
      expect(calculateEndpoint({ ...base, azimuth: 45, finalDeviation: null })).toBeNull();
    });

    it("returns null when azimuth or position is missing", () => {
      expect(calculateEndpoint({ ...base, azimuth: null })).toBeNull();
      expect(calculateEndpoint({ ...base, azimuth: "" })).toBeNull();
      expect(calculateEndpoint({ x: null, y: 4894000, azimuth: 45, finalDeviation: 5 })).toBeNull();
    });
  });
});
