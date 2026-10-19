import { describe, expect, it } from "vitest";
import {
  MARKER_KINDS,
  markerShapeFor,
  resolveMarkerKind,
} from "../../../src/pages/TechnoMap/utils/markerKind.js";

// Techno Map: rig > PRODUCT (triangle) > anything else (injector square). The
// dataset is gated to PRODUCT and INJECT, so INJECT is not matched specially:
// it lands on the injector square as the fallback.

describe("MARKER_KINDS", () => {
  it("lists the three kinds, with no plain 'drillhole'", () => {
    expect([...MARKER_KINDS].sort()).toEqual(["injector", "producer", "rig"]);
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
    expect(resolveMarkerKind({ HolePurpose: 1 })).toBe("injector");
    expect(resolveMarkerKind({ HoleStatus: true })).toBe("injector");
  });

  it("falls back to an injector square when the purpose is missing or unknown", () => {
    expect(resolveMarkerKind({})).toBe("injector");
    expect(resolveMarkerKind({ HolePurpose: "Observation" })).toBe("injector");
    expect(resolveMarkerKind({ HolePurpose: "SEDIMENT" })).toBe("injector");
    expect(resolveMarkerKind({ HolePurpose: null })).toBe("injector");
  });

  it("survives a missing record", () => {
    expect(resolveMarkerKind(undefined)).toBe("injector");
    expect(resolveMarkerKind(null)).toBe("injector");
  });

  it("never returns the Exploration-only 'drillhole' kind", () => {
    const samples = [{}, { HolePurpose: "SEDIMENT" }, { HolePurpose: "DEVELOP" }, { HolePurpose: "INJECT" }];

    samples.forEach((sample) => {
      expect(resolveMarkerKind(sample)).not.toBe("drillhole");
      expect(MARKER_KINDS).toContain(resolveMarkerKind(sample));
    });
  });
});

describe("markerShapeFor", () => {
  it("gives the producer a triangle", () => {
    expect(markerShapeFor("producer")).toBe("triangle");
  });

  it("gives the injector a square", () => {
    expect(markerShapeFor("injector")).toBe("square");
  });
});
