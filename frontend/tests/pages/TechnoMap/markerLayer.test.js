import { describe, expect, it } from "vitest";
import { MAP_CONFIG } from "../../../src/pages/TechnoMap/config/technoMapConfig.js";
import { convertUtmToMapPosition } from "../../../src/pages/TechnoMap/utils/coordinates.js";
import { mapRatioToViewport } from "../../../src/pages/TechnoMap/utils/geometry.js";
import { ALL_VISIBLE, selectShownFeatures, setAllFilters } from "../../../src/pages/TechnoMap/utils/mapFilters.js";
import {
  buildMarkerFeatures,
  createHitIndex,
  createSpriteSet,
  drawMarkerLayer,
  findMarkerAt,
  markerHalfSize,
  screenTransform,
} from "../../../src/pages/TechnoMap/utils/markerLayer.js";
import { asBackendRecord } from "./backendRecord.js";
import { buildPerfDataset } from "./perfDataset.js";

const project = (records) => records.map((record) => convertUtmToMapPosition(asBackendRecord(record)));
const FIT = { x: 0, y: 0, width: 1000, height: 700 };
const screenOf = ({ x, y }, t = FIT) => ({ x: t.x + x * t.width, y: t.y + y * t.height });

describe("buildMarkerFeatures", () => {
  it("works out type, kind and position once, and leaves out holes with no category", () => {
    const features = buildMarkerFeatures(project([
      { holeId: "P", x: 418000, y: 4894000, holePurpose: "PRODUCT" },
      { holeId: "R", x: 418100, y: 4894000, holePurpose: "INJECT", holeStatus: "INPROGRESS" },
      { holeId: "U", x: 418200, y: 4894000, holePurpose: "SER" },
    ]));

    expect(features.map(({ type, kind, isInProgress }) => [type, kind, isInProgress])).toEqual([
      ["producer", "producer", false],
      ["injector", "rig", true],
    ]);
    expect(features[0].x).toBeCloseTo(features[0].drillhole.xPercent / 100);
  });

  it("keeps the exaggerated deviation endpoint as a map ratio", () => {
    const [feature] = buildMarkerFeatures(project([{ holeId: "D", x: 418000, y: 4894000, holePurpose: "PRODUCT", azimuth: 90, finalDeviation: 10 }]));
    const end = convertUtmToMapPosition({ x: 418000 + 10 * MAP_CONFIG.deviationExaggeration, y: 4894000 });

    expect(feature.end.x).toBeCloseTo(end.xPercent / 100);
    expect(feature.end.y).toBeCloseTo(end.yPercent / 100);
  });
});

describe("screenTransform", () => {
  it("places a point exactly where mapRatioToViewport does", () => {
    const view = { scale: 7.3, translateX: -1234.5, translateY: 456.25 };
    const origin = { x: 12, y: 0 };
    const mapSize = { width: 990, height: 700 };
    const t = screenTransform(view, origin, mapSize);

    for (const ratio of [{ x: 0, y: 0 }, { x: 0.37, y: 0.81 }, { x: 1, y: 1 }]) {
      const expected = mapRatioToViewport(ratio, view, origin, mapSize);
      expect(screenOf(ratio, t).x).toBeCloseTo(expected.x, 9);
      expect(screenOf(ratio, t).y).toBeCloseTo(expected.y, 9);
    }
  });
});

