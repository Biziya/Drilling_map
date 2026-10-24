// The Techno Map's one tooltip: placement and naming (MarkerTooltip) and the
// pyISR_AllData_V2 details it shows (DrillholeTooltip).
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import MarkerTooltip from "../../../src/pages/TechnoMap/Tooltips/MarkerTooltip.jsx";
import DrillholeTooltip from "../../../src/pages/TechnoMap/Tooltips/DrillholeTooltip.jsx";
import { MAP_CONFIG, MAP_UTM_BOUNDS as B } from "../../../src/pages/TechnoMap/config/technoMapConfig.js";
import { convertUtmToMapPosition } from "../../../src/pages/TechnoMap/utils/coordinates.js";
import { buildMarkerFeatures } from "../../../src/pages/TechnoMap/utils/markerLayer.js";

afterEach(cleanup);

const VIEWPORT = { width: 1000, height: 700 };
// The whole map filling the viewport at zoom 1.
const TRANSFORM = { x: 0, y: 0, width: 1000, height: 700 };
const featureOf = (record) => buildMarkerFeatures([convertUtmToMapPosition(record)])[0];
const renderTooltip = (record, props = {}) => render(
  <MarkerTooltip feature={featureOf(record)} transform={TRANSFORM} viewport={VIEWPORT} isPinned={false} {...props} />,
).container.querySelector(".marker-tooltip");

// A map ratio's UTM position, so a hole can be put anywhere on the viewport.
const at = (rx, ry) => ({ x: B.minX + rx * (B.maxX - B.minX), y: B.maxY - ry * (B.maxY - B.minY) });

describe("MarkerTooltip", () => {
  it("names the hole and its role from technoMap.yaml", () => {
    expect(renderTooltip({ holeId: "P-1", category: "producer", ...at(0.5, 0.5) }).getAttribute("aria-label"))
      .toBe(`${MAP_CONFIG.markerLabels.producer} P-1`);
    cleanup();
    expect(renderTooltip({ holeId: "R-1", category: "producer", holeStatus: "INPROGRESS", ...at(0.5, 0.5) }).getAttribute("aria-label"))
      .toBe("Drill rig R-1");
  });

  it("sits on its marker, in viewport px from the same transform as the canvas", () => {
    const tooltip = renderTooltip({ holeId: "P-1", category: "producer", ...at(0.25, 0.75) });

    expect(parseFloat(tooltip.style.left)).toBeCloseTo(250);
    expect(parseFloat(tooltip.style.top)).toBeCloseTo(525);
    expect(tooltip.style.getPropertyValue("--marker-half")).toBe(`${MAP_CONFIG.markers.size / 2}px`);
  });

  it("opens below a marker in the upper part of the map and above one in the lower part", () => {
    expect(renderTooltip({ holeId: "A", category: "producer", ...at(0.5, 0.1) }).className).toContain("is-below");
    cleanup();
    expect(renderTooltip({ holeId: "B", category: "producer", ...at(0.5, 0.9) }).className).not.toContain("is-below");
  });

  it("turns inwards near the left and right edges", () => {
    expect(renderTooltip({ holeId: "A", category: "producer", ...at(0.02, 0.5) }).className).toContain("is-start");
    cleanup();
    expect(renderTooltip({ holeId: "B", category: "producer", ...at(0.98, 0.5) }).className).toContain("is-end");
  });

  it("marks a tooltip opened by a click", () => {
    expect(renderTooltip({ holeId: "A", category: "producer", ...at(0.5, 0.5) }, { isPinned: true }).className).toContain("is-pinned");
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
  const tooltipText = (drillhole) => render(<DrillholeTooltip drillhole={drillhole} />)
    .container.querySelector(".drillhole-tooltip").textContent;

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
