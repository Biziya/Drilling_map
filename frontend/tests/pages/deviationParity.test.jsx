import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  calculateDeviationEndpoint,
  convertUtmToMapPosition,
} from "../../src/pages/DrillMap/utmCoordinates.js";
import {
  calculateTechnoMapDeviationEndpoint,
  convertUtmToTechnoMapPosition,
} from "../../src/pages/TechnoMap/technoMapCoordinates.js";
import DeviationLineVector from "../../src/pages/DrillMap/DeviationLineVector.jsx";
import TechnoMapDeviationLines from "../../src/pages/TechnoMap/TechnoMapDeviationLines.jsx";
import { MAP_SETTINGS } from "../../src/pages/DrillMap/drillMapConfig.js";
import { TECHNO_MAP_SETTINGS } from "../../src/pages/TechnoMap/technoMapConfig.js";
import {
  attachDeviationOffsets,
  projectDrillholes,
} from "../../src/pages/DrillMap/drillholeFeatures.js";

// The brief is "Exploration must behave exactly like Techno", so these assert
// agreement between the two implementations rather than any absolute value.
// If either map's deviation logic is changed alone, this fails.

const HOLES = [
  { holeId: "NE", x: 418000, y: 4894000, azimuth: 45, finalDeviation: 25 },
  { holeId: "SE", x: 418500, y: 4894500, azimuth: 135, finalDeviation: 12.5 },
  { holeId: "SW", x: 419000, y: 4895000, azimuth: 225, finalDeviation: 40 },
  { holeId: "NW", x: 419500, y: 4895500, azimuth: 315, finalDeviation: 1.33 },
  { holeId: "N", x: 420000, y: 4896000, azimuth: 0, finalDeviation: 8 },
  { holeId: "E", x: 420500, y: 4896500, azimuth: 90, finalDeviation: 8 },
  { holeId: "S", x: 421000, y: 4893000, azimuth: 180, finalDeviation: 8 },
  { holeId: "W", x: 421500, y: 4893500, azimuth: 270, finalDeviation: 8 },
  { holeId: "NO-AZ", x: 422000, y: 4894000, finalDeviation: 8 },
  { holeId: "NO-DEV", x: 422500, y: 4894500, azimuth: 90 },
  { holeId: "ZERO-DEV", x: 422900, y: 4895000, azimuth: 90, finalDeviation: 0 },
];

const MAP = { mapWidth: 1200, mapHeight: 850 };

describe("Exploration/Techno deviation parity", () => {
  describe("endpoint calculation", () => {
    it.each(HOLES.map((hole) => [hole.holeId, hole]))(
      "agrees for %s",
      (_id, hole) => {
        expect(calculateDeviationEndpoint(hole))
          .toEqual(calculateTechnoMapDeviationEndpoint(hole));
      },
    );

    it("agrees that a hole without azimuth has no endpoint", () => {
      expect(calculateDeviationEndpoint(HOLES[8])).toBeNull();
      expect(calculateTechnoMapDeviationEndpoint(HOLES[8])).toBeNull();
    });
  });

  describe("projection", () => {
    it.each(HOLES.map((hole) => [hole.holeId, hole]))(
      "places %s at the same map position",
      (_id, hole) => {
        expect(convertUtmToMapPosition(hole)).toEqual(convertUtmToTechnoMapPosition(hole));
      },
    );
  });

  // The offsets are what the SVG actually draws, so this is the assertion that
  // catches a direction or origin mismatch between the two maps.
  describe("pixel offsets", () => {
    // projectDrillholes only projects the ENDPOINT; the holes handed to it are
    // already projected by useMapData, so they are pre-projected here too.
    const offsetsFor = (calculateEndpoint, project) => attachDeviationOffsets(
      projectDrillholes(
        HOLES.map((hole) => project(hole)).filter(Boolean),
        { calculateEndpoint, project },
      ),
      MAP,
    ).map(({ drillhole, deviation }) => [drillhole.holeId, deviation]);

    it("produces identical offsets for every hole", () => {
      expect(offsetsFor(calculateDeviationEndpoint, convertUtmToMapPosition))
        .toEqual(offsetsFor(calculateTechnoMapDeviationEndpoint, convertUtmToTechnoMapPosition));
    });

    it("points a due-north hole up the map and a due-east hole right", () => {
      const offsets = new Map(offsetsFor(calculateDeviationEndpoint, convertUtmToMapPosition));

      // Northing increases up the map, so a north deviation is negative y.
      expect(offsets.get("N").y).toBeLessThan(0);
      expect(Math.abs(offsets.get("N").x)).toBeLessThan(0.001);
      expect(offsets.get("E").x).toBeGreaterThan(0);
      expect(Math.abs(offsets.get("E").y)).toBeLessThan(0.001);
    });
  });

  describe("rendered SVG", () => {
    const shapeOf = (Component, deviation, className) => {
      const { container } = render(<Component deviation={deviation} />);
      const svg = container.firstChild;
      const line = svg.querySelector("line");

      return {
        width: svg.getAttribute("width"),
        height: svg.getAttribute("height"),
        viewBox: svg.getAttribute("viewBox"),
        left: svg.style.left,
        top: svg.style.top,
        // class names legitimately differ between the two maps
        className: svg.getAttribute("class").replace(className, "LINE"),
        coords: ["x1", "y1", "x2", "y2"].map((a) => line.getAttribute(a)),
      };
    };

    it.each([
      ["down-right", { x: 100, y: 50 }],
      ["up-left", { x: -100, y: -50 }],
      ["up-right", { x: 80, y: -30 }],
      ["down-left", { x: -80, y: 30 }],
      ["due north", { x: 0, y: -60 }],
      ["due east", { x: 60, y: 0 }],
    ])("renders %s exactly as Techno Map does", (_name, deviation) => {
      expect(shapeOf(DeviationLineVector, deviation, "deviation-line-vector"))
        .toEqual(shapeOf(TechnoMapDeviationLines, deviation, "techno-deviation-line-vector"));
    });

    it("starts the line on the collar", () => {
      const { container } = render(<DeviationLineVector deviation={{ x: 40, y: -20 }} />);
      const line = container.querySelector("line");

      expect(line.getAttribute("x1")).toBe("0");
      expect(line.getAttribute("y1")).toBe("0");
    });

    it("ends the line on the deviation offset", () => {
      const { container } = render(<DeviationLineVector deviation={{ x: 40, y: -20 }} />);
      const line = container.querySelector("line");

      expect(Number(line.getAttribute("x2"))).toBe(40);
      expect(Number(line.getAttribute("y2"))).toBe(-20);
    });
  });

  describe("visibility threshold", () => {
    it("appears from the same zoom level on both maps", () => {
      expect(MAP_SETTINGS.deviationMinZoom).toBe(TECHNO_MAP_SETTINGS.deviationMinZoom);
    });

    it("no longer carries an Exploration-only threshold", () => {
      expect(MAP_SETTINGS.deviationVisibleFromZoom).toBeUndefined();
    });
  });
});
