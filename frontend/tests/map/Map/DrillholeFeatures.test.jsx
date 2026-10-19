import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import DrillholeFeatures from "../../../src/map/Map/DrillholeFeatures.jsx";
import {
  attachDeviationOffsets,
  convertUtmToMapPosition,
  projectDrillholes,
} from "../../../src/map/utils/coordinates.js";

afterEach(cleanup);

// The features component takes already-projected drillholes, so the records go
// through the same projection the page uses.
function project(records) {
  return records.map((record) => convertUtmToMapPosition(record));
}

const MAP = { mapWidth: 1200, mapHeight: 850 };

const EXPLORATION_LABELS = {
  rig: "Rig",
  producer: "Producer drillhole",
  injector: "Injector drillhole",
  drillhole: "Drillhole",
};
const TECHNO_LABELS = { ...EXPLORATION_LABELS, rig: "Drill rig" };

function renderFeatures(records, {
  deviationVisible = true,
  fallbackMarkerKind = "drillhole",
  markerLabels = EXPLORATION_LABELS,
} = {}) {
  return render(
    <DrillholeFeatures
      drillholes={project(records)}
      fallbackMarkerKind={fallbackMarkerKind}
      markerLabels={markerLabels}
      deviationVisible={deviationVisible}
      mapWidth={MAP.mapWidth}
      mapHeight={MAP.mapHeight}
    />,
  );
}

const lineOf = (container) => {
  const line = container.querySelector(".deviation-line-vector line");

  return ["x1", "y1", "x2", "y2"].map((a) => Number(line.getAttribute(a)));
};

describe("DrillholeFeatures deviation lines", () => {
  // This is the bug: the API sends these fields PascalCase, and the old reader
  // only looked for camelCase, so every endpoint came back null and no line
  // was ever drawn.
  it("draws a line for PascalCase deviation fields", () => {
    const { container } = renderFeatures([
      { holeId: "A", x: 418000, y: 4894000, Azimuth: 45, FinalDeviation: 25 },
    ]);

    expect(container.querySelectorAll(".deviation-line-vector").length).toBe(1);
  });

  it("still draws a line for camelCase deviation fields", () => {
    const { container } = renderFeatures([
      { holeId: "A", x: 418000, y: 4894000, azimuth: 45, finalDeviation: 25 },
    ]);

    expect(container.querySelectorAll(".deviation-line-vector").length).toBe(1);
  });

  it("draws a PascalCase line identical to its camelCase twin", () => {
    const pascal = lineOf(renderFeatures([
      { holeId: "A", x: 418000, y: 4894000, Azimuth: 45, FinalDeviation: 25 },
    ]).container);
    cleanup();
    const camel = lineOf(renderFeatures([
      { holeId: "A", x: 418000, y: 4894000, azimuth: 45, finalDeviation: 25 },
    ]).container);

    expect(pascal).toEqual(camel);
  });

  it("draws no line for a hole with no deviation", () => {
    const { container } = renderFeatures([
      { holeId: "A", x: 418000, y: 4894000 },
      { holeId: "B", x: 418500, y: 4894500, Azimuth: 45, FinalDeviation: 0 },
    ]);

    expect(container.querySelectorAll(".deviation-line-vector").length).toBe(0);
  });

  it("gives the line a non-zero length on the map", () => {
    const { container } = renderFeatures([
      { holeId: "A", x: 418000, y: 4894000, Azimuth: 90, FinalDeviation: 40 },
    ]);
    const [x1, y1, x2, y2] = lineOf(container);

    // Azimuth 90 is due east, so the line runs in +x with no northing change.
    expect(x2 - x1).toBeGreaterThan(0);
    expect(Math.abs(y2 - y1)).toBeLessThan(0.001);
  });

  it("keeps the line hidden when deviation display is off", () => {
    const { container } = renderFeatures([
      { holeId: "A", x: 418000, y: 4894000, Azimuth: 45, FinalDeviation: 25 },
    ], { deviationVisible: false });

    expect(container.querySelectorAll(".deviation-line-vector").length).toBe(0);
  });

  it("still renders the marker alongside the line", () => {
    const { container } = renderFeatures([
      { holeId: "A", x: 418000, y: 4894000, Azimuth: 45, FinalDeviation: 25 },
    ]);

    expect(container.querySelectorAll(".drillhole-marker").length).toBe(1);
  });

  // Formerly the "rendered SVG" parity checks against the Techno copy.
  describe("rendered SVG", () => {
    it.each([
      ["down-right (SE)", 135],
      ["up-left (NW)", 315],
      ["up-right (NE)", 45],
      ["down-left (SW)", 225],
      ["due north", 0],
      ["due east", 90],
    ])("draws %s from the collar to the computed offset", (_name, azimuth) => {
      const hole = { holeId: "A", x: 418000, y: 4894000, azimuth, finalDeviation: 20 };
      const { container } = renderFeatures([hole]);
      const svg = container.querySelector(".deviation-line-vector");
      const [expected] = attachDeviationOffsets(projectDrillholes(project([hole])), MAP);
      const [x1, y1, x2, y2] = lineOf(container);

      // A 1x1 viewport with overflow: visible, so the line starts at the collar.
      expect(svg.getAttribute("width")).toBe("1");
      expect(svg.getAttribute("height")).toBe("1");
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect([x1, y1]).toEqual([0, 0]);
      expect(x2).toBeCloseTo(expected.deviation.x);
      expect(y2).toBeCloseTo(expected.deviation.y);
    });

    it("positions the feature at the collar's map percentage", () => {
      const hole = { holeId: "A", x: 418000, y: 4894000 };
      const [projected] = project([hole]);
      const { container } = renderFeatures([hole]);
      const feature = container.querySelector(".drillhole-feature");

      expect(feature.style.left).toBe(`${projected.xPercent}%`);
      expect(feature.style.top).toBe(`${projected.yPercent}%`);
    });
  });
});

