import { describe, expect, it } from "vitest";
import {
  TECHNO_MARKER_KIND,
  isInProgressHole,
  isInjectorHole,
  isProducerHole,
  markerShapeFor,
  readHolePurpose,
  resolveTechnoMarkerKind,
} from "../../../src/pages/TechnoMap/technoMarkerKind.js";

describe("TechnoMap marker kind", () => {
  describe("resolveTechnoMarkerKind", () => {
    it("shows a rig for an in-progress hole", () => {
      expect(resolveTechnoMarkerKind({ HoleStatus: "INPROGRESS" }))
        .toBe(TECHNO_MARKER_KIND.rig);
    });

    // The regression that made every marker a square: the resolver matched
    // PRODUCER, which no record carries.
    it("shows a triangle for PRODUCT", () => {
      expect(resolveTechnoMarkerKind({ HolePurpose: "PRODUCT" }))
        .toBe(TECHNO_MARKER_KIND.producer);
    });

    it("shows a square for INJECT", () => {
      expect(resolveTechnoMarkerKind({ HolePurpose: "INJECT" }))
        .toBe(TECHNO_MARKER_KIND.injector);
    });

    it("lets INPROGRESS win over PRODUCT", () => {
      expect(resolveTechnoMarkerKind({
        HoleStatus: "INPROGRESS",
        HolePurpose: "PRODUCT",
      })).toBe(TECHNO_MARKER_KIND.rig);
    });

    it("lets INPROGRESS win over INJECT", () => {
      expect(resolveTechnoMarkerKind({
        HoleStatus: "INPROGRESS",
        HolePurpose: "INJECT",
      })).toBe(TECHNO_MARKER_KIND.rig);
    });

    it("honours the rig flag the feature list already computed", () => {
      expect(resolveTechnoMarkerKind({ HolePurpose: "PRODUCT" }, true))
        .toBe(TECHNO_MARKER_KIND.rig);
    });

    it("still accepts the PRODUCER/INJECTOR spellings", () => {
      expect(resolveTechnoMarkerKind({ HolePurpose: "PRODUCER" }))
        .toBe(TECHNO_MARKER_KIND.producer);
      expect(resolveTechnoMarkerKind({ HolePurpose: "INJECTOR" }))
        .toBe(TECHNO_MARKER_KIND.injector);
    });

    it("falls back to a square when the purpose is missing or unknown", () => {
      expect(resolveTechnoMarkerKind({})).toBe(TECHNO_MARKER_KIND.injector);
      expect(resolveTechnoMarkerKind({ HolePurpose: "Observation" }))
        .toBe(TECHNO_MARKER_KIND.injector);
      expect(resolveTechnoMarkerKind({ HolePurpose: null }))
        .toBe(TECHNO_MARKER_KIND.injector);
    });

    it("survives a missing record", () => {
      expect(resolveTechnoMarkerKind(undefined)).toBe(TECHNO_MARKER_KIND.injector);
    });
  });

  describe("field reading", () => {
    it("accepts either casing for the hole status", () => {
      expect(isInProgressHole({ holeStatus: "INPROGRESS" })).toBe(true);
      expect(isInProgressHole({ HoleStatus: "INPROGRESS" })).toBe(true);
    });

    it("accepts either casing for the hole purpose", () => {
      expect(readHolePurpose({ holePurpose: "PRODUCT" })).toBe("PRODUCT");
      expect(readHolePurpose({ HolePurpose: "PRODUCT" })).toBe("PRODUCT");
    });

    it("ignores casing and surrounding whitespace in the value", () => {
      expect(isProducerHole({ HolePurpose: "  product " })).toBe(true);
      expect(isInjectorHole({ HolePurpose: " inject" })).toBe(true);
      expect(isInProgressHole({ HoleStatus: " inprogress" })).toBe(true);
    });

    it("does not treat a non-string value as a match", () => {
      expect(isProducerHole({ HolePurpose: 1 })).toBe(false);
      expect(isInProgressHole({ HoleStatus: true })).toBe(false);
    });
  });

  describe("markerShapeFor", () => {
    it("maps a producer to the triangle shape", () => {
      expect(markerShapeFor(TECHNO_MARKER_KIND.producer)).toBe("triangle");
    });

    it("maps an injector to the square shape", () => {
      expect(markerShapeFor(TECHNO_MARKER_KIND.injector)).toBe("square");
    });
  });
});
