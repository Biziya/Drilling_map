// Exploration Map marker behaviour that differs from the Techno Map. The
// behaviour both pages share is in tests/pages/DrillholeMarker.test.jsx.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import DrillholeMarker from "../../../src/pages/DrillMap/Map/DrillholeMarker.jsx";
import { MAP_CONFIG } from "../../../src/pages/DrillMap/config/drillMapConfig.js";

afterEach(cleanup);

const HOLE = { holeId: "IZO_456_062_47_B_", campaign: "ZOOVCH OVOO - 2026", gt: 0.3198 };

// Role labels come from this page's drillMap.yaml, as DrillholeFeatures passes them.
const renderMarker = (kind) => render(
  <DrillholeMarker drillhole={HOLE} kind={kind} roleLabel={MAP_CONFIG.markerLabels[kind]} />,
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
