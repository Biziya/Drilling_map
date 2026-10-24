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

// A record as /api/techno-map sends it (pyISR_AllData_V2).
const API_HOLE = {
  id: "1042",
  holeId: "ZO-EX-118",
  holePurpose: "EXPLO",
  category: "ra-grade-sampling",
  holeStatus: "COMPLETED",
  x: 421099.5,
  y: 4893548,
  z: 709.74,
  relativeLevel: "12.5",
  license: "MV-017129",
  stratigraphicUnit: "Sainshand",
  screenMinDepth: 310,
  screenMaxDepth: 342.5,
  screenLength: 32.5,
  screenTopAltitude: 399.74,
  screenBottomAltitude: 367.24,
  drillingCompany: "Drillco",
  drillingRig: "RIG-07",
  startDate: "2026-03-02",
  endDate: "2026-03-09",
  billingDate: null,
  generalComment: "Re-logged",
  raGradeSampling: true,
  sedimentSampling: false,
  azimuth: 307.67,
  finalDeviation: 1.33,
};

describe("TechnoMap tooltip contents", () => {
  const tooltipText = (drillhole) => render(
    <DrillholeMarker drillhole={drillhole} kind="ra-grade-sampling" roleLabel={MAP_CONFIG.markerLabels["ra-grade-sampling"]} />,
  ).container.querySelector(".drillhole-tooltip").textContent;

  it("shows the original SQL Type next to the filter category it resolved to", () => {
    const text = tooltipText(API_HOLE);

    expect(text).toContain("Type: EXPLO");
    expect(text).toContain("Category: Ra-grade-sampling");
    expect(text).toContain("Status: COMPLETED");
  });

  it("shows the pyISR_AllData_V2 details", () => {
    const text = tooltipText(API_HOLE);

    for (const expected of [
      "ZO-EX-118",
      "X: 421,099.5",
      "Y: 4,893,548",
      "Z: 709.74 m",
      "Relative Level: 12.5",
      "License: MV-017129",
      "Stratigraphic Unit: Sainshand",
      "Screen Depth: 310 m – 342.5 m",
      "Screen Length: 32.5 m",
      "Screen Altitude: 399.74 m – 367.24 m",
      "Drilling Company: Drillco",
      "Drilling Rig: RIG-07",
      "Start Date: 2026-03-02",
      "End Date: 2026-03-09",
      "Ra-grade Sampling: Yes",
      "Sediment Sampling: No",
      "Azimuth: 307.67",
      "Final Deviation: 1.33 m",
      "Comment: Re-logged",
    ]) expect(text).toContain(expected);
  });

  it("reads PascalCase fields the same way", () => {
    const text = tooltipText({ HoleId: "P-1", HolePurpose: "PRODUCT", HoleStatus: "INPROGRESS", Category: "producer", DrillingRig: "RIG-02" });

    expect(text).toContain("Type: PRODUCT");
    expect(text).toContain("Status: INPROGRESS");
    expect(text).toContain("Category: Producer");
    expect(text).toContain("Drilling Rig: RIG-02");
  });

  it("never prints null, undefined or NaN, and leaves out rows the API did not send", () => {
    const text = tooltipText({ holeId: "Z-1", holePurpose: "SER", category: null, holeStatus: null, x: 421000, y: 4893000, z: null, billingDate: null, raGradeSampling: null, screenMinDepth: "abc" });

    expect(text).not.toMatch(/null|undefined|NaN/);
    expect(text).toContain("Type: SER");
    expect(text).toContain("Status: —");
    expect(text).toContain("Z: —");
    for (const absent of ["Category", "Billing Date", "Ra-grade Sampling", "Screen Depth", "Azimuth", "GT"]) {
      expect(text).not.toContain(absent);
    }
  });
});
