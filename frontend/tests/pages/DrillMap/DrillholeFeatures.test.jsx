// Exploration Map marker kinds and labels. The behaviour both pages share
// (deviation lines, dedupe) is in tests/pages/DrillholeFeatures.test.jsx.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import DrillholeFeatures from "../../../src/pages/DrillMap/Map/DrillholeFeatures.jsx";
import { convertUtmToMapPosition } from "../../../src/pages/DrillMap/utils/coordinates.js";

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

describe("DrillMap DrillholeFeatures markers", () => {
  it("falls back to a plain drillhole for a non-production purpose", () => {
    const { container } = renderFeatures([{ holeId: "A", x: 418000, y: 4894000, holePurpose: "SEDIMENT" }]);

    expect(container.querySelector(".drillhole-marker--drillhole")).toBeTruthy();
    expect(container.querySelector(".drillhole-marker--injector")).toBeNull();
    expect(container.querySelector(".marker-symbol--square")).toBeTruthy();
  });

  it("labels a plain drillhole 'Drillhole'", () => {
    const { container } = renderFeatures([{ holeId: "A", x: 418000, y: 4894000, campaign: "C" }]);

    expect(ariaLabel(container, "drillhole")).toBe("Drillhole A, C");
  });

  it("labels a rig with this page's 'Rig'", () => {
    const records = [{ holeId: "R", x: 418000, y: 4894000, holeStatus: "INPROGRESS", campaign: "C" }];
    const { container } = renderFeatures(records);

    expect(ariaLabel(container, "rig")).toBe("Rig R, C");
  });

  it("labels producers and injectors from this page's config", () => {
    const { container } = renderFeatures([
      { holeId: "P", x: 418000, y: 4894000, holePurpose: "PRODUCT", campaign: "C" },
      { holeId: "I", x: 418500, y: 4894500, holePurpose: "INJECT", campaign: "C" },
    ]);

    expect(ariaLabel(container, "producer")).toBe("Producer drillhole P, C");
    expect(ariaLabel(container, "injector")).toBe("Injector drillhole I, C");
  });
});
