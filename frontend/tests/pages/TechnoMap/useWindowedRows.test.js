import { describe, expect, it } from "vitest";
import { windowRange } from "../../../src/pages/TechnoMap/Table/useWindowedRows.js";

describe("windowRange", () => {
  it("renders the rows in view plus the overscan, with padding for the rest", () => {
    // 300px box at the top of 5,000 30px rows: rows 0-10 in view, 10 more below.
    expect(windowRange(5000, 30, 0, 300, 10)).toEqual({ start: 0, end: 21, padTop: 0, padBottom: (5000 - 21) * 30 });
  });

  it("follows the scroll position", () => {
    const range = windowRange(5000, 30, 3000, 300, 10);
    expect(range.start).toBe(90);
    expect(range.end).toBe(121);
    expect(range.padTop + (range.end - range.start) * 30 + range.padBottom).toBe(5000 * 30);
  });

  it("stops at the ends and handles a short or empty list", () => {
    expect(windowRange(5000, 30, 5000 * 30, 300, 10)).toMatchObject({ end: 5000, padBottom: 0 });
    expect(windowRange(3, 30, 0, 300, 10)).toEqual({ start: 0, end: 3, padTop: 0, padBottom: 0 });
    expect(windowRange(0, 30, 900, 300, 10)).toEqual({ start: 0, end: 0, padTop: 0, padBottom: 0 });
  });
});
