// Both pages currently share this behaviour; split this file when one page diverges.
import { afterEach, describe, expect, it, vi } from "vitest";
import * as drillGeometry from "../../src/pages/DrillMap/utils/geometry.js";
import * as technoGeometry from "../../src/pages/TechnoMap/utils/geometry.js";

const SETTINGS = { minZoom: 1, maxZoom: 90, zoomStep: 0.4, deviationMinZoom: 10 };

const PAGES = [
  ["DrillMap", drillGeometry],
  ["TechnoMap", technoGeometry],
];

describe.each(PAGES)("%s map geometry", (_page, {
  buildCanvasTransformStyle,
  computeMapOrigin,
  computeRenderedMapSize,
  isViewZoomed,
  panAroundAnchor,
  resolveScale,
  snapToDevicePixels,
  toPixels,
  zoomView,
}) => {
  describe("computeRenderedMapSize", () => {
    it("scales the image to fit the viewport", () => {
      expect(computeRenderedMapSize({ width: 200, height: 100 }, { width: 400, height: 400 }))
        .toEqual({ width: 400, height: 200 });
    });

    it("picks the limiting axis for the fit", () => {
      // Viewport is wide, so height constrains the fit (scale 2).
      expect(computeRenderedMapSize({ width: 100, height: 100 }, { width: 500, height: 200 }))
        .toEqual({ width: 200, height: 200 });
    });

    it("falls back to filling the viewport before the image loads", () => {
      expect(computeRenderedMapSize({ width: 0, height: 0 }, { width: 400, height: 400 }))
        .toEqual({ width: "100%", height: "100%" });
      expect(computeRenderedMapSize({ width: 100, height: 0 }, { width: 500, height: 500 }))
        .toEqual({ width: "100%", height: "100%" });
    });

    it("falls back to filling the viewport for a collapsed viewport rather than a negative size", () => {
      expect(computeRenderedMapSize({ width: 100, height: 100 }, { width: 0, height: 0 }))
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

  describe("snapToDevicePixels", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("rounds to the device pixel grid", () => {
      expect(snapToDevicePixels({ x: 10.3, y: 10.8 }, 2)).toEqual({ x: 10.5, y: 11 });
    });

    it("is a no-op for whole pixels at ratio 1", () => {
      expect(snapToDevicePixels({ x: 12, y: -8 }, 1)).toEqual({ x: 12, y: -8 });
    });

    it("handles negative translations symmetrically", () => {
      expect(snapToDevicePixels({ x: -10.3, y: -10.7 }, 2)).toEqual({ x: -10.5, y: -10.5 });
    });

    it("reads the browser ratio by default", () => {
      vi.stubGlobal("devicePixelRatio", 2);
      expect(snapToDevicePixels({ x: 10.3, y: 10.8 })).toEqual({ x: 10.5, y: 11 });
    });

    it("defaults to a ratio of 1 when the browser reports 0 or nothing", () => {
      vi.stubGlobal("devicePixelRatio", 0);
      expect(snapToDevicePixels({ x: 10.3, y: 10.8 })).toEqual({ x: 10, y: 11 });
      vi.stubGlobal("devicePixelRatio", undefined);
      expect(snapToDevicePixels({ x: 10.3, y: 10.8 })).toEqual({ x: 10, y: 11 });
    });
  });

  describe("buildCanvasTransformStyle", () => {
    it("emits the transform and the inverse-scale custom property", () => {
      const style = buildCanvasTransformStyle(
        { scale: 4, translateX: 10, translateY: 20 },
        { width: 300, height: 200 },
      );

      expect(style.width).toBe(300);
      expect(style.height).toBe(200);
      expect(style["--inverse-map-scale"]).toBe(0.25);
      expect(style.transform).toBe("translate(10px, 20px) scale(4)");
    });

    it("carries the percentage fallback size through untouched", () => {
      const style = buildCanvasTransformStyle(
        { scale: 1, translateX: 0, translateY: 0 },
        { width: "100%", height: "100%" },
      );

      expect(style.width).toBe("100%");
    });
  });

  // crossesThreshold / snapToThreshold / clampScale were folded into
  // resolveScale; their behaviour is pinned through it.
  describe("resolveScale", () => {
    describe("deviation threshold snapping", () => {
      it("snaps an upward crossing to the threshold", () => {
        expect(resolveScale(9.8, 10.2, SETTINGS)).toBe(10);
      });

      it("snaps a downward crossing to the threshold", () => {
        expect(resolveScale(10.2, 9.8, SETTINGS)).toBe(10);
      });

      it("passes the requested scale through when both sit on the same side", () => {
        expect(resolveScale(2, 5, SETTINGS)).toBe(5);
        expect(resolveScale(20, 50, SETTINGS)).toBe(50);
      });

      it("lets a scale sitting on the threshold move past it", () => {
        // Boundary case: already snapped, so the next step must be free to move on.
        expect(resolveScale(10, 10.4, SETTINGS)).toBeCloseTo(10.4);
        expect(resolveScale(10, 9.6, SETTINGS)).toBeCloseTo(9.6);
      });

      it("lands exactly on the threshold when requested", () => {
        expect(resolveScale(9.6, 10, SETTINGS)).toBe(10);
      });
    });

    describe("clamping", () => {
      it("clamps below the minimum", () => {
        expect(resolveScale(1, 0.2, SETTINGS)).toBe(1);
        expect(resolveScale(2, -5, SETTINGS)).toBe(1);
      });

      it("clamps above the maximum", () => {
        expect(resolveScale(80, 500, SETTINGS)).toBe(90);
        expect(resolveScale(80, 200, SETTINGS)).toBe(90);
      });

      it("leaves in-range values untouched", () => {
        expect(resolveScale(40, 42, SETTINGS)).toBe(42);
      });

      it("returns the boundaries themselves unchanged", () => {
        expect(resolveScale(2, 1, SETTINGS)).toBe(1);
        expect(resolveScale(80, 90, SETTINGS)).toBe(90);
      });
    });
  });

  describe("panAroundAnchor", () => {
    it("keeps the anchor point visually fixed while scaling", () => {
      const view = { scale: 2, translateX: 40, translateY: 20 };
      const anchor = { x: 300, y: 200 };
      const origin = { x: 50, y: 30 };

      const next = panAroundAnchor(view, 4, anchor, origin);

      // The map coordinate under the anchor must be the same before and after.
      const before = (anchor.x - origin.x - view.translateX) / view.scale;
      const after = (anchor.x - origin.x - next.translateX) / next.scale;
      expect(after).toBeCloseTo(before);
      expect(next.scale).toBe(4);
    });

    it("is a no-op on translation when the scale does not change", () => {
      const view = { scale: 3, translateX: 12, translateY: -7 };
      const next = panAroundAnchor(view, 3, { x: 100, y: 100 }, { x: 0, y: 0 });

      expect(next.translateX).toBeCloseTo(12);
      expect(next.translateY).toBeCloseTo(-7);
    });
  });

  describe("zoomView", () => {
    const view = { scale: 1, translateX: 0, translateY: 0 };
    const anchor = { x: 100, y: 100 };
    const origin = { x: 0, y: 0 };

    it("returns the identical view object when the scale cannot change", () => {
      // Referential equality matters: the caller skips the re-render on a no-op.
      const maxed = { scale: 90, translateX: 5, translateY: 5 };
      expect(zoomView(maxed, 120, anchor, origin, SETTINGS)).toBe(maxed);
    });

    it("returns a new view when the scale changes", () => {
      const result = zoomView(view, 2, anchor, origin, SETTINGS);
      expect(result).not.toBe(view);
      expect(result.scale).toBe(2);
    });

    it("applies threshold snapping through the full pipeline", () => {
      const near = { scale: 9.8, translateX: 0, translateY: 0 };
      expect(zoomView(near, 10.5, anchor, origin, SETTINGS).scale).toBe(10);
    });
  });

  describe("isViewZoomed", () => {
    it("is false for a pristine view at minimum zoom", () => {
      expect(isViewZoomed({ scale: 1, translateX: 0, translateY: 0 }, SETTINGS.minZoom)).toBe(false);
    });

    it("is true when scaled past the minimum", () => {
      expect(isViewZoomed({ scale: 1.5, translateX: 0, translateY: 0 }, SETTINGS.minZoom)).toBe(true);
    });

    it("is true when panned at minimum zoom", () => {
      expect(isViewZoomed({ scale: 1, translateX: -30, translateY: 0 }, SETTINGS.minZoom)).toBe(true);
      expect(isViewZoomed({ scale: 1, translateX: 0, translateY: 12 }, SETTINGS.minZoom)).toBe(true);
    });
  });
});
