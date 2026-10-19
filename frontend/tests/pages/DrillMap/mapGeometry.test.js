import { afterEach, describe, expect, it, vi } from "vitest";
import * as drillMapGeometry from "../../../src/pages/DrillMap/mapGeometry.js";
import * as technoMapGeometry from "../../../src/pages/TechnoMap/mapGeometry.js";

const copies = [
  ["DrillMap", drillMapGeometry],
  ["TechnoMap", technoMapGeometry],
];

describe.each(copies)("%s/mapGeometry", (_name, mapGeometry) => {
  const {
    computeFitScale,
    computeRenderedMapSize,
    toPixels,
    computeMapOrigin,
    getDevicePixelRatio,
    snapToDevicePixels,
    buildCanvasTransformStyle,
  } = mapGeometry;

  describe("computeFitScale", () => {
    it("picks the limiting axis", () => {
      // Viewport is wide, so height constrains the fit.
      expect(computeFitScale({ width: 100, height: 100 }, { width: 500, height: 200 })).toBe(2);
    });

    it("returns 0 when the image has not reported a size yet", () => {
      expect(computeFitScale({ width: 0, height: 0 }, { width: 500, height: 500 })).toBe(0);
      expect(computeFitScale({ width: 100, height: 0 }, { width: 500, height: 500 })).toBe(0);
    });

    it("returns 0 for a collapsed viewport rather than a negative scale", () => {
      expect(computeFitScale({ width: 100, height: 100 }, { width: 0, height: 0 })).toBe(0);
    });
  });

  describe("computeRenderedMapSize", () => {
    it("scales the image to fit the viewport", () => {
      expect(computeRenderedMapSize({ width: 200, height: 100 }, { width: 400, height: 400 }))
        .toEqual({ width: 400, height: 200 });
    });

    it("falls back to filling the viewport before the image loads", () => {
      expect(computeRenderedMapSize({ width: 0, height: 0 }, { width: 400, height: 400 }))
        .toEqual({ width: "100%", height: "100%" });
    });

    it("never returns a sub-pixel size that would collapse the canvas", () => {
      const size = computeRenderedMapSize({ width: 10000, height: 1 }, { width: 10, height: 10 });
      expect(size.height).toBeGreaterThanOrEqual(1);
    });

    it("returns a frozen shared object for the fallback", () => {
      const a = computeRenderedMapSize({ width: 0, height: 0 }, { width: 1, height: 1 });
      expect(Object.isFrozen(a)).toBe(true);
    });
  });

  describe("toPixels", () => {
    it("passes numbers through", () => {
      expect(toPixels(240)).toBe(240);
      expect(toPixels(0)).toBe(0);
    });

    it("converts the '100%' fallback to 0", () => {
      expect(toPixels("100%")).toBe(0);
      expect(toPixels(undefined)).toBe(0);
    });
  });

  describe("computeMapOrigin", () => {
    it("centres the rendered map inside the viewport", () => {
      expect(computeMapOrigin({ width: 500, height: 400 }, { width: 300, height: 200 }))
        .toEqual({ x: 100, y: 100 });
    });

    it("treats percentage sizes as filling the viewport, giving a zero origin", () => {
      expect(computeMapOrigin({ width: 500, height: 400 }, { width: "100%", height: "100%" }))
        .toEqual({ x: 0, y: 0 });
    });

    it("returns a negative origin when the map overflows the viewport", () => {
      expect(computeMapOrigin({ width: 100, height: 100 }, { width: 300, height: 300 }))
        .toEqual({ x: -100, y: -100 });
    });
  });

  describe("getDevicePixelRatio", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("reads the browser ratio", () => {
      vi.stubGlobal("window", { devicePixelRatio: 3 });
      expect(getDevicePixelRatio()).toBe(3);
    });

    it("defaults to 1 when the browser reports 0 or nothing", () => {
      vi.stubGlobal("window", { devicePixelRatio: 0 });
      expect(getDevicePixelRatio()).toBe(1);
      vi.stubGlobal("window", {});
      expect(getDevicePixelRatio()).toBe(1);
    });
  });

  describe("snapToDevicePixels", () => {
    it("rounds to the device pixel grid", () => {
      expect(snapToDevicePixels({ x: 10.3, y: 10.8 }, 2)).toEqual({ x: 10.5, y: 11 });
    });

    it("is a no-op for whole pixels at ratio 1", () => {
      expect(snapToDevicePixels({ x: 12, y: -8 }, 1)).toEqual({ x: 12, y: -8 });
    });

    it("handles negative translations symmetrically", () => {
      expect(snapToDevicePixels({ x: -10.3, y: -10.7 }, 2)).toEqual({ x: -10.5, y: -10.5 });
    });
  });

  describe("buildCanvasTransformStyle", () => {
    it("emits the transform and the inverse-scale custom property", () => {
      const style = buildCanvasTransformStyle({
        view: { scale: 4, translateX: 10, translateY: 20 },
        renderedMapSize: { width: 300, height: 200 },
        scaleVariable: "--inverse-map-scale",
      });

      expect(style.width).toBe(300);
      expect(style.height).toBe(200);
      expect(style["--inverse-map-scale"]).toBe(0.25);
      expect(style.transform).toBe("translate(10px, 20px) scale(4)");
    });

    it("carries the percentage fallback size through untouched", () => {
      const style = buildCanvasTransformStyle({
        view: { scale: 1, translateX: 0, translateY: 0 },
        renderedMapSize: { width: "100%", height: "100%" },
        scaleVariable: "--inverse-map-scale",
      });

      expect(style.width).toBe("100%");
    });
  });
});
