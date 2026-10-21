import { describe, expect, it } from "vitest";
import {
  MARKER_KINDS,
  markerShapeFor,
  resolveDrillholeType,
  resolveMarkerKind,
} from "../../../src/pages/TechnoMap/utils/markerKind.js";
import { DRILLHOLE_TYPES, MAP_CONFIG } from "../../../src/pages/TechnoMap/config/technoMapConfig.js";

// Techno Map: rig > the purpose's drillhole type > injector square as the fallback.

describe("MARKER_KINDS", () => {
  it("lists the rig and the nine drillhole types, with no plain 'drillhole'", () => {
    expect([...MARKER_KINDS].sort()).toEqual(["rig", ...DRILLHOLE_TYPES].sort());
    expect(MARKER_KINDS).toHaveLength(10);
    expect(MARKER_KINDS).not.toContain("drillhole");
  });
});

describe("resolveMarkerKind", () => {
  it("shows a rig for an in-progress hole", () => {
    expect(resolveMarkerKind({ HoleStatus: "INPROGRESS" })).toBe("rig");
    expect(resolveMarkerKind({ holeStatus: "INPROGRESS" })).toBe("rig");
  });

  // The regression that made every Techno marker a square: the resolver
  // matched PRODUCER, which no record carries.
  it("shows a triangle for PRODUCT", () => {
    expect(resolveMarkerKind({ HolePurpose: "PRODUCT" })).toBe("producer");
    expect(markerShapeFor("producer")).toBe("triangle");
  });

  it("shows a square for INJECT", () => {
    expect(resolveMarkerKind({ HolePurpose: "INJECT" })).toBe("injector");
    expect(markerShapeFor("injector")).toBe("square");
  });

  it.each([
    ["DEVELOP", "development"],
    ["EXPLORE", "exploration"],
    ["GEOTECH", "geotechnical"],
    ["MONITOR", "monitoring"],
    ["RASAMPLE", "ra-grade-sampling"],
    ["SEDIMENT", "sediment-sampling"],
    ["WATER", "water"],
  ])("maps %s to %s", (purpose, type) => {
    expect(resolveMarkerKind({ HolePurpose: purpose })).toBe(type);
  });

  // The rule the brief calls out explicitly: rig only, no shape beneath.
  it.each(["PRODUCT", "INJECT", "WATER", "EXPLORE"])("lets INPROGRESS win over %s", (purpose) => {
    expect(resolveMarkerKind({ HoleStatus: "INPROGRESS", HolePurpose: purpose })).toBe("rig");
  });

  it("keeps the type of an in-progress hole for filtering", () => {
    expect(resolveDrillholeType({ HoleStatus: "INPROGRESS", HolePurpose: "PRODUCT" })).toBe("producer");
  });

  it("also accepts the PRODUCER/INJECTOR spellings", () => {
    expect(resolveMarkerKind({ HolePurpose: "PRODUCER" })).toBe("producer");
    expect(resolveMarkerKind({ HolePurpose: "INJECTOR" })).toBe("injector");
  });

  it("accepts either casing for the hole purpose field", () => {
    expect(resolveMarkerKind({ holePurpose: "PRODUCT" })).toBe("producer");
    expect(resolveMarkerKind({ HolePurpose: "PRODUCT" })).toBe("producer");
    expect(resolveMarkerKind({ holePurpose: "INJECT" })).toBe("injector");
  });

  it("ignores casing and surrounding whitespace in the value", () => {
    expect(resolveMarkerKind({ HolePurpose: "  product " })).toBe("producer");
    expect(resolveMarkerKind({ HolePurpose: " inject" })).toBe("injector");
    expect(resolveMarkerKind({ HoleStatus: " inprogress" })).toBe("rig");
  });

  it("does not treat a non-string value as a match", () => {
    expect(resolveMarkerKind({ HolePurpose: 1 })).toBe("injector");
    expect(resolveMarkerKind({ HoleStatus: true })).toBe("injector");
  });

  it("falls back to an injector square when the purpose is missing or unknown", () => {
    expect(resolveMarkerKind({})).toBe("injector");
    expect(resolveMarkerKind({ HolePurpose: "Observation" })).toBe("injector");
    expect(resolveMarkerKind({ HolePurpose: null })).toBe("injector");
  });

  it("survives a missing record", () => {
    expect(resolveMarkerKind(undefined)).toBe("injector");
    expect(resolveMarkerKind(null)).toBe("injector");
  });
});

describe("markerShapeFor", () => {
  it("gives every type a different shape", () => {
    const shapes = DRILLHOLE_TYPES.map(markerShapeFor);

    expect(new Set(shapes).size).toBe(DRILLHOLE_TYPES.length);
  });

  it("reads shapes from technoMap.yaml", () => {
    MAP_CONFIG.drillholeTypes.forEach(({ id, shape }) => expect(markerShapeFor(id)).toBe(shape));
  });
});
