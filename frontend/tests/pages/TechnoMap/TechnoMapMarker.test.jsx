import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import TechnoMapMarker from "../../../src/pages/TechnoMap/TechnoMapMarker.jsx";
import { TECHNO_MARKER_KIND } from "../../../src/pages/TechnoMap/technoMarkerKind.js";
import {
  TECHNO_GT_RANGES,
  getTechnoMapGtRange,
} from "../../../src/pages/TechnoMap/technoMapConfig.js";

afterEach(cleanup);

const HOLE = {
  holeId: "IZO_456_062_47_B_",
  campaign: "ZOOVCH OVOO - 2026",
  holePurpose: "INJECT",
  holeStatus: "VALIDATED",
  gt: 0.3198,
  maxDepth: 160,
  azimuth: 307.67,
  finalDeviation: 1.33,
  x: 421099.5,
  y: 4893548,
  z: 709.74,
  year: 2026,
};

const renderMarker = (overrides = {}, markerKind) => render(
  <TechnoMapMarker drillhole={{ ...HOLE, ...overrides }} markerKind={markerKind} />,
);

const symbolColour = (container) => container
  .querySelector(".techno-marker-symbol")
  .style.getPropertyValue("--techno-status-color");

describe("TechnoMapMarker", () => {
  describe("shapes", () => {
    it("draws a square for an injector", () => {
      const { container } = renderMarker({}, TECHNO_MARKER_KIND.injector);

      expect(container.querySelector(".techno-marker-symbol--square")).toBeTruthy();
      expect(container.querySelector(".techno-marker-symbol--triangle")).toBeNull();
    });

    it("draws a triangle for a producer", () => {
      const { container } = renderMarker({}, TECHNO_MARKER_KIND.producer);

      expect(container.querySelector(".techno-marker-symbol--triangle")).toBeTruthy();
      expect(container.querySelector(".techno-marker-symbol--square")).toBeNull();
    });
  });

  describe("rig", () => {
    it("draws the rig icon", () => {
      const { container } = renderMarker({}, TECHNO_MARKER_KIND.rig);

      expect(container.querySelector(".techno-rig-marker-icon").getAttribute("src"))
        .toBe("/rig.svg");
    });

    // "Never display both the rig and drillhole marker for the same drillhole."
    it("draws no shape alongside the rig", () => {
      const { container } = renderMarker(
        { holePurpose: "PRODUCT", holeStatus: "INPROGRESS" },
        TECHNO_MARKER_KIND.rig,
      );

      expect(container.querySelector(".techno-marker-symbol")).toBeNull();
      expect(container.querySelectorAll(".techno-rig-marker-icon")).toHaveLength(1);
    });

    it("keeps the rig sizing class so the icon size stays constant", () => {
      const { container } = renderMarker({}, TECHNO_MARKER_KIND.rig);

      expect(container.firstChild.className).toContain("techno-drillhole-marker--rig");
    });
  });

  // The fill carries the grade, and it has to do so for both shapes: the
  // triangle paints it through a ::before, the square through its background.
  describe("GT colour", () => {
    it.each(TECHNO_GT_RANGES.map((range) => [
      range.label,
      (range.min + range.max) / 2,
      range.color,
    ]))("fills a square from the %s band", (_label, gt, colour) => {
      const { container } = renderMarker({ gt }, TECHNO_MARKER_KIND.injector);

      expect(symbolColour(container)).toBe(colour);
    });

    it.each(TECHNO_GT_RANGES.map((range) => [
      range.label,
      (range.min + range.max) / 2,
      range.color,
    ]))("fills a triangle from the %s band", (_label, gt, colour) => {
      const { container } = renderMarker({ gt }, TECHNO_MARKER_KIND.producer);

      expect(symbolColour(container)).toBe(colour);
    });

    it("gives a square and a triangle of the same grade the same fill", () => {
      const square = renderMarker({ gt: 0.3198 }, TECHNO_MARKER_KIND.injector);
      const squareColour = symbolColour(square.container);
      cleanup();
      const triangle = renderMarker({ gt: 0.3198 }, TECHNO_MARKER_KIND.producer);

      expect(symbolColour(triangle.container)).toBe(squareColour);
      expect(squareColour).toBe(getTechnoMapGtRange(0.3198).color);
    });

    it("falls back to the uniform colour when GT is missing", () => {
      const { container } = renderMarker({ gt: null }, TECHNO_MARKER_KIND.producer);

      expect(symbolColour(container)).toBe("#000000");
    });

    it("does not paint a blank GT as a real low-grade reading", () => {
      const { container } = renderMarker({ gt: "  " }, TECHNO_MARKER_KIND.injector);

      expect(symbolColour(container)).toBe("#000000");
    });
  });

  describe("tooltip", () => {
    const tooltipText = (overrides = {}) => {
      const { container } = renderMarker(overrides, TECHNO_MARKER_KIND.injector);

      return container.querySelector(".techno-drillhole-tooltip").textContent;
    };

    it("shows Hole Status", () => {
      expect(tooltipText()).toContain("Hole Status: VALIDATED");
    });

    // The old row read only `holeStatus`, so a PascalCase payload showed a dash.
    it("shows Hole Status when the API sends it PascalCase", () => {
      expect(tooltipText({ holeStatus: undefined, HoleStatus: "VALIDATED" }))
        .toContain("Hole Status: VALIDATED");
    });

    it("shows Hole Purpose", () => {
      expect(tooltipText()).toContain("Hole Purpose: INJECT");
    });

    it("shows the deviation inputs behind the line", () => {
      const text = tooltipText();

      expect(text).toContain("Azimuth: 307.67");
      expect(text).toContain("Final Deviation: 1.33 m");
    });

    it("keeps every field it showed before", () => {
      const text = tooltipText();

      expect(text).toContain("IZO_456_062_47_B_");
      expect(text).toContain("X: 421,099.5");
      expect(text).toContain("Y: 4,893,548");
      expect(text).toContain("Z: 709.74 m");
      expect(text).toContain("Year: 2026");
      expect(text).toContain("Campaign: ZOOVCH OVOO - 2026");
      expect(text).toContain("GT: 0.3198");
      expect(text).toContain("Max Depth: 160 m");
    });

    it("shows a dash rather than a zero for a missing reading", () => {
      const text = tooltipText({ azimuth: null, finalDeviation: null, holeStatus: null });

      expect(text).toContain("Azimuth: —");
      expect(text).toContain("Final Deviation: —");
      expect(text).toContain("Hole Status: —");
    });
  });
});
