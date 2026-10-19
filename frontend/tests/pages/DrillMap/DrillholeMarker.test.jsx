import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import DrillholeMarker from "../../../src/pages/DrillMap/DrillholeMarker.jsx";
import { MARKER_KIND } from "../../../src/pages/DrillMap/drillholeMarkerKind.js";

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
  <DrillholeMarker drillhole={{ ...HOLE, ...overrides }} markerKind={markerKind} />,
);

describe("DrillholeMarker", () => {
  describe("shapes", () => {
    it("draws a square for an injector", () => {
      const { container } = renderMarker({}, MARKER_KIND.injector);

      expect(container.querySelector(".marker-symbol--square")).toBeTruthy();
      expect(container.querySelector(".marker-symbol--triangle")).toBeNull();
    });

    it("draws a triangle for a producer", () => {
      const { container } = renderMarker({}, MARKER_KIND.producer);

      expect(container.querySelector(".marker-symbol--triangle")).toBeTruthy();
      expect(container.querySelector(".marker-symbol--square")).toBeNull();
    });

    it("draws a square for a plain drillhole, as before", () => {
      const { container } = renderMarker({}, MARKER_KIND.drillhole);

      expect(container.querySelector(".marker-symbol--square")).toBeTruthy();
    });
  });

  describe("rig", () => {
    it("draws the rig icon", () => {
      const { container } = renderMarker({}, MARKER_KIND.rig);

      expect(container.querySelector(".rig-marker-icon").getAttribute("src"))
        .toBe("/rig.svg");
    });

    // "Never display both the rig and drillhole marker for the same drillhole."
    it("draws no shape alongside the rig", () => {
      const { container } = renderMarker(
        { holePurpose: "PRODUCT", holeStatus: "INPROGRESS" },
        MARKER_KIND.rig,
      );

      expect(container.querySelector(".marker-symbol")).toBeNull();
      expect(container.querySelectorAll(".rig-marker-icon")).toHaveLength(1);
    });

    it("keeps the rig sizing class so the icon size stays constant", () => {
      const { container } = renderMarker({}, MARKER_KIND.rig);

      expect(container.firstChild.className).toContain("drillhole-marker--rig");
    });
  });

  describe("colour", () => {
    it("still colours a shape from the GT band", () => {
      const { container } = renderMarker({ gt: 0.3198 }, MARKER_KIND.producer);
      const symbol = container.querySelector(".marker-symbol");

      expect(symbol.style.getPropertyValue("--status-color")).toBeTruthy();
    });
  });

  describe("hover behaviour", () => {
    it("keeps the tooltip inside the marker button", () => {
      const { container } = renderMarker({}, MARKER_KIND.injector);

      expect(container.querySelector(".drillhole-marker .drillhole-tooltip")).toBeTruthy();
    });

    it("names the hole and its role for assistive tech", () => {
      renderMarker({}, MARKER_KIND.producer);

      expect(screen.getByRole("button").getAttribute("aria-label"))
        .toContain("Producer drillhole IZO_456_062_47_B_");
    });
  });

  describe("tooltip contents", () => {
    const tooltipText = (overrides = {}) => {
      const { container } = renderMarker(overrides, MARKER_KIND.injector);

      return container.querySelector(".drillhole-tooltip").textContent;
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
