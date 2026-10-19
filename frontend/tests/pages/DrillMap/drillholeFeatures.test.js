import { describe, expect, it, vi } from "vitest";
import * as drillFeatures from "../../../src/pages/DrillMap/drillholeFeatures.js";
import * as technoFeatures from "../../../src/pages/TechnoMap/drillholeFeatures.js";

const copies = [
  ["DrillMap", drillFeatures],
  ["TechnoMap", technoFeatures],
];

describe.each(copies)("%s/drillholeFeatures", (_name, mod) => {
  const { projectDrillholes, attachDeviationOffsets } = mod;

  const noEndpoint = { calculateEndpoint: () => null, project: (p) => p };

  describe("projectDrillholes", () => {
    it("returns an empty array for no drillholes", () => {
      expect(projectDrillholes([], noEndpoint)).toEqual([]);
    });

    it("builds a stable key from hole id and index", () => {
      const result = projectDrillholes(
        [{ holeId: "GTZO-1" }, { holeId: "GTZO-2" }],
        noEndpoint,
      );

      expect(result.map((r) => r.key)).toEqual(["GTZO-1-0", "GTZO-2-1"]);
    });

    it("keeps keys unique when hole ids repeat", () => {
      const result = projectDrillholes([{ holeId: "X" }, { holeId: "X" }], noEndpoint);

      expect(new Set(result.map((r) => r.key)).size).toBe(2);
    });

    it("falls back to a placeholder key when the hole id is missing", () => {
      const result = projectDrillholes([{}], noEndpoint);

      expect(result[0].key).toBe("drillhole-0");
    });

    it("flags an in-progress hole as a rig", () => {
      const result = projectDrillholes([{ holeStatus: "INPROGRESS" }], noEndpoint);

      expect(result[0].isRig).toBe(true);
    });

    it("accepts the PascalCase field the API also sends", () => {
      const result = projectDrillholes([{ HoleStatus: "INPROGRESS" }], noEndpoint);

      expect(result[0].isRig).toBe(true);
    });

    it("does not flag other statuses as rigs", () => {
      const result = projectDrillholes([{ holeStatus: "Validated" }, {}], noEndpoint);

      expect(result.map((r) => r.isRig)).toEqual([false, false]);
    });

    it("projects the endpoint when one exists", () => {
      const project = vi.fn(() => ({ xPercent: 50, yPercent: 60 }));
      const result = projectDrillholes([{ holeId: "A" }], {
        calculateEndpoint: () => ({ x: 1, y: 2 }),
        project,
      });

      expect(project).toHaveBeenCalledWith({ x: 1, y: 2 });
      expect(result[0].endpoint).toEqual({ xPercent: 50, yPercent: 60 });
    });

    it("leaves the endpoint null when there is no deviation", () => {
      const project = vi.fn();
      const result = projectDrillholes([{ holeId: "A" }], {
        calculateEndpoint: () => null,
        project,
      });

      expect(result[0].endpoint).toBeNull();
      expect(project).not.toHaveBeenCalled();
    });

    it("preserves the original drillhole record", () => {
      const drillhole = { holeId: "A", gt: 0.4 };
      const result = projectDrillholes([drillhole], noEndpoint);

      expect(result[0].drillhole).toBe(drillhole);
    });
  });

  describe("attachDeviationOffsets", () => {
    const projected = [{
      drillhole: { xPercent: 10, yPercent: 10 },
      key: "A-0",
      isRig: false,
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

    it("carries key, drillhole and rig flag through unchanged", () => {
      const [feature] = attachDeviationOffsets(projected, { mapWidth: 100, mapHeight: 100 });

      expect(feature.key).toBe("A-0");
      expect(feature.isRig).toBe(false);
      expect(feature.drillhole).toBe(projected[0].drillhole);
    });

    it("handles an empty list", () => {
      expect(attachDeviationOffsets([], { mapWidth: 100, mapHeight: 100 })).toEqual([]);
    });
  });
});
