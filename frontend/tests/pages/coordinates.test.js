// Both pages currently share this behaviour; split this file when one page diverges.
import { describe, expect, it } from "vitest";
import * as drillCoordinates from "../../src/pages/DrillMap/utils/coordinates.js";
import * as technoCoordinates from "../../src/pages/TechnoMap/utils/coordinates.js";
import * as drillConfig from "../../src/pages/DrillMap/config/drillMapConfig.js";
import * as technoConfig from "../../src/pages/TechnoMap/config/technoMapConfig.js";
import { asBackendRecord } from "./TechnoMap/backendRecord.js";

// The Techno Map API sends the deviation endpoint itself (deviationEndX/Y,
// from azimuth and final deviation), so its holes go through what the
// backend adds before reaching the page. The expectations stay identical:
// both pages must draw the same line for the same survey.
const PAGES = [
  ["DrillMap", drillCoordinates, drillConfig, (hole) => hole],
  ["TechnoMap", technoCoordinates, technoConfig, asBackendRecord],
];

describe.each(PAGES)("%s coordinates", (_page, {
  attachDeviationOffsets,
  calculateDeviationEndpoint,
  convertUtmToMapPosition,
  projectDrillholes,
}, { MAP_CONFIG, MAP_UTM_BOUNDS }, toApi) => {
  const EXAGGERATION = MAP_CONFIG.deviationExaggeration;
  const endpointOf = (hole) => calculateDeviationEndpoint(toApi(hole));

  describe("convertUtmToMapPosition", () => {
    it("maps the bounds minimum corner to the top-left", () => {
      // maxY maps to yPercent 0 because screen Y grows downward.
      const result = convertUtmToMapPosition({ x: MAP_UTM_BOUNDS.minX, y: MAP_UTM_BOUNDS.maxY });

      expect(result.xPercent).toBeCloseTo(0);
      expect(result.yPercent).toBeCloseTo(0);
      expect(result.isInsideMap).toBe(true);
    });

    it("maps the opposite corner to the bottom-right", () => {
      const result = convertUtmToMapPosition({ x: MAP_UTM_BOUNDS.maxX, y: MAP_UTM_BOUNDS.minY });

      expect(result.xPercent).toBeCloseTo(100);
      expect(result.yPercent).toBeCloseTo(100);
      expect(result.isInsideMap).toBe(true);
    });

    it("inverts the Y axis", () => {
      const north = convertUtmToMapPosition({ x: 418000, y: 4897000 });
      const south = convertUtmToMapPosition({ x: 418000, y: 4891000 });

      expect(north.yPercent).toBeLessThan(south.yPercent);
    });

    it("preserves the original record fields", () => {
      const result = convertUtmToMapPosition({ holeId: "GTZO-1", x: 418000, y: 4894000, gt: 0.3 });

      expect(result.holeId).toBe("GTZO-1");
      expect(result.gt).toBe(0.3);
    });

    it("flags a point outside the bounds without discarding it", () => {
      const result = convertUtmToMapPosition({ x: MAP_UTM_BOUNDS.maxX + 5000, y: 4894000 });

      expect(result.isInsideMap).toBe(false);
      expect(result.xPercent).toBeGreaterThan(100);
    });

    it("returns null for non-numeric coordinates", () => {
      expect(convertUtmToMapPosition({ x: "abc", y: 4894000 })).toBeNull();
      expect(convertUtmToMapPosition({ x: 418000, y: null })).toBeNull();
      expect(convertUtmToMapPosition({})).toBeNull();
    });

    it("throws when the configured bounds are unusable", () => {
      // A bad config must fail loudly rather than silently plotting NaN.
      expect(() => convertUtmToMapPosition({ x: 1, y: 1 }, { minX: 0, maxX: 0, minY: 0, maxY: 1 }))
        .toThrow(/bounds/i);
      expect(() => convertUtmToMapPosition({ x: 1, y: 1 }, { minX: NaN, maxX: 1, minY: 0, maxY: 1 }))
        .toThrow(/bounds/i);
    });
  });

  describe("calculateDeviationEndpoint", () => {
    const base = { x: 418000, y: 4894000, finalDeviation: 10 };

    it("uses the configured exaggeration of 5", () => {
      expect(EXAGGERATION).toBe(5);
    });

    it("projects due north for azimuth 0", () => {
      const end = endpointOf({ ...base, azimuth: 0 });

      expect(end.x).toBeCloseTo(418000);
      expect(end.y).toBeCloseTo(4894000 + 10 * EXAGGERATION);
    });

    it("projects due east for azimuth 90", () => {
      const end = endpointOf({ ...base, azimuth: 90 });

      expect(end.x).toBeCloseTo(418000 + 10 * EXAGGERATION);
      expect(end.y).toBeCloseTo(4894000);
    });

    it("treats azimuth 360 the same as 0", () => {
      const at0 = endpointOf({ ...base, azimuth: 0 });
      const at360 = endpointOf({ ...base, azimuth: 360 });

      expect(at360.x).toBeCloseTo(at0.x);
      expect(at360.y).toBeCloseTo(at0.y);
    });

    it("applies the exaggeration factor", () => {
      const end = endpointOf({ ...base, azimuth: 90, finalDeviation: 1 });

      expect(end.x - base.x).toBeCloseTo(EXAGGERATION);
    });

    it("accepts numeric strings from the API", () => {
      const end = endpointOf({ x: "418000", y: "4894000", azimuth: "90", finalDeviation: "10" });

      expect(end.x).toBeCloseTo(418000 + 50);
    });

    // The API sends these fields PascalCase; a camelCase-only reader returned
    // null for every hole and no line was ever drawn.
    it("reads PascalCase Azimuth/FinalDeviation (and X/Y) the same as camelCase", () => {
      const camel = endpointOf({ x: 418000, y: 4894000, azimuth: 45, finalDeviation: 25 });
      const pascal = endpointOf({ X: 418000, Y: 4894000, Azimuth: 45, FinalDeviation: 25 });
      const mixed = endpointOf({ x: 418000, y: 4894000, Azimuth: 45, FinalDeviation: 25 });

      expect(pascal).not.toBeNull();
      expect(pascal).toEqual(camel);
      expect(mixed).toEqual(camel);
    });

    it("returns null for an out-of-range azimuth", () => {
      expect(endpointOf({ ...base, azimuth: 361 })).toBeNull();
      expect(endpointOf({ ...base, azimuth: -1 })).toBeNull();
    });

    it("returns null when there is no deviation to draw", () => {
      expect(endpointOf({ ...base, azimuth: 45, finalDeviation: 0 })).toBeNull();
      expect(endpointOf({ ...base, azimuth: 45, finalDeviation: -5 })).toBeNull();
      expect(endpointOf({ ...base, azimuth: 45, finalDeviation: null })).toBeNull();
    });

    it("returns null when azimuth or position is missing", () => {
      expect(endpointOf({ ...base, azimuth: null })).toBeNull();
      expect(endpointOf({ ...base, azimuth: "" })).toBeNull();
      expect(endpointOf({ x: null, y: 4894000, azimuth: 45, finalDeviation: 5 })).toBeNull();
    });
  });

  describe("projectDrillholes", () => {
    it("returns an empty array for no drillholes", () => {
      expect(projectDrillholes([])).toEqual([]);
    });

    it("builds a stable key from hole id and index", () => {
      const result = projectDrillholes([{ holeId: "GTZO-1" }, { holeId: "GTZO-2" }]);

      expect(result.map((r) => r.key)).toEqual(["GTZO-1-0", "GTZO-2-1"]);
    });

    it("reads the hole id under its PascalCase spelling for the key", () => {
      const result = projectDrillholes([{ HoleId: "GTZO-1" }]);

      expect(result[0].key).toBe("GTZO-1-0");
    });

    it("keeps keys unique when hole ids repeat", () => {
      const result = projectDrillholes([{ holeId: "X" }, { holeId: "X" }]);

      expect(new Set(result.map((r) => r.key)).size).toBe(2);
    });

    it("falls back to a placeholder key when the hole id is missing", () => {
      const result = projectDrillholes([{}]);

      expect(result[0].key).toBe("drillhole-0");
    });

    it("projects the endpoint when one exists", () => {
      const hole = { holeId: "A", x: 418000, y: 4894000, azimuth: 90, finalDeviation: 10 };
      const [feature] = projectDrillholes([toApi(hole)]);
      const expected = convertUtmToMapPosition(endpointOf(hole));

      expect(feature.endpoint).toEqual(expected);
      expect(feature.endpoint.xPercent).toEqual(expect.any(Number));
      expect(feature.endpoint.yPercent).toEqual(expect.any(Number));
    });

    it("leaves the endpoint null when there is no deviation", () => {
      const [feature] = projectDrillholes([{ holeId: "A", x: 418000, y: 4894000 }]);

      expect(feature.endpoint).toBeNull();
    });

    it("preserves the original drillhole record", () => {
      const drillhole = { holeId: "A", gt: 0.4 };
      const result = projectDrillholes([drillhole]);

      expect(result[0].drillhole).toBe(drillhole);
    });

    it("no longer decides rig-ness itself (resolveMarkerKind does)", () => {
      const [feature] = projectDrillholes([{ holeStatus: "INPROGRESS" }]);

      expect(Object.keys(feature).sort()).toEqual(["drillhole", "endpoint", "key"]);
    });
  });

  describe("attachDeviationOffsets", () => {
    const projected = [{
      drillhole: { xPercent: 10, yPercent: 10 },
      key: "A-0",
      endpoint: { xPercent: 20, yPercent: 30 },
    }];

    it("converts a percentage delta into pixel offsets", () => {
      const [feature] = attachDeviationOffsets(projected, { mapWidth: 1000, mapHeight: 500 });

      expect(feature.deviation).toEqual({ x: 100, y: 100 });
    });

    it("produces a negative offset when the endpoint is up-left", () => {
      const upLeft = [{ ...projected[0], endpoint: { xPercent: 5, yPercent: 5 } }];
      const [feature] = attachDeviationOffsets(upLeft, { mapWidth: 1000, mapHeight: 1000 });

      expect(feature.deviation.x).toBeLessThan(0);
      expect(feature.deviation.y).toBeLessThan(0);
    });

    it("returns a null deviation before the map has been measured", () => {
      const [feature] = attachDeviationOffsets(projected, { mapWidth: 0, mapHeight: 0 });

      expect(feature.deviation).toBeNull();
    });

    it("returns a null deviation when there is no endpoint", () => {
      const none = [{ ...projected[0], endpoint: null }];
      const [feature] = attachDeviationOffsets(none, { mapWidth: 1000, mapHeight: 500 });

      expect(feature.deviation).toBeNull();
    });

    it("carries key and drillhole through unchanged", () => {
      const [feature] = attachDeviationOffsets(projected, { mapWidth: 100, mapHeight: 100 });

      expect(feature.key).toBe("A-0");
      expect(feature.drillhole).toBe(projected[0].drillhole);
    });

    it("handles an empty list", () => {
      expect(attachDeviationOffsets([], { mapWidth: 100, mapHeight: 100 })).toEqual([]);
    });
  });

  // Formerly the Exploration/Techno "deviation parity" suite. Running it for
  // both pages' copies keeps them in step: direction of every compass
  // quadrant, projection, and pixel offsets.
  describe("deviation pipeline end to end", () => {
    const HOLES = [
      { holeId: "NE", x: 418000, y: 4894000, azimuth: 45, finalDeviation: 25 },
      { holeId: "SE", x: 418500, y: 4894500, azimuth: 135, finalDeviation: 12.5 },
      { holeId: "SW", x: 419000, y: 4895000, azimuth: 225, finalDeviation: 40 },
      { holeId: "NW", x: 419500, y: 4895500, azimuth: 315, finalDeviation: 1.33 },
      { holeId: "N", x: 420000, y: 4896000, azimuth: 0, finalDeviation: 8 },
      { holeId: "E", x: 420500, y: 4896500, azimuth: 90, finalDeviation: 8 },
      { holeId: "S", x: 421000, y: 4893000, azimuth: 180, finalDeviation: 8 },
      { holeId: "W", x: 421500, y: 4893500, azimuth: 270, finalDeviation: 8 },
      { holeId: "PASCAL-NE", X: 418000, Y: 4894000, Azimuth: 45, FinalDeviation: 25 },
      { holeId: "NO-AZ", x: 422000, y: 4894000, finalDeviation: 8 },
      { holeId: "NO-DEV", x: 422500, y: 4894500, azimuth: 90 },
      { holeId: "ZERO-DEV", x: 422900, y: 4895000, azimuth: 90, finalDeviation: 0 },
    ];
    const DRAWN = HOLES.slice(0, 9);
    const UNDRAWN = HOLES.slice(9);
    const MAP = { mapWidth: 1200, mapHeight: 850 };

    const read = (hole, field) => hole[field] ?? hole[field[0].toUpperCase() + field.slice(1)];

    describe("endpoint calculation", () => {
      it.each(DRAWN.map((hole) => [hole.holeId, hole]))(
        "puts the %s endpoint at deviation × exaggeration along the azimuth",
        (_id, hole) => {
          const end = endpointOf(hole);
          const radians = (read(hole, "azimuth") * Math.PI) / 180;
          const distance = read(hole, "finalDeviation") * EXAGGERATION;

          expect(end.x).toBeCloseTo(read(hole, "x") + Math.sin(radians) * distance);
          expect(end.y).toBeCloseTo(read(hole, "y") + Math.cos(radians) * distance);
          expect(Math.hypot(end.x - read(hole, "x"), end.y - read(hole, "y"))).toBeCloseTo(distance);
        },
      );

      it.each(UNDRAWN.map((hole) => [hole.holeId, hole]))("gives %s no endpoint", (_id, hole) => {
        expect(endpointOf(hole)).toBeNull();
      });
    });

    describe("projection", () => {
      it.each(HOLES.map((hole) => [hole.holeId, hole]))("places %s inside the map", (_id, hole) => {
        const position = convertUtmToMapPosition({ x: read(hole, "x"), y: read(hole, "y") });

        expect(position.isInsideMap).toBe(true);
        expect(position.xPercent).toBeCloseTo(
          ((read(hole, "x") - MAP_UTM_BOUNDS.minX) / (MAP_UTM_BOUNDS.maxX - MAP_UTM_BOUNDS.minX)) * 100,
        );
        expect(position.yPercent).toBeCloseTo(
          ((MAP_UTM_BOUNDS.maxY - read(hole, "y")) / (MAP_UTM_BOUNDS.maxY - MAP_UTM_BOUNDS.minY)) * 100,
        );
      });
    });

    // The offsets are what the SVG actually draws, so this is the assertion that
    // catches a direction or origin mismatch.
    describe("pixel offsets", () => {
      // projectDrillholes only projects the ENDPOINT; the holes handed to it are
      // already projected by useMapData, so they are pre-projected here too.
      // convertUtmToMapPosition reads only lower-case x/y, so the PascalCase
      // hole is normalised for the collar the same way the API mapper would.
      const offsets = new Map(
        attachDeviationOffsets(
          projectDrillholes(
            HOLES.map((hole) => convertUtmToMapPosition({ ...toApi(hole), x: read(hole, "x"), y: read(hole, "y") })),
          ),
          MAP,
        ).map(({ drillhole, deviation }) => [drillhole.holeId, deviation]),
      );

      it("points a due-north hole up the map and a due-east hole right", () => {
        // Northing increases up the map, so a north deviation is negative y.
        expect(offsets.get("N").y).toBeLessThan(0);
        expect(Math.abs(offsets.get("N").x)).toBeLessThan(0.001);
        expect(offsets.get("E").x).toBeGreaterThan(0);
        expect(Math.abs(offsets.get("E").y)).toBeLessThan(0.001);
      });

      it("points a due-south hole down the map and a due-west hole left", () => {
        expect(offsets.get("S").y).toBeGreaterThan(0);
        expect(Math.abs(offsets.get("S").x)).toBeLessThan(0.001);
        expect(offsets.get("W").x).toBeLessThan(0);
        expect(Math.abs(offsets.get("W").y)).toBeLessThan(0.001);
      });

      it.each([
        ["NE", 1, -1],
        ["SE", 1, 1],
        ["SW", -1, 1],
        ["NW", -1, -1],
      ])("points %s into the right screen quadrant", (id, signX, signY) => {
        expect(Math.sign(offsets.get(id).x)).toBe(signX);
        expect(Math.sign(offsets.get(id).y)).toBe(signY);
      });

      it("draws a PascalCase hole exactly like its camelCase twin", () => {
        expect(offsets.get("PASCAL-NE")).not.toBeNull();
        expect(offsets.get("PASCAL-NE").x).toBeCloseTo(offsets.get("NE").x);
        expect(offsets.get("PASCAL-NE").y).toBeCloseTo(offsets.get("NE").y);
      });

      it("draws nothing for holes without a usable deviation", () => {
        expect(UNDRAWN.map(({ holeId }) => offsets.get(holeId))).toEqual([null, null, null]);
      });
    });
  });
});
