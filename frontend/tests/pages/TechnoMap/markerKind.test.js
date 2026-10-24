import { describe, expect, it } from "vitest";
import {
  MARKER_KINDS,
  markerShapeFor,
  resolveDrillholeType,
  resolveMarkerKind,
} from "../../../src/pages/TechnoMap/utils/markerKind.js";
import { DRILLHOLE_TYPES, MAP_CONFIG } from "../../../src/pages/TechnoMap/config/technoMapConfig.js";
import { svgPointsFor } from "../../../src/pages/TechnoMap/utils/markerShapes.js";
import { asBackendRecord } from "./backendRecord.js";

// Techno Map: rig > the API's category > nothing (a hole with no category
// belongs to no filter and is not drawn).

describe("MARKER_KINDS", () => {
  it("lists the rig and the nine drillhole types, with no plain 'drillhole'", () => {
    expect([...MARKER_KINDS].sort()).toEqual(["rig", ...DRILLHOLE_TYPES].sort());
    expect(MARKER_KINDS).toHaveLength(10);
    expect(MARKER_KINDS).not.toContain("drillhole");
  });
});

describe("resolveDrillholeType", () => {
  it.each(DRILLHOLE_TYPES)("accepts the API category %s", (category) => {
    expect(resolveDrillholeType({ category })).toBe(category);
  });

  it("accepts either casing for the field and ignores case and whitespace in the value", () => {
    expect(resolveDrillholeType({ Category: "producer" })).toBe("producer");
    expect(resolveDrillholeType({ category: "  Producer " })).toBe("producer");
  });

  // The frontend no longer classifies: Type alone, without the backend's
  // category, decides nothing.
  it("does not derive a type from the SQL Type itself", () => {
    expect(resolveDrillholeType({ holePurpose: "PRODUCT" })).toBeNull();
  });

  it("returns null for a missing, unknown or non-string category", () => {
    expect(resolveDrillholeType({})).toBeNull();
    expect(resolveDrillholeType({ category: null })).toBeNull();
    expect(resolveDrillholeType({ category: "observation" })).toBeNull();
    expect(resolveDrillholeType({ category: 1 })).toBeNull();
    expect(resolveDrillholeType(undefined)).toBeNull();
    expect(resolveDrillholeType(null)).toBeNull();
  });
});

// The backend mapping (TechnoMapCategory.cs, mirrored by backendRecord.js)
// carried through to the marker the page draws.
describe("SQL Type and sampling flags, end to end", () => {
  const kindOf = (row) => resolveMarkerKind(asBackendRecord(row));

  it.each([
    ["DEVELOP", "development"],
    ["EAU", "water"],
    ["EXPLO", "exploration"],
    ["GEOTECHNICAL", "geotechnical"],
    ["INJECT", "injector"],
    ["PIEZO", "monitoring"],
    ["PRODUCT", "producer"],
    ["WATER_WELL", "water"],
  ])("maps Type %s to %s", (type, kind) => {
    expect(kindOf({ holePurpose: type, raGradeSampling: false, sedimentSampling: false })).toBe(kind);
  });

  it.each(["CONTROLE", "HYDRO_WELL", "SEDIMENT", "SER"])("leaves Type %s unmapped and undrawn", (type) => {
    expect(kindOf({ holePurpose: type })).toBeNull();
  });

  it("matches Type case-insensitively and trimmed", () => {
    expect(kindOf({ holePurpose: "  piezo " })).toBe("monitoring");
  });

  it("lets Ra_Grade_Sampling = 1 override the Type", () => {
    expect(kindOf({ holePurpose: "EXPLO", raGradeSampling: true, sedimentSampling: false })).toBe("ra-grade-sampling");
  });

  it("lets Sediment_Sampling = 1 override the Type", () => {
    expect(kindOf({ holePurpose: "PRODUCT", raGradeSampling: false, sedimentSampling: true })).toBe("sediment-sampling");
  });

  it("puts Ra-grade before Sediment when both flags are set", () => {
    expect(kindOf({ holePurpose: "EXPLO", raGradeSampling: true, sedimentSampling: true })).toBe("ra-grade-sampling");
  });

  it("treats NULL flags as inactive", () => {
    expect(kindOf({ holePurpose: "INJECT", raGradeSampling: null, sedimentSampling: null })).toBe("injector");
  });

  it("gives a flagged hole with an unmapped Type its sampling category", () => {
    expect(kindOf({ holePurpose: "SER", sedimentSampling: true })).toBe("sediment-sampling");
  });

  it("keeps the original Type on the record", () => {
    expect(asBackendRecord({ holePurpose: "EXPLO", raGradeSampling: true }).holePurpose).toBe("EXPLO");
  });
});

describe("resolveMarkerKind", () => {
  it("draws the category's symbol", () => {
    expect(resolveMarkerKind({ category: "producer" })).toBe("producer");
    expect(markerShapeFor("producer")).toBe("square");
    expect(resolveMarkerKind({ category: "injector" })).toBe("injector");
    expect(markerShapeFor("injector")).toBe("triangle-down");
  });

  // The rule the brief calls out explicitly: rig only, no shape beneath.
  it.each(["producer", "injector", "water", "ra-grade-sampling"])("lets INPROGRESS win over %s", (category) => {
    expect(resolveMarkerKind({ HoleStatus: "INPROGRESS", category })).toBe("rig");
    expect(resolveMarkerKind({ holeStatus: " inprogress", category })).toBe("rig");
  });

  it("keeps the type of an in-progress hole for filtering", () => {
    expect(resolveDrillholeType({ HoleStatus: "INPROGRESS", category: "producer" })).toBe("producer");
  });

  it("draws nothing, not even a rig, for a hole without a category", () => {
    expect(resolveMarkerKind({ holeStatus: "INPROGRESS" })).toBeNull();
    expect(resolveMarkerKind({})).toBeNull();
    expect(resolveMarkerKind(null)).toBeNull();
  });

  it("does not treat a non-string status as in progress", () => {
    expect(resolveMarkerKind({ HoleStatus: true, category: "injector" })).toBe("injector");
  });
});

describe("markerShapeFor", () => {
  it("reads shapes from technoMap.yaml", () => {
    MAP_CONFIG.drillholeTypes.forEach(({ id, shape }) => expect(markerShapeFor(id)).toBe(shape));
  });
});

describe("marker outlines", () => {
  const points = (shape) => svgPointsFor(shape, 0, 0, 10).split(" ").map((pair) => pair.split(",").map(Number));
  const extent = (shape) => {
    const xs = points(shape).map(([x]) => x);
    const ys = points(shape).map(([, y]) => y);

    return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  };

  it("draws the diamond vertical: taller than wide", () => {
    const { width, height } = extent("diamond");

    expect(height).toBeGreaterThan(width);
  });

  it("gives the star five points", () => {
    expect(points("star")).toHaveLength(10);
  });

  it("keeps the square square", () => {
    const { width, height } = extent("square");

    expect(width).toBe(height);
  });

  it("points the downward triangle down", () => {
    const [left, right, tip] = points("triangle-down");

    expect(tip[1]).toBeGreaterThan(left[1]);
    expect(left[1]).toBe(right[1]);
  });
});
