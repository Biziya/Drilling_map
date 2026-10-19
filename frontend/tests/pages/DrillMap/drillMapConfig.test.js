import { describe, expect, it } from "vitest";
import { GT_RANGES, getDrillholeStatus, getGtRange } from "../../../src/pages/DrillMap/drillMapConfig.js";
import {
  TECHNO_GT_RANGES,
  getTechnoMapDrillholeStatus,
  getTechnoMapGtRange,
} from "../../../src/pages/TechnoMap/technoMapConfig.js";
import { classNames } from "../../../src/pages/DrillMap/classNames.js";
import { classNames as technoClassNames } from "../../../src/pages/TechnoMap/classNames.js";

const copies = [
  ["DrillMap", getGtRange, getDrillholeStatus, GT_RANGES],
  ["TechnoMap", getTechnoMapGtRange, getTechnoMapDrillholeStatus, TECHNO_GT_RANGES],
];

describe.each(copies)("%s config", (_name, gtRange, drillholeStatus, ranges) => {
  describe("getGtRange", () => {
    it("puts a mid-band value in the right band", () => {
      expect(gtRange(0.18).label).toBe("0.1 – 0.25");
    });

    it("treats each band as inclusive of its lower bound", () => {
      expect(gtRange(0.025).label).toBe("0.025 – 0.05");
      expect(gtRange(0.05).label).toBe("0.05 – 0.1");
      expect(gtRange(0.5).label).toBe("0.5 – 4");
    });

    it("places a true zero in the lowest band", () => {
      expect(gtRange(0).label).toBe("0 – 0.025");
    });

    it("includes the top of the final band", () => {
      expect(gtRange(4).label).toBe("0.5 – 4");
    });

    it("rejects values outside the measurable range", () => {
      expect(gtRange(4.0001)).toBeNull();
      expect(gtRange(-0.1)).toBeNull();
    });

    it("accepts numeric strings from the API", () => {
      expect(gtRange("0.3").label).toBe("0.25 – 0.5");
    });

    it("rejects missing values instead of colouring them as zero", () => {
      expect(gtRange(null)).toBeNull();
      expect(gtRange(undefined)).toBeNull();
      expect(gtRange("")).toBeNull();
    });

    it("rejects a whitespace-only string", () => {
      // "   " coerces to 0 and would otherwise be painted as a real low-GT hole.
      expect(gtRange("   ")).toBeNull();
    });

    it("rejects booleans", () => {
      expect(gtRange(true)).toBeNull();
      expect(gtRange(false)).toBeNull();
    });

    it("rejects non-numeric text", () => {
      expect(gtRange("n/a")).toBeNull();
      expect(gtRange(NaN)).toBeNull();
    });

    it("covers the whole 0–4 span with no gaps", () => {
      for (let v = 0; v <= 4; v += 0.01) {
        expect(gtRange(Number(v.toFixed(2)))).not.toBeNull();
      }
    });

    it("returns a band carrying a label and a colour", () => {
      expect(gtRange(0.18)).toMatchObject({
        label: expect.any(String),
        color: expect.stringMatching(/^#/),
      });
      expect(ranges).toHaveLength(6);
    });
  });

  describe("getDrillholeStatus", () => {
    it("uses a recognised explicit status", () => {
      expect(drillholeStatus({ status: "Infill Program" })).toBe("Infill Program");
    });

    it("falls back for an unrecognised status", () => {
      expect(drillholeStatus({ status: "Made Up" })).toBe("Validated");
    });

    it("infers a planned hole from the coordinate type", () => {
      expect(drillholeStatus({ coordinateType: "Planned UTM" }))
        .toBe("Infill Program - Next Points");
    });

    it("matches the coordinate type case-insensitively", () => {
      expect(drillholeStatus({ coordinateType: "PLANNED" }))
        .toBe("Infill Program - Next Points");
    });

    it("defaults to Validated when nothing is known", () => {
      expect(drillholeStatus({})).toBe("Validated");
      expect(drillholeStatus({ coordinateType: null })).toBe("Validated");
    });
  });
});

describe.each([["DrillMap", classNames], ["TechnoMap", technoClassNames]])(
  "%s/classNames",
  (_name, join) => {
    it("joins the truthy parts", () => {
      expect(join("map-viewport", "is-zoomed")).toBe("map-viewport is-zoomed");
    });

    it("drops false, null, undefined and empty strings", () => {
      expect(join("a", false, null, undefined, "", "b")).toBe("a b");
    });

    it("returns an empty string when nothing is truthy", () => {
      expect(join(false, null)).toBe("");
      expect(join()).toBe("");
    });
  },
);