describe("DrillholeFeatures markers", () => {
  it("resolves each marker's kind with the page's fallback", () => {
    const records = [{ holeId: "A", x: 418000, y: 4894000, holePurpose: "SEDIMENT" }];

    const exploration = renderFeatures(records, { fallbackMarkerKind: "drillhole" });
    expect(exploration.container.querySelector(".drillhole-marker--drillhole")).toBeTruthy();
    cleanup();

    const techno = renderFeatures(records, { fallbackMarkerKind: "injector", markerLabels: TECHNO_LABELS });
    expect(techno.container.querySelector(".drillhole-marker--injector")).toBeTruthy();
  });

  it("labels each marker with the page's role label", () => {
    const records = [{ holeId: "R", x: 418000, y: 4894000, holeStatus: "INPROGRESS", campaign: "C" }];
    const { container } = renderFeatures(records, { fallbackMarkerKind: "injector", markerLabels: TECHNO_LABELS });

    expect(container.querySelector(".drillhole-marker--rig").getAttribute("aria-label")).toBe("Drill rig R, C");
  });

  // One hole can never show both a rig and a shape.
  it("collapses duplicate records into one marker, preferring the rig", () => {
    const { container } = renderFeatures([
      { holeId: "A", x: 418000, y: 4894000, holePurpose: "PRODUCT" },
      { holeId: "A", x: 418000, y: 4894000, holePurpose: "PRODUCT", holeStatus: "INPROGRESS" },
    ]);

    expect(container.querySelectorAll(".drillhole-feature")).toHaveLength(1);
    expect(container.querySelectorAll(".drillhole-marker--rig")).toHaveLength(1);
    expect(container.querySelector(".marker-symbol")).toBeNull();
  });

  it("uses no techno- prefixed classes", () => {
    const { container } = renderFeatures([
      { holeId: "A", x: 418000, y: 4894000, azimuth: 45, finalDeviation: 25 },
    ], { fallbackMarkerKind: "injector", markerLabels: TECHNO_LABELS });

    expect(container.innerHTML).not.toContain("techno-");
  });
});
