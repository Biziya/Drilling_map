// The Techno Map's canvas layer: which markers and lines a frame draws, in
// what order and where. The 2D context is the recording stub from
// tests/setup/canvas.js; each sprite canvas carries its kind in data-sprite.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import DrillholeLayer from "../../../src/pages/TechnoMap/Map/DrillholeLayer.jsx";
import { MAP_CONFIG } from "../../../src/pages/TechnoMap/config/technoMapConfig.js";
import { convertUtmToMapPosition } from "../../../src/pages/TechnoMap/utils/coordinates.js";
import { ALL_VISIBLE, selectShownFeatures } from "../../../src/pages/TechnoMap/utils/mapFilters.js";
import { buildMarkerFeatures } from "../../../src/pages/TechnoMap/utils/markerLayer.js";
import { markerSizeFor } from "../../../src/pages/TechnoMap/utils/markerShapes.js";
import { asBackendRecord } from "./backendRecord.js";

afterEach(cleanup);

const VIEWPORT = { width: 1000, height: 700 };
const FIT = { x: 0, y: 0, width: 1000, height: 700 };

const featuresOf = (records) => selectShownFeatures(
  buildMarkerFeatures(records.map((record) => convertUtmToMapPosition(asBackendRecord(record)))),
  ALL_VISIBLE,
);

function renderLayer(records, { transform = FIT, deviationVisible = true, rigLoaded = true } = {}) {
  const result = render(
    <DrillholeLayer features={featuresOf(records)} transform={transform} viewport={VIEWPORT} deviationVisible={deviationVisible} />,
  );
  if (rigLoaded) fireEvent.load(result.container.querySelector(".rig-sprite-source"));
  const canvas = result.container.querySelector("canvas.drillhole-layer");

  return {
    ...result,
    canvas,
    calls: () => canvas.__calls,
    stamps: () => canvas.__calls.filter(([name]) => name === "drawImage").map(([, image, x, y, w, h]) => ({ kind: image.dataset.sprite, x, y, w, h })),
  };
}

const P = { holeId: "P-1", x: 418000, y: 4894000, holePurpose: "PRODUCT" };

describe("TechnoMap DrillholeLayer", () => {
  it("draws one viewport-sized canvas that never takes the pointer", () => {
    const { canvas } = renderLayer([P]);

    expect(canvas.width).toBe(1000);
    expect(canvas.height).toBe(700);
    expect(canvas.getAttribute("aria-hidden")).toBe("true");
  });

  it("stamps each hole with its category's sprite, centred on the collar", () => {
    const { stamps, canvas } = renderLayer([P, { holeId: "I-1", x: 419000, y: 4895000, holePurpose: "INJECT" }]);
    const [producer] = featuresOf([P]);
    const size = markerSizeFor("square") + 6;

    expect(stamps().map(({ kind }) => kind)).toEqual(["producer", "injector"]);
    expect(stamps()[0].x + size / 2).toBeCloseTo(producer.x * 1000, 0);
    expect(stamps()[0].y + size / 2).toBeCloseTo(producer.y * 700, 0);
    expect(canvas.dataset.drawn).toBe("2");
  });

  it("draws a hole with both sampling flags once, as Ra-grade-sampling", () => {
    const { stamps } = renderLayer([{ ...P, holePurpose: "EXPLO", raGradeSampling: true, sedimentSampling: true }]);

    expect(stamps().map(({ kind }) => kind)).toEqual(["ra-grade-sampling"]);
  });

  it("draws nothing for an unmapped Type", () => {
    const { stamps, canvas } = renderLayer([{ ...P, holePurpose: "CONTROLE" }]);

    expect(stamps()).toEqual([]);
    expect(canvas.dataset.drawn).toBe("0");
  });

  it("draws one rig, and no shape, for a hole recorded twice", () => {
    const { stamps } = renderLayer([P, { ...P, holeStatus: "INPROGRESS" }]);

    expect(stamps().map(({ kind }) => kind)).toEqual(["rig"]);
    expect(stamps()[0].w).toBe(MAP_CONFIG.markers.rigSize + 6);
  });

  it("draws rigs after, so above, every other marker", () => {
    const { stamps } = renderLayer([{ ...P, holeId: "R", holeStatus: "INPROGRESS" }, { ...P, holeId: "Q", x: 418100 }]);

    expect(stamps().map(({ kind }) => kind)).toEqual(["producer", "rig"]);
  });

  it("waits for the rig icon before drawing rigs", () => {
    const { stamps, container } = renderLayer([{ ...P, holeStatus: "INPROGRESS" }], { rigLoaded: false });

    expect(stamps()).toEqual([]);
    fireEvent.load(container.querySelector(".rig-sprite-source"));
    expect(stamps().map(({ kind }) => kind)).toEqual(["rig"]);
  });

  describe("deviation lines", () => {
    const DEVIATED = { ...P, azimuth: 90, finalDeviation: 40 };

    it("runs from the collar to the API endpoint, exaggerated for display", () => {
      const { calls, canvas } = renderLayer([DEVIATED]);
      const [feature] = featuresOf([DEVIATED]);
      const move = calls().find(([name]) => name === "moveTo");
      const line = calls().find(([name]) => name === "lineTo");

      expect(move.slice(1)).toEqual([feature.x * 1000, feature.y * 700]);
      expect(line[1]).toBeCloseTo(feature.end.x * 1000);
      expect(line[2]).toBeCloseTo(feature.end.y * 700);
      // Due east: the line runs in +x only.
      expect(line[1]).toBeGreaterThan(move[1]);
      expect(line[2]).toBeCloseTo(move[2]);
      expect(canvas.dataset.lines).toBe("1");
    });

    it("draws none when the layer is off, or for a hole without an endpoint", () => {
      expect(renderLayer([DEVIATED], { deviationVisible: false }).canvas.dataset.lines).toBe("0");
      cleanup();
      expect(renderLayer([P]).canvas.dataset.lines).toBe("0");
    });

    it("draws every line in one stroke, under the markers", () => {
      const { calls } = renderLayer([DEVIATED, { ...DEVIATED, holeId: "P-2", x: 419000 }]);
      const names = calls().map(([name]) => name);

      expect(names.filter((name) => name === "stroke")).toHaveLength(1);
      expect(names.indexOf("stroke")).toBeLessThan(names.indexOf("drawImage"));
    });
  });

  describe("viewport culling", () => {
    it("skips markers well outside the viewport, and keeps them for the next frame", () => {
      const records = [P, { ...P, holeId: "FAR", x: 423000, y: 4890600 }];
      // Zoomed onto P's corner of the map: FAR is far off to the right.
      const [feature] = featuresOf([P]);
      const zoomed = { x: 500 - feature.x * 10000, y: 350 - feature.y * 7000, width: 10000, height: 7000 };
      const first = renderLayer(records, { transform: zoomed });

      expect(first.canvas.dataset.drawn).toBe("1");
      cleanup();
      expect(renderLayer(records).canvas.dataset.drawn).toBe("2");
    });

    it("still draws a marker just past the edge, so none pops in", () => {
      const [feature] = featuresOf([P]);
      // P sits 20 px left of the viewport.
      const shifted = { x: -20 - feature.x * 1000, y: 0, width: 1000, height: 700 };

      expect(renderLayer([P], { transform: shifted }).canvas.dataset.drawn).toBe("1");
    });

    it("draws nothing before the base map has been measured", () => {
      expect(renderLayer([P], { transform: null }).canvas.dataset.drawn).toBe("0");
    });
  });
});
