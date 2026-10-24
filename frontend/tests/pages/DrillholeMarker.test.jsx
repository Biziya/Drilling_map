// Both pages currently share this behaviour; split this file when one page diverges.
// Page-specific parts (role labels, kinds only one page has) live in
// DrillMap/DrillholeMarker.test.jsx and TechnoMap/DrillholeMarker.test.jsx.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import DrillDrillholeMarker from "../../src/pages/DrillMap/Map/DrillholeMarker.jsx";
import TechnoDrillholeMarker from "../../src/pages/TechnoMap/Map/DrillholeMarker.jsx";
import * as drillConfig from "../../src/pages/DrillMap/config/drillMapConfig.js";
import * as technoConfig from "../../src/pages/TechnoMap/config/technoMapConfig.js";

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

// Fill for a hole without GT: one uniform colour on the Exploration Map, the
// hole type's own colour on the Techno Map.
const PAGES = [
  ["DrillMap", DrillDrillholeMarker, drillConfig, () => drillConfig.MAP_CONFIG.uniformMarkerColor],
  ["TechnoMap", TechnoDrillholeMarker, technoConfig, (kind) => technoConfig.DRILLHOLE_TYPE_CONFIG[kind].color],
];

const symbolColour = (container) => container
  .querySelector(".marker-symbol")
  .style.getPropertyValue("--status-color");

describe.each(PAGES)("%s DrillholeMarker", (_page, DrillholeMarker, { MAP_CONFIG, getGtRange }, noGtColour) => {
  const renderMarker = (overrides = {}, kind = "injector", roleLabel = MAP_CONFIG.markerLabels[kind]) => render(
    <DrillholeMarker drillhole={{ ...HOLE, ...overrides }} kind={kind} roleLabel={roleLabel} />,
  );

  describe("shapes", () => {
    it("draws a square for an injector", () => {
      const { container } = renderMarker({}, "injector");

      expect(container.querySelector(".marker-symbol--square")).toBeTruthy();
      expect(container.querySelector(".marker-symbol--triangle")).toBeNull();
    });

    it("draws a triangle for a producer", () => {
      const { container } = renderMarker({}, "producer");

      expect(container.querySelector(".marker-symbol--triangle")).toBeTruthy();
      expect(container.querySelector(".marker-symbol--square")).toBeNull();
    });

    it("uses one class vocabulary with no techno- prefixes", () => {
      const { container } = renderMarker({}, "producer");

      expect(container.innerHTML).not.toContain("techno-");
    });
  });

  describe("rig", () => {
    it("draws the rig icon", () => {
      const { container } = renderMarker({}, "rig");

      expect(container.querySelector(".rig-marker-icon").getAttribute("src"))
        .toBe("/rig.svg");
    });

    // "Never display both the rig and drillhole marker for the same drillhole."
    it("draws no shape alongside the rig", () => {
      const { container } = renderMarker(
        { holePurpose: "PRODUCT", holeStatus: "INPROGRESS" },
        "rig",
      );

      expect(container.querySelector(".marker-symbol")).toBeNull();
      expect(container.querySelectorAll(".rig-marker-icon")).toHaveLength(1);
    });

    it("keeps the rig sizing class so the icon size stays constant", () => {
      const { container } = renderMarker({}, "rig");

      expect(container.firstChild.className).toContain("drillhole-marker--rig");
    });
  });

  // The fill carries the grade, and it has to do so for both shapes: the
  // triangle paints it through a ::before, the square through its background.
  describe("GT colour", () => {
    const bands = MAP_CONFIG.gtRanges.map((range) => [
      range.label,
      (range.min + range.max) / 2,
      range.color,
    ]);

    it.each(bands)("fills a square from the %s band", (_label, gt, colour) => {
      const { container } = renderMarker({ gt }, "injector");

      expect(symbolColour(container)).toBe(colour);
    });

    it.each(bands)("fills a triangle from the %s band", (_label, gt, colour) => {
      const { container } = renderMarker({ gt }, "producer");

      expect(symbolColour(container)).toBe(colour);
    });

    it("gives a square and a triangle of the same grade the same fill", () => {
      const square = renderMarker({ gt: 0.3198 }, "injector");
      const squareColour = symbolColour(square.container);
      cleanup();
      const triangle = renderMarker({ gt: 0.3198 }, "producer");

      expect(symbolColour(triangle.container)).toBe(squareColour);
      expect(squareColour).toBe(getGtRange(0.3198).color);
    });

    it("reads a PascalCase GT the same way", () => {
      const { container } = renderMarker({ gt: undefined, GT: 0.3198 }, "injector");

      expect(symbolColour(container)).toBe(getGtRange(0.3198).color);
    });

    it("falls back to the page's no-GT colour when GT is missing", () => {
      const { container } = renderMarker({ gt: null }, "producer");

      expect(symbolColour(container)).toBe(noGtColour("producer"));
    });

    it("does not paint a blank GT as a real low-grade reading", () => {
      const { container } = renderMarker({ gt: "  " }, "injector");

      expect(symbolColour(container)).toBe(noGtColour("injector"));
    });
  });

  describe("accessibility and interaction", () => {
    it("keeps the tooltip inside the marker button", () => {
      const { container } = renderMarker({}, "injector");

      expect(container.querySelector(".drillhole-marker .drillhole-tooltip")).toBeTruthy();
      expect(container.querySelector(".drillhole-tooltip").getAttribute("role")).toBe("tooltip");
    });

    it("names the hole and its role for assistive tech", () => {
      renderMarker({}, "producer");

      expect(screen.getByRole("button").getAttribute("aria-label"))
        .toBe("Producer drillhole IZO_456_062_47_B_, ZOOVCH OVOO - 2026");
    });

    it("uses whatever role label it is given", () => {
      renderMarker({}, "rig", "Custom role");

      expect(screen.getByRole("button").getAttribute("aria-label"))
        .toBe("Custom role IZO_456_062_47_B_, ZOOVCH OVOO - 2026");
    });

    it("toggles the open state on click and closes on blur", () => {
      renderMarker({}, "injector");
      const button = screen.getByRole("button");

      expect(button.className).not.toContain("is-open");
      fireEvent.click(button);
      expect(button.className).toContain("is-open");
      expect(button.getAttribute("aria-expanded")).toBe("true");
      fireEvent.blur(button);
      expect(button.className).not.toContain("is-open");
    });
  });

  // The Techno Map tooltip shows the pyISR_AllData_V2 fields instead; it is
  // covered in TechnoMap/DrillholeMarker.test.jsx.
  describe.runIf(_page === "DrillMap")("tooltip contents", () => {
    const tooltipText = (overrides = {}) => {
      const { container } = renderMarker(overrides, "injector");

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
