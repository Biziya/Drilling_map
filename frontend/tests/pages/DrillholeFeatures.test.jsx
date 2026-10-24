// Exploration Map DOM markers and deviation lines. The Techno Map draws its
// markers on a canvas instead: see TechnoMap/DrillholeLayer.test.jsx. Kinds and
// role labels live in DrillMap/DrillholeFeatures.test.jsx.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import DrillDrillholeFeatures from "../../src/pages/DrillMap/Map/DrillholeFeatures.jsx";
import * as drillCoordinates from "../../src/pages/DrillMap/utils/coordinates.js";

afterEach(cleanup);

const MAP = { mapWidth: 1200, mapHeight: 850 };

const PAGES = [
  ["DrillMap", DrillDrillholeFeatures, drillCoordinates, (record) => record],
];

const lineOf = (container) => {
  const line = container.querySelector(".deviation-line-vector line");

  return ["x1", "y1", "x2", "y2"].map((a) => Number(line.getAttribute(a)));
};

describe.each(PAGES)("%s DrillholeFeatures", (_page, DrillholeFeatures, {
  attachDeviationOffsets,
  convertUtmToMapPosition,
  projectDrillholes,
}, toApi) => {
  // The features component takes already-projected drillholes, so the records
  // go through the same projection the page uses.
  const project = (records) => records.map((record) => convertUtmToMapPosition(toApi(record)));

  const renderFeatures = (records, { deviationVisible = true } = {}) => render(
    <DrillholeFeatures
      drillholes={project(records)}
      deviationVisible={deviationVisible}
      mapWidth={MAP.mapWidth}
      mapHeight={MAP.mapHeight}
    />,
  );

  describe("deviation lines", () => {
    // This is the bug: the API sends these fields PascalCase, and the old
    // reader only looked for camelCase, so every endpoint came back null and
    // no line was ever drawn.
    it("draws a line for PascalCase deviation fields", () => {
      const { container } = renderFeatures([
        { holeId: "A", x: 418000, y: 4894000, Azimuth: 45, FinalDeviation: 25 },
      ]);

      expect(container.querySelectorAll(".deviation-line-vector").length).toBe(1);
    });

    it("still draws a line for camelCase deviation fields", () => {
      const { container } = renderFeatures([
        { holeId: "A", x: 418000, y: 4894000, azimuth: 45, finalDeviation: 25 },
      ]);

      expect(container.querySelectorAll(".deviation-line-vector").length).toBe(1);
    });

    it("draws a PascalCase line identical to its camelCase twin", () => {
      const pascal = lineOf(renderFeatures([
        { holeId: "A", x: 418000, y: 4894000, Azimuth: 45, FinalDeviation: 25 },
      ]).container);
      cleanup();
      const camel = lineOf(renderFeatures([
        { holeId: "A", x: 418000, y: 4894000, azimuth: 45, finalDeviation: 25 },
      ]).container);

      expect(pascal).toEqual(camel);
    });

    it("draws no line for a hole with no deviation", () => {
      const { container } = renderFeatures([
        { holeId: "A", x: 418000, y: 4894000 },
        { holeId: "B", x: 418500, y: 4894500, Azimuth: 45, FinalDeviation: 0 },
      ]);

      expect(container.querySelectorAll(".deviation-line-vector").length).toBe(0);
    });

    it("gives the line a non-zero length on the map", () => {
      const { container } = renderFeatures([
        { holeId: "A", x: 418000, y: 4894000, Azimuth: 90, FinalDeviation: 40 },
      ]);
      const [x1, y1, x2, y2] = lineOf(container);

      // Azimuth 90 is due east, so the line runs in +x with no northing change.
      expect(x2 - x1).toBeGreaterThan(0);
      expect(Math.abs(y2 - y1)).toBeLessThan(0.001);
    });

    it("keeps the line hidden when deviation display is off", () => {
      const { container } = renderFeatures([
        { holeId: "A", x: 418000, y: 4894000, Azimuth: 45, FinalDeviation: 25 },
      ], { deviationVisible: false });

      expect(container.querySelectorAll(".deviation-line-vector").length).toBe(0);
    });

    it("still renders the marker alongside the line", () => {
      const { container } = renderFeatures([
        { holeId: "A", x: 418000, y: 4894000, Azimuth: 45, FinalDeviation: 25 },
      ]);

      expect(container.querySelectorAll(".drillhole-marker").length).toBe(1);
    });

    describe("rendered SVG", () => {
      it.each([
        ["down-right (SE)", 135],
        ["up-left (NW)", 315],
        ["up-right (NE)", 45],
        ["down-left (SW)", 225],
        ["due north", 0],
        ["due east", 90],
      ])("draws %s from the collar to the computed offset", (_name, azimuth) => {
        const hole = { holeId: "A", x: 418000, y: 4894000, azimuth, finalDeviation: 20 };
        const { container } = renderFeatures([hole]);
        const svg = container.querySelector(".deviation-line-vector");
        const [expected] = attachDeviationOffsets(projectDrillholes(project([hole])), MAP);
        const [x1, y1, x2, y2] = lineOf(container);

        // A 1x1 viewport with overflow: visible, so the line starts at the collar.
        expect(svg.getAttribute("width")).toBe("1");
        expect(svg.getAttribute("height")).toBe("1");
        expect(svg.getAttribute("aria-hidden")).toBe("true");
        expect([x1, y1]).toEqual([0, 0]);
        expect(x2).toBeCloseTo(expected.deviation.x);
        expect(y2).toBeCloseTo(expected.deviation.y);
      });

      it("positions the feature at the collar's map percentage", () => {
        const hole = { holeId: "A", x: 418000, y: 4894000 };
        const [projected] = project([hole]);
        const { container } = renderFeatures([hole]);
        const feature = container.querySelector(".drillhole-feature");

        expect(feature.style.left).toBe(`${projected.xPercent}%`);
        expect(feature.style.top).toBe(`${projected.yPercent}%`);
      });
    });
  });

  describe("markers", () => {
    // One hole can never show both a rig and a shape.
    it("collapses duplicate records into one marker, preferring the rig", () => {
      const { container } = renderFeatures([
        { holeId: "A", x: 418000, y: 4894000, holePurpose: "PRODUCT" },
        { holeId: "A", x: 418000, y: 4894000, holePurpose: "PRODUCT", holeStatus: "INPROGRESS" },
      ]);

      expect(container.querySelectorAll(".drillhole-feature")).toHaveLength(1);
      expect(container.querySelectorAll(".drillhole-marker--rig")).toHaveLength(1);
      expect(container.querySelector(".marker-symbol")).toBeNull();
    });

    it("draws a producer triangle for PRODUCT", () => {
      const { container } = renderFeatures([{ holeId: "P", x: 418000, y: 4894000, holePurpose: "PRODUCT" }]);

      expect(container.querySelector(".drillhole-marker--producer .marker-symbol--triangle")).toBeTruthy();
    });

    it("draws an injector square for INJECT", () => {
      const { container } = renderFeatures([{ holeId: "I", x: 418000, y: 4894000, holePurpose: "INJECT" }]);

      expect(container.querySelector(".drillhole-marker--injector .marker-symbol--square")).toBeTruthy();
    });

    it("uses no techno- prefixed classes", () => {
      const { container } = renderFeatures([
        { holeId: "A", x: 418000, y: 4894000, azimuth: 45, finalDeviation: 25 },
      ]);

      expect(container.innerHTML).not.toContain("techno-");
    });
  });
});
