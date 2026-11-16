// Exploration Map DOM markers and their role labels. The Techno Map draws its
// markers on a canvas with one shared tooltip: see TechnoMap/DrillholeLayer.test.jsx
// and TechnoMap/MarkerTooltip.test.jsx.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import DrillDrillholeMarker from "../../../src/pages/DrillMap/Map/DrillholeMarker.jsx";
import * as drillConfig from "../../../src/pages/DrillMap/config/drillMapConfig.js";
import DrillholeMarker from "../../../src/pages/DrillMap/Map/DrillholeMarker.jsx";
import { MAP_CONFIG } from "../../../src/pages/DrillMap/config/drillMapConfig.js";
import { DrillholeFields } from "../../../src/components/MapTooltip/MapTooltip.jsx";
import { EXPLORATION_FIELDS } from "../../../src/pages/DrillMap/utils/explorationFields.js";

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

// Fill for a hole without GT: one uniform colour on the Exploration Map.
const PAGES = [
  ["DrillMap", DrillDrillholeMarker, drillConfig, () => drillConfig.MAP_CONFIG.uniformMarkerColor],
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
    it("has no tooltip of its own: the page shows one floating tooltip", () => {
      const { container } = renderMarker({}, "injector");

      expect(container.querySelector(".drillhole-tooltip")).toBeNull();
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

    it("reports hover, click and Ctrl+click with its key, and shows pinned and selected states", () => {
      const onHover = vi.fn();
      const onActivate = vi.fn();
      const { rerender } = render(
        <DrillholeMarker featureKey="k1" drillhole={HOLE} kind="injector" roleLabel="Injector" onHover={onHover} onActivate={onActivate} />,
      );
      const button = screen.getByRole("button");

      fireEvent.pointerEnter(button);
      expect(onHover).toHaveBeenLastCalledWith("k1");
      fireEvent.pointerLeave(button);
      expect(onHover).toHaveBeenLastCalledWith(null);
      fireEvent.click(button);
      expect(onActivate).toHaveBeenLastCalledWith("k1", false);
      fireEvent.click(button, { ctrlKey: true });
      expect(onActivate).toHaveBeenLastCalledWith("k1", true);

      expect(button.getAttribute("aria-expanded")).toBe("false");
      rerender(<DrillholeMarker featureKey="k1" drillhole={HOLE} kind="injector" roleLabel="Injector" isPinned isSelected />);
      expect(button.getAttribute("aria-expanded")).toBe("true");
      expect(button.className).toContain("is-pinned");
      expect(button.className).toContain("is-selected");
    });
  });
});

// The tooltip rows (also the table columns): what /api/exploration-map returns.
describe("Exploration tooltip fields", () => {
  const rows = (overrides = {}) => {
    const { container } = render(<DrillholeFields title="T" fields={EXPLORATION_FIELDS} drillhole={{ ...HOLE, ...overrides }} />);
    const entries = [...container.querySelectorAll(".drillhole-tooltip__fields > div")]
      .map((row) => [row.querySelector("dt").textContent, row.querySelector("dd").textContent]);
    cleanup();

    return Object.fromEntries(entries);
  };

  it("lists only the exploration API fields, in order", () => {
    expect(EXPLORATION_FIELDS.map(({ label }) => label)).toEqual([
      "Hole ID", "Hole Purpose", "Hole Status", "X (m)", "Y (m)", "Z (m)", "Coordinate Type",
      "Year", "Campaign", "GT", "Max Depth (m)", "Azimuth", "Final Deviation (m)",
    ]);
  });

  it("shows every value, PascalCase or camelCase", () => {
    const shown = rows({ holeStatus: undefined, HoleStatus: "VALIDATED", CoordinateType: "Surveyed" });

    expect(shown["Hole ID"]).toBe("IZO_456_062_47_B_");
    expect(shown["Hole Purpose"]).toBe("INJECT");
    expect(shown["Hole Status"]).toBe("VALIDATED");
    expect(shown["X (m)"]).toBe("421,099.50");
    expect(shown["Y (m)"]).toBe("4,893,548.00");
    expect(shown["Z (m)"]).toBe("709.74");
    expect(shown["Coordinate Type"]).toBe("Surveyed");
    expect(shown.Year).toBe("2026");
    expect(shown.Campaign).toBe("ZOOVCH OVOO - 2026");
    expect(shown.GT).toBe("0.3198");
    expect(shown["Max Depth (m)"]).toBe("160.00");
    expect(shown.Azimuth).toBe("307.67");
    expect(shown["Final Deviation (m)"]).toBe("1.33");
  });

  it("shows a dash rather than a zero for a missing reading", () => {
    const shown = rows({ azimuth: null, finalDeviation: null, holeStatus: null });

    expect(shown.Azimuth).toBe("—");
    expect(shown["Final Deviation (m)"]).toBe("—");
    expect(shown["Hole Status"]).toBe("—");
  });
});

const LABEL_HOLE = { holeId: "IZO_456_062_47_B_", campaign: "ZOOVCH OVOO - 2026", gt: 0.3198 };

// Role labels come from this page's drillMap.yaml, as DrillholeFeatures passes them.
const renderMarker = (kind) => render(
  <DrillholeMarker drillhole={LABEL_HOLE} kind={kind} roleLabel={MAP_CONFIG.markerLabels[kind]} />,
);

const ariaLabel = () => screen.getByRole("button").getAttribute("aria-label");

describe("DrillMap DrillholeMarker", () => {
  it("names a rig 'Rig'", () => {
    renderMarker("rig");

    expect(ariaLabel()).toBe("Rig IZO_456_062_47_B_, ZOOVCH OVOO - 2026");
  });

  it("names a producer 'Producer drillhole'", () => {
    renderMarker("producer");

    expect(ariaLabel()).toBe("Producer drillhole IZO_456_062_47_B_, ZOOVCH OVOO - 2026");
  });

  it("names an injector 'Injector drillhole'", () => {
    renderMarker("injector");

    expect(ariaLabel()).toBe("Injector drillhole IZO_456_062_47_B_, ZOOVCH OVOO - 2026");
  });

  it("names a plain drillhole 'Drillhole'", () => {
    renderMarker("drillhole");

    expect(ariaLabel()).toBe("Drillhole IZO_456_062_47_B_, ZOOVCH OVOO - 2026");
  });

  it("draws a square for a plain drillhole, as before", () => {
    const { container } = renderMarker("drillhole");

    expect(container.querySelector(".marker-symbol--square")).toBeTruthy();
    expect(container.querySelector(".marker-symbol--triangle")).toBeNull();
  });
});
