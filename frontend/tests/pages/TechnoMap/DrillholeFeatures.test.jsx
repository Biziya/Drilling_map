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
  it("falls back to an injector for a non-production purpose", () => {
    const { container } = renderFeatures([{ holeId: "A", x: 418000, y: 4894000, holePurpose: "SEDIMENT" }]);

    expect(container.querySelector(".drillhole-marker--injector")).toBeTruthy();
    expect(container.querySelector(".drillhole-marker--drillhole")).toBeNull();
    expect(container.querySelector(".marker-symbol--square")).toBeTruthy();
  });

  it("labels a fallback hole 'Injector drillhole'", () => {
    const { container } = renderFeatures([{ holeId: "A", x: 418000, y: 4894000, campaign: "C" }]);

    expect(ariaLabel(container, "injector")).toBe("Injector drillhole A, C");
  });

  it("labels a rig with this page's 'Drill rig'", () => {
    const records = [{ holeId: "R", x: 418000, y: 4894000, holeStatus: "INPROGRESS", campaign: "C" }];
    const { container } = renderFeatures(records);

    expect(ariaLabel(container, "rig")).toBe("Drill rig R, C");
  });

  it("labels producers from this page's config", () => {
    const { container } = renderFeatures([
      { holeId: "P", x: 418000, y: 4894000, holePurpose: "PRODUCT", campaign: "C" },
    ]);

    expect(ariaLabel(container, "producer")).toBe("Producer drillhole P, C");
  });
});
