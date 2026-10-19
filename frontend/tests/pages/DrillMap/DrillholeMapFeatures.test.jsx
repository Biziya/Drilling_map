import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import DrillholeMapFeatures from "../../../src/pages/DrillMap/DrillholeMapFeatures.jsx";
import { convertUtmToMapPosition } from "../../../src/pages/DrillMap/utmCoordinates.js";

afterEach(cleanup);

// The features component takes already-projected drillholes, so the records go
// through the same projection the page uses.
function project(records) {
  return records.map((record) => convertUtmToMapPosition(record));
}

const MAP = { mapWidth: 1200, mapHeight: 850 };

function renderFeatures(records, deviationVisible = true) {
  return render(
    <DrillholeMapFeatures
      drillholes={project(records)}
      deviationVisible={deviationVisible}
      mapWidth={MAP.mapWidth}
      mapHeight={MAP.mapHeight}
    />,
  );
}

describe("Exploration Map deviation lines", () => {
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
    const line = container.querySelector(".deviation-line-vector line");
    const dx = Number(line.getAttribute("x2")) - Number(line.getAttribute("x1"));
    const dy = Number(line.getAttribute("y2")) - Number(line.getAttribute("y1"));

    // Azimuth 90 is due east, so the line runs in +x with no northing change.
    expect(dx).toBeGreaterThan(0);
    expect(Math.abs(dy)).toBeLessThan(0.001);
  });

  it("keeps the line hidden when deviation display is off", () => {
    const { container } = renderFeatures([
      { holeId: "A", x: 418000, y: 4894000, Azimuth: 45, FinalDeviation: 25 },
    ], false);

    expect(container.querySelectorAll(".deviation-line-vector").length).toBe(0);
  });

  it("still renders the marker alongside the line", () => {
    const { container } = renderFeatures([
      { holeId: "A", x: 418000, y: 4894000, Azimuth: 45, FinalDeviation: 25 },
    ]);

    expect(container.querySelectorAll(".drillhole-marker").length).toBe(1);
  });
});
