import { describe, expect, it } from "vitest";
import {
  addMeasurementPoint,
  formatDistance,
  measureDistance,
} from "../../../src/pages/TechnoMap/utils/measurement.js";
import {
  computeMapOrigin,
  fitView,
  mapRatioToViewport,
  viewportToMapRatio,
} from "../../../src/pages/TechnoMap/utils/geometry.js";
import { mapRatioToUtm, utmToMapRatio } from "../../../src/pages/TechnoMap/utils/coordinates.js";

describe("measureDistance", () => {
  it("measures in UTM metres", () => {
    expect(measureDistance({ x: 418000, y: 4894000 }, { x: 418300, y: 4894400 })).toBe(500);
  });
});

describe("formatDistance", () => {
  it("uses metres below 1 km", () => {
    expect(formatDistance(8.44)).toBe("8.4 m");
    expect(formatDistance(412.4)).toBe("412 m");
    expect(formatDistance(999.4)).toBe("999 m");
  });

  it("uses kilometres from 1 km", () => {
    expect(formatDistance(1000)).toBe("1.00 km");
    expect(formatDistance(3294.8)).toBe("3.29 km");
  });
});

describe("addMeasurementPoint", () => {
  const a = { x: 1, y: 1 };
  const b = { x: 2, y: 2 };
  const c = { x: 3, y: 3 };

  it("cycles: A, then A-B, then a new A", () => {
    const first = addMeasurementPoint([], a);
    const second = addMeasurementPoint(first, b);
    const third = addMeasurementPoint(second, c);
    const fourth = addMeasurementPoint(third, a);

    expect(first).toEqual([a]);
    expect(second).toEqual([a, b]);
    expect(third).toEqual([c]);
    expect(fourth).toEqual([c, a]);
  });
});

describe("viewport and map conversions", () => {
  const mapSize = { width: 990, height: 700 };
  const origin = computeMapOrigin({ width: 1000, height: 700 }, mapSize);
  const views = [
    { scale: 1, translateX: 0, translateY: 0 },
    { scale: 12, translateX: -3400, translateY: 1250 },
    { scale: 2.6, translateX: 37.5, translateY: -80 },
  ];

  it.each(views)("round-trips a point at scale $scale", (view) => {
    const ratio = { x: 0.37, y: 0.61 };
    const back = viewportToMapRatio(mapRatioToViewport(ratio, view, origin, mapSize), view, origin, mapSize);

    expect(back.x).toBeCloseTo(ratio.x, 10);
    expect(back.y).toBeCloseTo(ratio.y, 10);
  });

  // The measurement is stored in map units, so zoom and pan cannot change it.
  it("gives the same distance for the same map points under any view", () => {
    const a = { x: 418000, y: 4894000 };
    const b = { x: 419000, y: 4894500 };
    const distances = views.map((view) => {
      const [pa, pb] = [a, b].map((p) => mapRatioToUtm(viewportToMapRatio(
        mapRatioToViewport(utmToMapRatio(p), view, origin, mapSize), view, origin, mapSize,
      )));

      return measureDistance(pa, pb);
    });

    distances.forEach((distance) => expect(distance).toBeCloseTo(measureDistance(a, b), 6));
  });
});

describe("fitView", () => {
  const viewport = { width: 1000, height: 700 };
  const mapSize = { width: 990, height: 700 };
  const settings = { minZoom: 1, maxZoom: 90 };

  it("centres the box and keeps all of it inside the padded viewport", () => {
    const box = { minX: 0.4, maxX: 0.6, minY: 0.3, maxY: 0.5 };
    const view = fitView(box, viewport, mapSize, settings, 48);
    const origin = computeMapOrigin(viewport, mapSize);
    const topLeft = mapRatioToViewport({ x: box.minX, y: box.minY }, view, origin, mapSize);
    const bottomRight = mapRatioToViewport({ x: box.maxX, y: box.maxY }, view, origin, mapSize);

    expect((topLeft.x + bottomRight.x) / 2).toBeCloseTo(500, 6);
    expect((topLeft.y + bottomRight.y) / 2).toBeCloseTo(350, 6);
    expect(topLeft.x).toBeGreaterThanOrEqual(48 - 1e-6);
    expect(topLeft.y).toBeGreaterThanOrEqual(48 - 1e-6);
    expect(bottomRight.x).toBeLessThanOrEqual(952 + 1e-6);
    expect(bottomRight.y).toBeLessThanOrEqual(652 + 1e-6);
  });

  it("stays within the zoom limits", () => {
    expect(fitView({ minX: 0.5, maxX: 0.5, minY: 0.5, maxY: 0.5 }, viewport, mapSize, settings, 48).scale).toBe(90);
    expect(fitView({ minX: -1, maxX: 2, minY: -1, maxY: 2 }, viewport, mapSize, settings, 48).scale).toBe(1);
  });
});
