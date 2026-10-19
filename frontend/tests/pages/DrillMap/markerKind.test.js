import { describe, expect, it } from "vitest";
import {
  MARKER_KINDS,
  markerShapeFor,
  resolveMarkerKind,
} from "../../../src/pages/DrillMap/utils/markerKind.js";
import { isInProgressHole, readDrillholeTag } from "../../../src/utils/drillholeFields.js";

// Exploration Map: rig > PRODUCT (triangle) > INJECT (square) > plain drillhole (square).

describe("MARKER_KINDS", () => {
  it("lists the four kinds", () => {
    expect([...MARKER_KINDS].sort()).toEqual(["drillhole", "injector", "producer", "rig"]);
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
  });

  it("shows a square for INJECT", () => {
    expect(resolveMarkerKind({ HolePurpose: "INJECT" })).toBe("injector");
  });

  // The rule the brief calls out explicitly: rig only, no shape beneath.
  it("lets INPROGRESS win over PRODUCT", () => {
    expect(resolveMarkerKind({ HoleStatus: "INPROGRESS", HolePurpose: "PRODUCT" })).toBe("rig");
  });

  it("lets INPROGRESS win over INJECT", () => {
    expect(resolveMarkerKind({ HoleStatus: "INPROGRESS", HolePurpose: "INJECT" })).toBe("rig");
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
    expect(resolveMarkerKind({ HolePurpose: 1 })).toBe("drillhole");
    expect(resolveMarkerKind({ HoleStatus: true })).toBe("drillhole");
  });

  it("falls back to a plain drillhole when the purpose is missing or unknown", () => {
    expect(resolveMarkerKind({})).toBe("drillhole");
    expect(resolveMarkerKind({ HolePurpose: "Observation" })).toBe("drillhole");
    expect(resolveMarkerKind({ HolePurpose: null })).toBe("drillhole");
  });

  // The Exploration dataset is gated to SEDIMENT/DEVELOP, so this is the
  // common case here, not an edge case.
  it("leaves a non-production purpose as a plain drillhole", () => {
    expect(resolveMarkerKind({ HolePurpose: "SEDIMENT" })).toBe("drillhole");
    expect(resolveMarkerKind({ HolePurpose: "DEVELOP" })).toBe("drillhole");
  });

  it("survives a missing record", () => {
    expect(resolveMarkerKind(undefined)).toBe("drillhole");
    expect(resolveMarkerKind(null)).toBe("drillhole");
  });

  it("only ever returns one of this page's kinds", () => {
    const samples = [{}, { HolePurpose: "PRODUCT" }, { HolePurpose: "INJECT" }, { HoleStatus: "INPROGRESS" }];

    samples.forEach((sample) => expect(MARKER_KINDS).toContain(resolveMarkerKind(sample)));
  });
});

// The shared field readers both pages' resolvers are built on.
describe("field reading", () => {
  it("accepts either casing for the hole status", () => {
    expect(isInProgressHole({ holeStatus: "INPROGRESS" })).toBe(true);
    expect(isInProgressHole({ HoleStatus: "INPROGRESS" })).toBe(true);
  });

  it("accepts either casing for the hole purpose", () => {
    expect(readDrillholeTag({ holePurpose: "INJECT" }, "holePurpose")).toBe("INJECT");
    expect(readDrillholeTag({ HolePurpose: "INJECT" }, "holePurpose")).toBe("INJECT");
  });

  it("ignores casing and surrounding whitespace in the value", () => {
    expect(isInProgressHole({ HoleStatus: " inprogress" })).toBe(true);
    expect(readDrillholeTag({ HolePurpose: "  product " }, "holePurpose")).toBe("PRODUCT");
  });

  it("returns an empty string rather than a non-string value", () => {
    expect(readDrillholeTag({ HoleStatus: 1 }, "holeStatus")).toBe("");
    expect(readDrillholeTag({ HolePurpose: null }, "holePurpose")).toBe("");
    expect(isInProgressHole({ HoleStatus: true })).toBe(false);
  });
});

describe("markerShapeFor", () => {
  it("gives the producer a triangle", () => {
    expect(markerShapeFor("producer")).toBe("triangle");
  });

  it("gives every other non-rig kind a square", () => {
    expect(markerShapeFor("injector")).toBe("square");
    expect(markerShapeFor("drillhole")).toBe("square");
  });
});
