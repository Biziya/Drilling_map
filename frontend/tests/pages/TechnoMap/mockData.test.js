import { describe, expect, it } from "vitest";
import { MOCK_CELLS, MOCK_DRILLHOLES } from "../../../src/pages/TechnoMap/mock/mockData.js";
import { MAP_UTM_BOUNDS } from "../../../src/pages/TechnoMap/config/technoMapConfig.js";
import { calculateDeviationEndpoint } from "../../../src/pages/TechnoMap/utils/coordinates.js";
import { resolveDrillholeType } from "../../../src/pages/TechnoMap/utils/markerKind.js";
import { isInProgressHole } from "../../../src/utils/drillholeFields.js";

const countBy = (items, key) => items.reduce((counts, item) => {
  const value = key(item);
  counts[value] = (counts[value] ?? 0) + 1;

  return counts;
}, {});

// Ray casting; vertices in UTM.
function isInside({ x, y }, vertices) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const a = vertices[i];
    const b = vertices[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }

  return inside;
}

describe("Techno Map demo dataset", () => {
  it("has 130 unique drillholes", () => {
    expect(MOCK_DRILLHOLES).toHaveLength(130);
    expect(new Set(MOCK_DRILLHOLES.map(({ holeId }) => holeId)).size).toBe(130);
    expect(new Set(MOCK_DRILLHOLES.map(({ x, y }) => `${x}|${y}`)).size).toBe(130);
  });

  it("has the requested number of holes per type", () => {
    expect(countBy(MOCK_DRILLHOLES, resolveDrillholeType)).toEqual({
      development: 10,
      exploration: 10,
      geotechnical: 10,
      injector: 30,
      monitoring: 10,
      producer: 30,
      "ra-grade-sampling": 10,
      "sediment-sampling": 10,
      water: 10,
    });
  });

  it("marks 10 of those holes as drilling in progress", () => {
    expect(MOCK_DRILLHOLES.filter(isInProgressHole)).toHaveLength(10);
  });

  it("gives 30 holes a deviation line, none of them still being drilled", () => {
    const deviated = MOCK_DRILLHOLES.filter((hole) => calculateDeviationEndpoint(hole));

    expect(deviated).toHaveLength(30);
    expect(deviated.some(isInProgressHole)).toBe(false);
  });

  it("places every hole on the base map", () => {
    MOCK_DRILLHOLES.forEach(({ holeId, x, y }) => {
      expect(x, holeId).toBeGreaterThan(MAP_UTM_BOUNDS.minX);
      expect(x, holeId).toBeLessThan(MAP_UTM_BOUNDS.maxX);
      expect(y, holeId).toBeGreaterThan(MAP_UTM_BOUNDS.minY);
      expect(y, holeId).toBeLessThan(MAP_UTM_BOUNDS.maxY);
    });
  });

  it("has five technological cells, TC-001 to TC-005", () => {
    expect(MOCK_CELLS.map(({ label }) => label)).toEqual(["TC-001", "TC-002", "TC-003", "TC-004", "TC-005"]);
    MOCK_CELLS.forEach(({ vertices }) => expect(vertices.length).toBeGreaterThanOrEqual(3));
  });

  it("puts every producer and injector inside a technological cell, 6 + 6 per cell", () => {
    const wells = MOCK_DRILLHOLES.filter((hole) => ["producer", "injector"].includes(resolveDrillholeType(hole)));

    MOCK_CELLS.forEach(({ vertices }) => {
      const inCell = wells.filter((hole) => isInside(hole, vertices));
      expect(countBy(inCell, resolveDrillholeType)).toEqual({ injector: 6, producer: 6 });
    });
  });

  it("keeps other types outside the production cells", () => {
    const others = MOCK_DRILLHOLES.filter((hole) => !["producer", "injector"].includes(resolveDrillholeType(hole)));

    others.forEach((hole) => {
      expect(MOCK_CELLS.some(({ vertices }) => isInside(hole, vertices)), hole.holeId).toBe(false);
    });
  });

  it("is labelled as demo data, not survey results", () => {
    MOCK_DRILLHOLES.forEach(({ campaign }) => expect(campaign).toBe("DEMO DATASET"));
  });

  it("is fixed: the same ids and coordinates on every load", async () => {
    const reloaded = await import("../../../src/pages/TechnoMap/mock/mockData.js?reload");

    expect(reloaded.MOCK_DRILLHOLES).toEqual(MOCK_DRILLHOLES);
    expect(MOCK_DRILLHOLES[0]).toMatchObject({ holeId: "TM-DEV-001", holePurpose: "DEVELOP" });
    expect(Object.isFrozen(MOCK_DRILLHOLES)).toBe(true);
  });
});
