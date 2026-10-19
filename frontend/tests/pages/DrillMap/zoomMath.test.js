import { describe, expect, it } from "vitest";
import * as drillZoomMath from "../../../src/pages/DrillMap/zoomMath.js";
import * as technoZoomMath from "../../../src/pages/TechnoMap/zoomMath.js";

// zoomMath.js is byte-identical in both map modules. Running the same suite
// against both copies keeps them from silently drifting apart.
const copies = [
  ["DrillMap", drillZoomMath],
  ["TechnoMap", technoZoomMath],
];

const SETTINGS = { minZoom: 1, maxZoom: 90, zoomStep: 0.4, deviationMinZoom: 10 };

describe.each(copies)("%s/zoomMath", (_name, zoomMath) => {
  const {
    crossesThreshold,
    snapToThreshold,
    clampScale,
    resolveScale,
    panAroundAnchor,
    zoomView,
    isViewZoomed,
  } = zoomMath;

  describe("crossesThreshold", () => {
    it("detects an upward crossing", () => {
      expect(crossesThreshold(9.8, 10.2, 10)).toBe(true);
    });

    it("detects a downward crossing", () => {
      expect(crossesThreshold(10.2, 9.8, 10)).toBe(true);
    });

    it("returns false when both scales sit on the same side", () => {
      expect(crossesThreshold(2, 5, 10)).toBe(false);
      expect(crossesThreshold(20, 50, 10)).toBe(false);
    });

    it("returns false when starting exactly on the threshold", () => {
      // Boundary case: already snapped, so the next step must be free to move on.
      expect(crossesThreshold(10, 10.4, 10)).toBe(false);
      expect(crossesThreshold(10, 9.6, 10)).toBe(false);
    });

    it("returns false when landing exactly on the threshold", () => {
      expect(crossesThreshold(9.6, 10, 10)).toBe(false);
    });
  });

  describe("snapToThreshold", () => {
    it("snaps to the threshold when crossed", () => {
      expect(snapToThreshold(9.8, 10.2, 10)).toBe(10);
    });

    it("passes the requested scale through when not crossed", () => {
      expect(snapToThreshold(2, 5, 10)).toBe(5);
    });
  });

  describe("clampScale", () => {
    it("clamps below the minimum", () => {
      expect(clampScale(0.2, SETTINGS)).toBe(1);
    });

    it("clamps above the maximum", () => {
      expect(clampScale(500, SETTINGS)).toBe(90);
    });

    it("leaves in-range values untouched", () => {
      expect(clampScale(42, SETTINGS)).toBe(42);
    });

    it("returns the boundaries themselves unchanged", () => {
      expect(clampScale(1, SETTINGS)).toBe(1);
      expect(clampScale(90, SETTINGS)).toBe(90);
    });
  });

  describe("resolveScale", () => {
    it("snaps to the deviation threshold before clamping", () => {
      expect(resolveScale(9.8, 10.2, SETTINGS)).toBe(10);
    });

    it("clamps a request that overshoots the maximum", () => {
      expect(resolveScale(80, 200, SETTINGS)).toBe(90);
    });

    it("clamps a request that undershoots the minimum", () => {
      expect(resolveScale(2, -5, SETTINGS)).toBe(1);
    });

    it("lets a scale sitting on the threshold move past it", () => {
      expect(resolveScale(10, 10.4, SETTINGS)).toBeCloseTo(10.4);
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
    const baseArgs = {
      view: { scale: 1, translateX: 0, translateY: 0 },
      anchor: { x: 100, y: 100 },
      origin: { x: 0, y: 0 },
      settings: SETTINGS,
    };

    it("returns the identical view object when the scale cannot change", () => {
      // Referential equality matters: the caller skips the re-render on a no-op.
      const view = { scale: 90, translateX: 5, translateY: 5 };
      expect(zoomView({ ...baseArgs, view, requestedScale: 120 })).toBe(view);
    });

    it("returns a new view when the scale changes", () => {
      const result = zoomView({ ...baseArgs, requestedScale: 2 });
      expect(result).not.toBe(baseArgs.view);
      expect(result.scale).toBe(2);
    });

    it("applies threshold snapping through the full pipeline", () => {
      const view = { scale: 9.8, translateX: 0, translateY: 0 };
      expect(zoomView({ ...baseArgs, view, requestedScale: 10.5 }).scale).toBe(10);
    });
  });

  describe("isViewZoomed", () => {
    it("is false for a pristine view at minimum zoom", () => {
      expect(isViewZoomed({ scale: 1, translateX: 0, translateY: 0 }, SETTINGS)).toBe(false);
    });

    it("is true when scaled past the minimum", () => {
      expect(isViewZoomed({ scale: 1.5, translateX: 0, translateY: 0 }, SETTINGS)).toBe(true);
    });

    it("is true when panned at minimum zoom", () => {
      expect(isViewZoomed({ scale: 1, translateX: -30, translateY: 0 }, SETTINGS)).toBe(true);
      expect(isViewZoomed({ scale: 1, translateX: 0, translateY: 12 }, SETTINGS)).toBe(true);
    });
  });
});
