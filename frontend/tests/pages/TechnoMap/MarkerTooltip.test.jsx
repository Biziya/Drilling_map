// The Techno Map's one tooltip: placement and naming (MarkerTooltip) and the
// pyISR_AllData_V2 details it shows (DrillholeTooltip).
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import MarkerTooltip from "../../../src/pages/TechnoMap/Tooltips/MarkerTooltip.jsx";
import DrillholeTooltip from "../../../src/pages/TechnoMap/Tooltips/DrillholeTooltip.jsx";
import { TOOLTIP_FIELDS } from "../../../src/pages/TechnoMap/utils/tooltipFields.js";
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
  billingDate: "2026-03-31",
  generalComment: "Re-logged",
  raGradeSampling: true,
  sedimentSampling: false,
  azimuth: 307.67,
  finalDeviation: 1.33,
};

describe("TechnoMap tooltip contents", () => {
  // [label, value] for every row, in order.
  const rows = (drillhole) => [...render(<DrillholeTooltip drillhole={drillhole} />).container.querySelectorAll("dt")]
    .map((dt) => [dt.textContent, dt.nextElementSibling.textContent]);

  const ORDER = [
    "Key", "Type", "License", "Stratigraphic Unit", "X (m)", "Y (m)", "Z (m)",
    "Z (well head-topo) (m)", "Screen min depth (m)", "Screen max depth (m)", "Screen length (m)",
    "Screen top altitude (m)", "Status", "Drilling Company", "Drilling Rig", "Start Date", "End Date",
    "Billing Time", "Relative level", "Mining level", "Associated Production cells", "Development Flowrates (m³/h)",
  ];

  it("titles the popup with the record ID, not the Key or category, and keeps ID out of the rows", () => {
    const title = (drillhole) => render(<DrillholeTooltip drillhole={drillhole} />).container.querySelector("strong").textContent;

    expect(title(API_HOLE)).toBe("1042");
    cleanup();
    expect(title({ Id: 7, holeId: "P-1" })).toBe("7");
    cleanup();
    expect(title({ holeId: "P-1", category: "producer" })).toBe("ID unavailable");
    cleanup();
    expect(rows(API_HOLE).map(([label]) => label)).not.toContain("ID");
  });

  it("shows every other requested field once, in the agreed order", () => {
    expect(rows(API_HOLE).map(([label]) => label)).toEqual(ORDER);
    expect(TOOLTIP_FIELDS.map(({ label }) => label)).toEqual(ORDER);
    expect(ORDER.filter((label) => label === "Screen max depth (m)")).toHaveLength(1);
  });

  it("shows the pyISR_AllData_V2 values as the API sends them", () => {
    expect(Object.fromEntries(rows(API_HOLE))).toMatchObject({
      Key: "ZO-EX-118",
      Type: "EXPLO",
      License: "MV-017129",
      "Stratigraphic Unit": "Sainshand",
      "X (m)": "421,099.50",
      "Y (m)": "4,893,548.00",
      "Z (well head-topo) (m)": "709.74",
      "Screen min depth (m)": "310.00",
      "Screen max depth (m)": "342.50",
      "Screen length (m)": "32.50",
      "Screen top altitude (m)": "399.74",
      Status: "COMPLETED",
      "Drilling Company": "Drillco",
      "Drilling Rig": "RIG-07",
      "Start Date": "2026-03-02",
      "End Date": "2026-03-09",
      "Billing Time": "2026-03-31",
      "Relative level": "12.5",
    });
  });

  it("shows the future fields, and Z (m), as dashes with no invented value", () => {
    const shown = Object.fromEntries(rows({ ...API_HOLE, z: 709.74, relativeLevel: "12.5" }));

    ["Z (m)", "Mining level", "Associated Production cells", "Development Flowrates (m³/h)"]
      .forEach((label) => expect(shown[label]).toBe("—"));
    // Z (m) is not the well-head level, nor the relative level.
    expect(shown["Z (well head-topo) (m)"]).toBe("709.74");
    expect(shown["Relative level"]).toBe("12.5");
  });

  it("formats dates as YYYY-MM-DD, keeping a Billing Time only when one is sent", () => {
    const shown = Object.fromEntries(rows({
      ...API_HOLE, startDate: "2026-03-02T00:00:00", endDate: "2026-03-09T17:45:00", billingDate: "2026-03-31T14:30:00",
    }));

    expect(shown["Start Date"]).toBe("2026-03-02");
    expect(shown["End Date"]).toBe("2026-03-09");
    expect(shown["Billing Time"]).toBe("2026-03-31 14:30");
    cleanup();
    expect(Object.fromEntries(rows({ ...API_HOLE, billingDate: "2026-03-31" }))["Billing Time"]).toBe("2026-03-31");
  });

  it("reads PascalCase fields the same way", () => {
    const shown = Object.fromEntries(rows({ Id: 7, HoleId: "P-1", HolePurpose: "PRODUCT", HoleStatus: "INPROGRESS", DrillingRig: "RIG-02", X: "418000" }));

    expect(shown).toMatchObject({ Key: "P-1", Type: "PRODUCT", Status: "INPROGRESS", "Drilling Rig": "RIG-02", "X (m)": "418,000.00" });
  });

  it("never prints null, undefined or NaN: a missing or unreadable value is a dash", () => {
    const { container } = render(<DrillholeTooltip drillhole={{ holeId: "Z-1", holePurpose: "SER", holeStatus: null, x: 421000, z: null, screenMinDepth: "abc", license: "  ", billingDate: null }} />);
    const shown = Object.fromEntries([...container.querySelectorAll("dt")].map((dt) => [dt.textContent, dt.nextElementSibling.textContent]));

    expect(container.textContent).not.toMatch(/null|undefined|NaN/);
    expect(Object.keys(shown)).toHaveLength(22);
    expect(shown).toMatchObject({ Type: "SER", Status: "—", "Z (well head-topo) (m)": "—", "Screen min depth (m)": "—", License: "—", "Billing Time": "—" });
  });

  it("lets long values wrap rather than widen the tooltip", () => {
    const shown = rows({ ...API_HOLE, drillingCompany: "A very long drilling company name that runs on and on" });

    expect(shown.find(([label]) => label === "Drilling Company")[1]).toBe("A very long drilling company name that runs on and on");
  });
});

describe("MarkerTooltip room", () => {
  it("caps the tooltip at the room on its side of the marker, so it stays inside the map", () => {
    const below = renderTooltip({ holeId: "A", category: "producer", ...at(0.5, 0.1) });
    // 70 px from the top: the tooltip opens below, with 630 px less the marker and clearance.
    expect(parseFloat(below.style.getPropertyValue("--tooltip-max-height"))).toBeLessThan(630);
    expect(parseFloat(below.style.getPropertyValue("--tooltip-max-height"))).toBeGreaterThan(550);
    cleanup();
    const nearBottom = renderTooltip({ holeId: "B", category: "producer", ...at(0.5, 0.95) });
    expect(nearBottom.className).not.toContain("is-below");
    expect(parseFloat(nearBottom.style.getPropertyValue("--tooltip-max-height"))).toBeLessThan(665);
  });
});
