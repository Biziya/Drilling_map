// Techno Map marker behaviour that differs from the Exploration Map. The
// behaviour both pages share is in tests/pages/DrillholeMarker.test.jsx.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import DrillholeMarker from "../../../src/pages/TechnoMap/Map/DrillholeMarker.jsx";
import { MAP_CONFIG } from "../../../src/pages/TechnoMap/config/technoMapConfig.js";

afterEach(cleanup);

const HOLE = { holeId: "IZO_456_062_47_B_", campaign: "ZOOVCH OVOO - 2026", gt: 0.3198 };

// Role labels come from this page's technoMap.yaml, as DrillholeFeatures passes them.
const renderMarker = (kind) => render(
  <DrillholeMarker drillhole={HOLE} kind={kind} roleLabel={MAP_CONFIG.markerLabels[kind]} />,
);

const ariaLabel = () => screen.getByRole("button").getAttribute("aria-label");

describe("TechnoMap DrillholeMarker", () => {
  it("names a rig 'Drill rig'", () => {
    renderMarker("rig");

    expect(ariaLabel()).toBe("Drill rig IZO_456_062_47_B_, ZOOVCH OVOO - 2026");
  });

  it("names a producer 'Producer drillhole'", () => {
    renderMarker("producer");

    expect(ariaLabel()).toBe("Producer drillhole IZO_456_062_47_B_, ZOOVCH OVOO - 2026");
  });

  it("names an injector 'Injector drillhole'", () => {
    renderMarker("injector");

    expect(ariaLabel()).toBe("Injector drillhole IZO_456_062_47_B_, ZOOVCH OVOO - 2026");
  });

  it("has no label for the Exploration-only 'drillhole' kind", () => {
    expect(MAP_CONFIG.markerLabels).not.toHaveProperty("drillhole");
  });
});
