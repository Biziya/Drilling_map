// Techno Map marker kinds and labels. The behaviour both pages share
// (deviation lines, dedupe) is in tests/pages/DrillholeFeatures.test.jsx.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import DrillholeFeatures from "../../../src/pages/TechnoMap/Map/DrillholeFeatures.jsx";
import { convertUtmToMapPosition } from "../../../src/pages/TechnoMap/utils/coordinates.js";

afterEach(cleanup);

const renderFeatures = (records) => render(
  <DrillholeFeatures
    drillholes={records.map((record) => convertUtmToMapPosition(record))}
    deviationVisible
    mapWidth={1200}
    mapHeight={850}
  />,
);

const ariaLabel = (container, kind) => container
  .querySelector(`.drillhole-marker--${kind}`)
  .getAttribute("aria-label");

describe("TechnoMap DrillholeFeatures markers", () => {
  it("draws nothing for a hole without a category (unmapped Type), never an injector", () => {
    const { container } = renderFeatures([{ holeId: "A", x: 418000, y: 4894000, holePurpose: "CONTROLE", category: null }]);

    expect(container.querySelector(".drillhole-marker")).toBeNull();
  });

  it("draws a sediment sample with its own type and shape", () => {
    const { container } = renderFeatures([{ holeId: "S", x: 418000, y: 4894000, holePurpose: "EXPLO", category: "sediment-sampling", campaign: "C" }]);

    expect(container.querySelector(".marker-symbol--triangle-down")).toBeTruthy();
    expect(ariaLabel(container, "sediment-sampling")).toBe("Sediment-sampling drillhole S, C");
  });

  it("draws one marker for a hole with both sampling flags, under Ra-grade-sampling", () => {
    const { container } = renderFeatures([
      { holeId: "B", x: 418000, y: 4894000, holePurpose: "EXPLO", raGradeSampling: true, sedimentSampling: true, category: "ra-grade-sampling" },
    ]);

    expect(container.querySelectorAll(".drillhole-marker")).toHaveLength(1);
    expect(container.querySelector(".marker-symbol--star")).toBeTruthy();
  });

  it("labels a rig with this page's 'Drill rig'", () => {
    const records = [{ holeId: "R", x: 418000, y: 4894000, holeStatus: "INPROGRESS", category: "producer", campaign: "C" }];
    const { container } = renderFeatures(records);

    expect(ariaLabel(container, "rig")).toBe("Drill rig R, C");
  });

  it("labels producers from this page's config", () => {
    const { container } = renderFeatures([
      { holeId: "P", x: 418000, y: 4894000, holePurpose: "PRODUCT", category: "producer", campaign: "C" },
    ]);

    expect(ariaLabel(container, "producer")).toBe("Producer drillhole P, C");
  });
});
