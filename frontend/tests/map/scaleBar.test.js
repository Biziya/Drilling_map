import { describe, expect, it } from "vitest";
import { computeScaleBar } from "../../src/map/scaleBar.js";

// The real site bounds, so the assertions reflect production numbers.
const BOUNDS = Object.freeze({
  minX: 412499.97,
  maxX: 423375.13,
  minY: 4890500,
  maxY: 4898190.29,
});

describe("map/scaleBar", () => {
  it("produces a label and a width at default zoom", () => {
    const bar = computeScaleBar({ mapWidth: 1200, zoom: 1, bounds: BOUNDS });

    expect(bar).not.toBeNull();
    expect(bar.label).toBe("500 m");
    expect(bar.width).toBeGreaterThan(0);
  });

  it("shortens the represented distance as zoom increases", () => {
    const far = computeScaleBar({ mapWidth: 1200, zoom: 1, bounds: BOUNDS });
    const near = computeScaleBar({ mapWidth: 1200, zoom: 30, bounds: BOUNDS });

    const metres = (bar) => Number(bar.label.replace(/[^\d.]/g, ""));
    expect(metres(near)).toBeLessThan(metres(far));
  });

  it("keeps the bar near the 100px target width", () => {
    const bar = computeScaleBar({ mapWidth: 1200, zoom: 5, bounds: BOUNDS });

    // Rounding to a 1/2/5 step means it lands in a band, not exactly on 100.
    expect(bar.width).toBeGreaterThan(20);
    expect(bar.width).toBeLessThanOrEqual(100);
  });

  it("switches to kilometres past 1000 m", () => {
    const bar = computeScaleBar({ mapWidth: 20, zoom: 1, bounds: BOUNDS });

    expect(bar.label).toMatch(/km$/);
  });

  it("only ever labels a 1, 2 or 5 step", () => {
    for (let zoom = 1; zoom <= 90; zoom += 1) {
      const bar = computeScaleBar({ mapWidth: 1200, zoom, bounds: BOUNDS });
      if (!bar) continue;

      const value = Number(bar.label.replace(/[^\d.]/g, ""));
      const magnitude = 10 ** Math.floor(Math.log10(value));
      expect([1, 2, 5]).toContain(Math.round(value / magnitude));
    }
  });

  // --- Degenerate inputs --------------------------------------------------
  it("returns null for a zero-width map", () => {
    expect(computeScaleBar({ mapWidth: 0, zoom: 1, bounds: BOUNDS })).toBeNull();
  });

  it("returns null for zero zoom", () => {
    expect(computeScaleBar({ mapWidth: 1200, zoom: 0, bounds: BOUNDS })).toBeNull();
  });

  it("returns null when the bounds have no horizontal extent", () => {
    // Division by zero would otherwise yield Infinity pixels-per-metre.
    const flat = { minX: 5, maxX: 5, minY: 0, maxY: 10 };
    expect(computeScaleBar({ mapWidth: 1200, zoom: 1, bounds: flat })).toBeNull();
  });

  it("returns null when the bounds are inverted", () => {
    const inverted = { minX: 100, maxX: 0, minY: 0, maxY: 10 };
    expect(computeScaleBar({ mapWidth: 1200, zoom: 1, bounds: inverted })).toBeNull();
  });

  it("returns null when the map width is not a number", () => {
    expect(computeScaleBar({ mapWidth: NaN, zoom: 1, bounds: BOUNDS })).toBeNull();
  });
});