describe("findMarkerAt", () => {
  const features = buildMarkerFeatures(project([
    { holeId: "A", x: 418000, y: 4894000, holePurpose: "PRODUCT" },
    { holeId: "B", x: 418150, y: 4894000, holePurpose: "INJECT" },
  ]));
  const index = createHitIndex(features);
  const [a, b] = features.map((feature) => screenOf(feature));

  it("finds the marker under the pointer", () => {
    expect(findMarkerAt(index, a, FIT)?.drillhole.holeId).toBe("A");
    expect(findMarkerAt(index, { x: a.x + markerHalfSize("producer"), y: a.y }, FIT)?.drillhole.holeId).toBe("A");
  });

  it("picks the nearer of two overlapping markers", () => {
    expect(findMarkerAt(index, { x: b.x - 1, y: b.y }, FIT)?.drillhole.holeId).toBe("B");
  });

  it("finds nothing beside a marker", () => {
    expect(findMarkerAt(index, { x: a.x, y: a.y + 30 }, FIT)).toBeNull();
    expect(findMarkerAt(index, { x: -500, y: -500 }, FIT)).toBeNull();
  });

  it("prefers a rig drawn on top of a marker at the same spot", () => {
    const stacked = buildMarkerFeatures(project([
      { holeId: "M", x: 418000, y: 4894000, holePurpose: "PRODUCT" },
      { holeId: "R", x: 418000, y: 4894000, holePurpose: "INJECT", holeStatus: "INPROGRESS" },
    ]));

    expect(findMarkerAt(createHitIndex(stacked), screenOf(stacked[0]), FIT)?.drillhole.holeId).toBe("R");
  });

  it("reaches the whole of a rig's larger icon", () => {
    const [rig] = buildMarkerFeatures(project([{ holeId: "R", x: 418000, y: 4894000, holePurpose: "INJECT", holeStatus: "INPROGRESS" }]));
    const at = screenOf(rig);

    expect(findMarkerAt(createHitIndex([rig]), { x: at.x + 15, y: at.y - 15 }, FIT)).toBe(rig);
  });

  it("only finds what the index holds, i.e. what the filters show", () => {
    expect(findMarkerAt(createHitIndex(selectShownFeatures(features, setAllFilters(false))), a, FIT)).toBeNull();
  });

  it("follows the view: the same marker under the pointer after zooming", () => {
    const zoomed = { x: -9000, y: -6000, width: 20000, height: 14000 };

    expect(findMarkerAt(index, screenOf(features[0], zoomed), zoomed)?.drillhole.holeId).toBe("A");
  });
});

// Regression guard for the 5,000-hole target, on the stub context: generous
// limits, far above what a desktop takes, that only a return to per-frame or
// per-pointer O(n^2) work would break.
describe("5,000 drillholes", () => {
  const records = buildPerfDataset(5000).map((record) => convertUtmToMapPosition(record));
  const time = (work) => {
    const start = performance.now();
    const result = work();

    return { result, ms: performance.now() - start };
  };

  it("prepares, filters and indexes the dataset quickly", () => {
    const { result: features, ms: build } = time(() => buildMarkerFeatures(records));
    const { result: shown, ms: filter } = time(() => selectShownFeatures(features, { ...ALL_VISIBLE, producer: false }));
    const { ms: index } = time(() => createHitIndex(shown));

    expect(features.length).toBeGreaterThan(4800);
    expect(shown.length).toBeLessThan(features.length);
    expect(build).toBeLessThan(500);
    expect(filter + index).toBeLessThan(100);
  });

  it("draws a frame and answers a thousand pointer moves quickly", () => {
    const features = buildMarkerFeatures(records);
    const canvas = document.createElement("canvas");
    const sprites = createSpriteSet(1, canvas);
    const index = createHitIndex(features);
    const { result: drawn, ms: draw } = time(() => drawMarkerLayer(canvas.getContext("2d"), {
      features, transform: FIT, viewport: { width: 1000, height: 700 }, deviationVisible: true, sprites,
    }));
    const { ms: hover } = time(() => {
      for (let i = 0; i < 1000; i += 1) findMarkerAt(index, { x: (i * 37) % 1000, y: (i * 53) % 700 }, FIT);
    });

    expect(drawn.markers).toBe(features.length);
    expect(drawn.lines).toBeGreaterThan(1000);
    expect(draw).toBeLessThan(150);
    expect(hover).toBeLessThan(150);
  });
});
