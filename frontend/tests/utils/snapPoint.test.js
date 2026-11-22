import { describe, expect, it } from "vitest";
import { snapPoint } from "../../src/utils/snapPoint.js";

const target = (x, y, radius, id) => ({ at: { x, y }, radius, utm: { x: id, y: id } });

describe("snapPoint", () => {
  it("returns the nearest target whose reach covers the point", () => {
    expect(snapPoint({ x: 10, y: 0 }, [[target(0, 0, 12, 1), target(16, 0, 12, 2)]])).toEqual({ x: 2, y: 2 });
  });

  it("returns null when no target reaches the point", () => {
    expect(snapPoint({ x: 30, y: 0 }, [[target(0, 0, 12, 1)]])).toBeNull();
    expect(snapPoint({ x: 0, y: 0 }, [])).toBeNull();
  });

  it("lets an earlier (higher) layer win over a nearer target below it", () => {
    const icons = [target(10, 0, 12, 1)];
    const holes = [target(0, 0, 8, 2)];

    expect(snapPoint({ x: 0, y: 0 }, [icons, holes])).toEqual({ x: 1, y: 1 });
    expect(snapPoint({ x: -5, y: 0 }, [icons, holes])).toEqual({ x: 2, y: 2 });
  });
});
