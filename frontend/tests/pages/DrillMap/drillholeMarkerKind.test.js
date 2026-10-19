import { describe, expect, it } from "vitest";
import {
  MARKER_KIND,
  isInProgressHole,
  isRigKind,
  markerShapeFor,
  readHolePurpose,
  readHoleStatus,
  resolveDrillholeMarkerKind,
} from "../../../src/pages/DrillMap/drillholeMarkerKind.js";

describe("Exploration Map marker kind", () => {
  describe("resolveDrillholeMarkerKind", () => {
    it("shows a rig for an in-progress hole", () => {
      expect(resolveDrillholeMarkerKind({ HoleStatus: "INPROGRESS" }))
        .toBe(MARKER_KIND.rig);
    });

    it("shows a triangle for PRODUCT", () => {
      expect(resolveDrillholeMarkerKind({ HolePurpose: "PRODUCT" }))
        .toBe(MARKER_KIND.producer);
    });

    it("shows a square for INJECT", () => {
      expect(resolveDrillholeMarkerKind({ HolePurpose: "INJECT" }))
        .toBe(MARKER_KIND.injector);
    });

    // The rule the brief calls out explicitly: rig only, no triangle beneath.
    it("lets INPROGRESS win over PRODUCT", () => {
      expect(resolveDrillholeMarkerKind({
        HoleStatus: "INPROGRESS",
        HolePurpose: "PRODUCT",
      })).toBe(MARKER_KIND.rig);
    });

    it("lets INPROGRESS win over INJECT", () => {
      expect(resolveDrillholeMarkerKind({
        HoleStatus: "INPROGRESS",
        HolePurpose: "INJECT",
      })).toBe(MARKER_KIND.rig);
    });

    it("honours the rig flag the feature list already computed", () => {
      expect(resolveDrillholeMarkerKind({ HolePurpose: "PRODUCT" }, true))
        .toBe(MARKER_KIND.rig);
    });

    // This map's own dataset is gated to SEDIMENT/DEVELOP, so this is the
    // common case, not an edge case.
    it("leaves a non-production purpose as a plain drillhole", () => {
      expect(resolveDrillholeMarkerKind({ HolePurpose: "SEDIMENT" }))
        .toBe(MARKER_KIND.drillhole);
      expect(resolveDrillholeMarkerKind({ HolePurpose: "DEVELOP" }))
        .toBe(MARKER_KIND.drillhole);
      expect(resolveDrillholeMarkerKind({})).toBe(MARKER_KIND.drillhole);
    });

    it("survives a missing record", () => {
      expect(resolveDrillholeMarkerKind(undefined)).toBe(MARKER_KIND.drillhole);
    });

    it("also accepts the Techno Map's PRODUCER/INJECTOR spellings", () => {
      expect(resolveDrillholeMarkerKind({ HolePurpose: "PRODUCER" }))
        .toBe(MARKER_KIND.producer);
      expect(resolveDrillholeMarkerKind({ HolePurpose: "INJECTOR" }))
        .toBe(MARKER_KIND.injector);
    });
  });

  describe("field reading", () => {
    it("accepts either casing for the hole status", () => {
      expect(isInProgressHole({ holeStatus: "INPROGRESS" })).toBe(true);
      expect(isInProgressHole({ HoleStatus: "INPROGRESS" })).toBe(true);
    });

    it("accepts either casing for the hole purpose", () => {
      expect(readHolePurpose({ holePurpose: "INJECT" })).toBe("INJECT");
      expect(readHolePurpose({ HolePurpose: "INJECT" })).toBe("INJECT");
    });

    it("ignores casing and surrounding whitespace in the value", () => {
      expect(resolveDrillholeMarkerKind({ HolePurpose: "  product " }))
        .toBe(MARKER_KIND.producer);
      expect(isInProgressHole({ HoleStatus: " inprogress" })).toBe(true);
    });

    it("returns an empty string rather than a non-string value", () => {
      expect(readHoleStatus({ HoleStatus: 1 })).toBe("");
      expect(readHolePurpose({ HolePurpose: null })).toBe("");
    });
  });

  describe("shape mapping", () => {
    it("gives the producer a triangle", () => {
      expect(markerShapeFor(MARKER_KIND.producer)).toBe("triangle");
    });

    it("gives everything else a square", () => {
      expect(markerShapeFor(MARKER_KIND.injector)).toBe("square");
      expect(markerShapeFor(MARKER_KIND.drillhole)).toBe("square");
    });

    it("identifies the rig kind", () => {
      expect(isRigKind(MARKER_KIND.rig)).toBe(true);
      expect(isRigKind(MARKER_KIND.producer)).toBe(false);
    });
  });
});
