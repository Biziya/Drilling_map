import { describe, expect, it } from "vitest";
import * as drillFormatNumber from "../../../src/pages/DrillMap/formatNumber.js";
import * as technoFormatNumber from "../../../src/pages/TechnoMap/formatNumber.js";

const copies = [
  ["DrillMap", drillFormatNumber],
  ["TechnoMap", technoFormatNumber],
];

const EMPTY = "\u2014"; // em dash

describe.each(copies)("%s/formatNumber", (_name, mod) => {
  const { formatNumber, formatMeasurement } = mod;

  describe("formatNumber", () => {
    it("formats a finite number", () => {
      expect(formatNumber(12.3456)).toBe("12.3456");
    });

    it("honours the fraction-digit limit", () => {
      expect(formatNumber(12.3456, 2)).toBe("12.35");
      expect(formatNumber(418123.456, 2)).toBe("418,123.46");
    });

    it("formats a genuine zero as a number", () => {
      expect(formatNumber(0)).toBe("0");
    });

    it("formats negative numbers", () => {
      expect(formatNumber(-42.5, 1)).toBe("-42.5");
    });

    it("returns the empty marker for non-numeric text", () => {
      expect(formatNumber("abc")).toBe(EMPTY);
    });

    it("returns the empty marker for Infinity and NaN", () => {
      expect(formatNumber(Infinity)).toBe(EMPTY);
      expect(formatNumber(NaN)).toBe(EMPTY);
    });

    it("parses numeric strings coming back from the API", () => {
      expect(formatNumber("418123.5", 1)).toBe("418,123.5");
    });

    // --- Missing-value handling -------------------------------------------
    // These are the cases the API actually produces for an absent measurement.
    // All of them must read as "no data", never as a measured zero.
    it("returns the empty marker for undefined", () => {
      expect(formatNumber(undefined)).toBe(EMPTY);
    });

    it("returns the empty marker for null", () => {
      expect(formatNumber(null)).toBe(EMPTY);
    });

    it("returns the empty marker for an empty or whitespace string", () => {
      expect(formatNumber("")).toBe(EMPTY);
      expect(formatNumber("   ")).toBe(EMPTY);
    });

    it("returns the empty marker for booleans", () => {
      expect(formatNumber(false)).toBe(EMPTY);
      expect(formatNumber(true)).toBe(EMPTY);
    });

    it("returns the empty marker for arrays and objects", () => {
      expect(formatNumber([])).toBe(EMPTY);
      expect(formatNumber({})).toBe(EMPTY);
    });
  });

  describe("formatMeasurement", () => {
    it("appends the metre unit", () => {
      expect(formatMeasurement(125.456)).toBe("125.46 m");
    });

    it("rounds to two decimals", () => {
      expect(formatMeasurement(0.005)).toBe("0.01 m");
    });

    it("formats a real zero-metre reading", () => {
      expect(formatMeasurement(0)).toBe("0 m");
    });

    it("returns a bare marker without a unit when the value is missing", () => {
      // "0 m" for a missing depth is a data-integrity problem, not a display nit.
      expect(formatMeasurement(null)).toBe(EMPTY);
      expect(formatMeasurement(undefined)).toBe(EMPTY);
      expect(formatMeasurement("")).toBe(EMPTY);
    });
  });
});
