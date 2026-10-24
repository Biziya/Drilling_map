// Legend dimensions come from each page's own YAML `legend` block. The Techno
// Map legend is one headless list of map categories (no GT, Redox or Symbol
// sections); the Exploration Map's keeps all three.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import TechnoLegend from "../../src/pages/TechnoMap/Legends/MapLegend.jsx";
import DrillLegend from "../../src/pages/DrillMap/Legends/MapLegend.jsx";
import * as technoConfig from "../../src/pages/TechnoMap/config/technoMapConfig.js";
import * as drillConfig from "../../src/pages/DrillMap/config/drillMapConfig.js";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.doUnmock("../../src/pages/TechnoMap/config/technoMap.yaml");
  vi.doUnmock("../../src/pages/DrillMap/config/drillMap.yaml");
});

const PAGES = [
  ["TechnoMap", TechnoLegend, technoConfig, "../../src/pages/TechnoMap/config/technoMap.yaml", "../../src/pages/TechnoMap/config/technoMapConfig.js", []],
  ["DrillMap", DrillLegend, drillConfig, "../../src/pages/DrillMap/config/drillMap.yaml", "../../src/pages/DrillMap/config/drillMapConfig.js", ["GT @75 ppm", "Redox Status", "Symbol"]],
];

describe.each(PAGES)("%s legend sizes", (_page, MapLegend, { MAP_CONFIG }, yamlPath, configPath, headings) => {
  const hasGt = headings.includes("GT @75 ppm");
  const hasRedox = headings.includes("Redox Status");
  const variable = (name) => screen.getByRole("complementary", { name: "Map legend" }).style.getPropertyValue(name);

  it("applies its YAML legend sizes as CSS variables", () => {
    const { legend } = MAP_CONFIG;
    render(<MapLegend />);

    expect(variable("--legend-symbol-size")).toBe(`${legend.symbolSize}px`);
    expect(variable("--legend-rig-scale")).toBe(String(legend.symbols.rigIconScale));
    expect(variable("--legend-label-size")).toBe(`${legend.labelFontSize}px`);
    if (headings.length) expect(variable("--legend-title-size")).toBe(`${legend.titleFontSize}px`);
    if (hasGt) expect(variable("--legend-gt-row-gap")).toBe(`${legend.gt.rowGap}px`);
    if (hasRedox) expect(variable("--legend-redox-row-gap")).toBe(`${legend.redox.rowGap}px`);
    expect(variable("--legend-padding-inline")).toBe(`${legend.paddingInline}px`);
  });

  // GT circles (where shown) and Redox squares sit in the same symbol box as
  // the type symbols, so every section's labels line up.
  it("centres every GT, Redox and type symbol in the same box", () => {
    const { container } = render(<MapLegend />);
    const rows = [...container.querySelectorAll(".map-legend li")];

    expect(rows.length).toBeGreaterThan(9);
    rows.forEach((row) => expect(row.firstElementChild.className).toBe("legend-symbol"));
    expect(container.querySelectorAll(".map-legend__gt .legend-symbol > .legend-dot")).toHaveLength(hasGt ? MAP_CONFIG.gtRanges.length : 0);
    expect(container.querySelectorAll(".map-legend__redox .legend-symbol > .legend-swatch")).toHaveLength(hasRedox ? 3 : 0);
  });

  it("keeps its section headings in order", () => {
    render(<MapLegend />);

    expect(screen.queryAllByRole("heading").map((heading) => heading.textContent)).toEqual(headings);
  });

  it("follows a changed YAML value", async () => {
    const actual = (await vi.importActual(yamlPath)).default;
    vi.doMock(yamlPath, () => ({
      default: { ...actual, legend: { ...actual.legend, symbolSize: 22 } },
    }));
    const { MAP_CONFIG: reloaded } = await import(configPath);

    expect(reloaded.legend.symbolSize).toBe(22);
  });

  it("rejects a negative size, naming the setting", async () => {
    const actual = (await vi.importActual(yamlPath)).default;
    vi.doMock(yamlPath, () => ({
      default: { ...actual, legend: { ...actual.legend, symbolSize: -4 } },
    }));

    await expect(import(configPath)).rejects.toThrow(/legend\.symbolSize: expected 0 or more/);
  });

  it.runIf(hasGt)("lays the GT bands out in gt.columns columns", () => {
    render(<MapLegend />);

    expect(variable("--legend-gt-rows")).toBe(String(Math.ceil(MAP_CONFIG.gtRanges.length / MAP_CONFIG.legend.gt.columns)));
    expect(variable("--legend-gt-column-gap")).toBe(`${MAP_CONFIG.legend.gt.columnGap}px`);
  });

  it.runIf(hasGt).each([0, 1.5, -2])("rejects %s GT columns", async (columns) => {
    const actual = (await vi.importActual(yamlPath)).default;
    vi.doMock(yamlPath, () => ({
      default: { ...actual, legend: { ...actual.legend, gt: { ...actual.legend.gt, columns } } },
    }));

    await expect(import(configPath)).rejects.toThrow(/legend\.gt\.columns: expected a whole number of 1 or more/);
  });

  it("rejects a missing size", async () => {
    const actual = (await vi.importActual(yamlPath)).default;
    const legend = { ...actual.legend };
    delete legend.labelGap;
    vi.doMock(yamlPath, () => ({ default: { ...actual, legend } }));

    await expect(import(configPath)).rejects.toThrow(/legend\.labelGap/);
  });
});

describe("TechnoMap legend symbols", () => {
  it("puts all 11 symbols in the same symbol box", () => {
    const { container } = render(<TechnoLegend />);
    const boxes = container.querySelectorAll(".map-legend li > .legend-symbol");

    expect(boxes).toHaveLength(11);
    expect(container.querySelectorAll(".map-legend .marker-symbol--small")).toHaveLength(9);
    expect(container.querySelector(".map-legend .legend-rig-icon")).toBeTruthy();
  });
});
