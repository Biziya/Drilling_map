import { describe, expect, it } from "vitest";
import {
  MARKER_KINDS,
  markerShapeFor,
  resolveMarkerKind,
} from "../../../src/map/utils/markerKind.js";
import { isInProgressHole, readDrillholeTag } from "../../../src/utils/drillholeFields.js";

// The Exploration Map falls back to a plain 'drillhole'; the Techno Map to
// 'injector'. Everything except the fallback is shared.
const FALLBACKS = [
  ["Exploration", "drillhole"],
  ["Techno", "injector"],
];

describe("MARKER_KINDS", () => {
  it("lists the four kinds", () => {
    expect([...MARKER_KINDS].sort()).toEqual(["drillhole", "injector", "producer", "rig"]);
  });
});

describe.each(FALLBACKS)("resolveMarkerKind (%s fallback)", (_name, fallback) => {
  const resolve = (drillhole) => resolveMarkerKind(drillhole, fallback);

  it("shows a rig for an in-progress hole", () => {
    expect(resolve({ HoleStatus: "INPROGRESS" })).toBe("rig");
    expect(resolve({ holeStatus: "INPROGRESS" })).toBe("rig");
  });

  // The regression that made every Techno marker a square: the resolver
  // matched PRODUCER, which no record carries.
  it("shows a triangle for PRODUCT", () => {
    expect(resolve({ HolePurpose: "PRODUCT" })).toBe("producer");
  });

  it("shows a square for INJECT", () => {
    expect(resolve({ HolePurpose: "INJECT" })).toBe("injector");
  });

  // The rule the brief calls out explicitly: rig only, no shape beneath.
  it("lets INPROGRESS win over PRODUCT", () => {
    expect(resolve({ HoleStatus: "INPROGRESS", HolePurpose: "PRODUCT" })).toBe("rig");
  });

  it("lets INPROGRESS win over INJECT", () => {
    expect(resolve({ HoleStatus: "INPROGRESS", HolePurpose: "INJECT" })).toBe("rig");
  });

  it("also accepts the PRODUCER/INJECTOR spellings", () => {
    expect(resolve({ HolePurpose: "PRODUCER" })).toBe("producer");
    expect(resolve({ HolePurpose: "INJECTOR" })).toBe("injector");
  });

  it("accepts either casing for the hole purpose field", () => {
    expect(resolve({ holePurpose: "PRODUCT" })).toBe("producer");
    expect(resolve({ HolePurpose: "PRODUCT" })).toBe("producer");
    expect(resolve({ holePurpose: "INJECT" })).toBe("injector");
  });

  it("ignores casing and surrounding whitespace in the value", () => {
    expect(resolve({ HolePurpose: "  product " })).toBe("producer");
    expect(resolve({ HolePurpose: " inject" })).toBe("injector");
    expect(resolve({ HoleStatus: " inprogress" })).toBe("rig");
  });

  it("does not treat a non-string value as a match", () => {
    expect(resolve({ HolePurpose: 1 })).toBe(fallback);
    expect(resolve({ HoleStatus: true })).toBe(fallback);
  });

  it("falls back when the purpose is missing or unknown", () => {
    expect(resolve({})).toBe(fallback);
    expect(resolve({ HolePurpose: "Observation" })).toBe(fallback);
    expect(resolve({ HolePurpose: null })).toBe(fallback);
  });

  it("survives a missing record", () => {
    expect(resolve(undefined)).toBe(fallback);
    expect(resolve(null)).toBe(fallback);
  });
});

describe("resolveMarkerKind fallbacks", () => {
  // The Exploration dataset is gated to SEDIMENT/DEVELOP, so this is the
  // common case there, not an edge case.
  it("leaves a non-production purpose as a plain drillhole on the Exploration Map", () => {
    expect(resolveMarkerKind({ HolePurpose: "SEDIMENT" }, "drillhole")).toBe("drillhole");
    expect(resolveMarkerKind({ HolePurpose: "DEVELOP" }, "drillhole")).toBe("drillhole");
    expect(resolveMarkerKind({}, "drillhole")).toBe("drillhole");
  });

  it("falls back to an injector square on the Techno Map", () => {
    expect(resolveMarkerKind({}, "injector")).toBe("injector");
    expect(resolveMarkerKind({ HolePurpose: "SEDIMENT" }, "injector")).toBe("injector");
  });
});

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
