import { describe, expect, it } from "vitest";
import {
  ALL_VISIBLE,
  isDrillholeShown,
  parseFilters,
  selectShownFeatures,
  setAllFilters,
} from "../../../src/pages/TechnoMap/utils/mapFilters.js";
import { FILTER_IDS } from "../../../src/pages/TechnoMap/config/technoMapConfig.js";
import { convertUtmToMapPosition } from "../../../src/pages/TechnoMap/utils/coordinates.js";
import { buildMarkerFeatures } from "../../../src/pages/TechnoMap/utils/markerLayer.js";

const PRODUCER = { holeId: "P", x: 418000, y: 4894000, holePurpose: "PRODUCT", category: "producer" };
const PRODUCER_RIG = { ...PRODUCER, holeId: "R", x: 418100, holeStatus: "INPROGRESS" };
const WATER = { holeId: "W", x: 418200, y: 4894000, holePurpose: "EAU", category: "water" };
// Type PRODUCT, but flagged Ra_Grade_Sampling = 1: the backend files it under Ra-grade-sampling.
const RA_PRODUCER = { holeId: "RA", x: 418300, y: 4894000, holePurpose: "PRODUCT", raGradeSampling: true, category: "ra-grade-sampling" };
// An unmapped Type (SER): no category, so no filter shows it.
const UNMAPPED = { holeId: "U", x: 418400, y: 4894000, holePurpose: "SER", category: null };
const without = (...ids) => ({ ...ALL_VISIBLE, ...Object.fromEntries(ids.map((id) => [id, false])) });

describe("isDrillholeShown", () => {
  it("shows everything with every filter on", () => {
    [PRODUCER, PRODUCER_RIG, WATER].forEach((hole) => expect(isDrillholeShown(hole, ALL_VISIBLE)).toBe(true));
  });

  it("hides a hole whose type is unchecked", () => {
    expect(isDrillholeShown(WATER, without("water"))).toBe(false);
    expect(isDrillholeShown(PRODUCER, without("water"))).toBe(true);
  });

  // Producer checked + Drilling in progress checked -> rig.
  // Producer unchecked + Drilling in progress checked -> hidden.
  // Producer checked + Drilling in progress unchecked -> hidden, not a triangle.
  it("needs both the type and Drilling in progress for an in-progress hole", () => {
    expect(isDrillholeShown(PRODUCER_RIG, ALL_VISIBLE)).toBe(true);
    expect(isDrillholeShown(PRODUCER_RIG, without("producer"))).toBe(false);
    expect(isDrillholeShown(PRODUCER_RIG, without("drilling-in-progress"))).toBe(false);
  });

  it("lets the sampling category, not the Type, decide a flagged hole", () => {
    expect(isDrillholeShown(RA_PRODUCER, without("producer"))).toBe(true);
    expect(isDrillholeShown(RA_PRODUCER, without("ra-grade-sampling"))).toBe(false);
  });

  it("never shows a hole without a category", () => {
    expect(isDrillholeShown(UNMAPPED, ALL_VISIBLE)).toBe(false);
    expect(isDrillholeShown({ ...UNMAPPED, holeStatus: "INPROGRESS" }, ALL_VISIBLE)).toBe(false);
  });

  it("leaves ordinary holes alone when Drilling in progress is unchecked", () => {
    expect(isDrillholeShown(PRODUCER, without("drilling-in-progress"))).toBe(true);
  });

  it("is unaffected by the technological cells and deviation layers", () => {
    expect(isDrillholeShown(PRODUCER, without("technological-cells", "deviation-line"))).toBe(true);
  });
});

describe("selectShownFeatures", () => {
  // Worked out once per dataset (deduplicated there), then only filtered.
  const projected = buildMarkerFeatures([PRODUCER, PRODUCER_RIG, WATER, PRODUCER, UNMAPPED].map((hole) => convertUtmToMapPosition(hole)));

  it("deduplicates and filters", () => {
    expect(selectShownFeatures(projected, ALL_VISIBLE).map(({ drillhole }) => drillhole.holeId)).toEqual(["P", "R", "W"]);
    expect(selectShownFeatures(projected, without("producer")).map(({ drillhole }) => drillhole.holeId)).toEqual(["W"]);
  });

  it("shows nothing after Hide All", () => {
    expect(selectShownFeatures(projected, setAllFilters(false))).toEqual([]);
  });
});

describe("setAllFilters and parseFilters", () => {
  it("covers all 12 filters", () => {
    expect(Object.keys(setAllFilters(true)).sort()).toEqual([...FILTER_IDS].sort());
    expect(Object.values(setAllFilters(false)).every((value) => value === false)).toBe(true);
  });

  it("defaults to everything visible when nothing is stored", () => {
    expect(parseFilters(null)).toEqual(ALL_VISIBLE);
    expect(parseFilters("garbage")).toEqual(ALL_VISIBLE);
  });

  it("keeps stored choices and fills in missing or malformed ones as visible", () => {
    const parsed = parseFilters({ water: false, producer: "no", unknown: false });

    expect(parsed.water).toBe(false);
    expect(parsed.producer).toBe(true);
    expect(parsed).not.toHaveProperty("unknown");
  });
});
