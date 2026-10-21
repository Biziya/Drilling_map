// Legend dimensions come from each page's own YAML `legend` block.
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
  ["TechnoMap", TechnoLegend, technoConfig, "../../src/pages/TechnoMap/config/technoMap.yaml", "../../src/pages/TechnoMap/config/technoMapConfig.js"],
  ["DrillMap", DrillLegend, drillConfig, "../../src/pages/DrillMap/config/drillMap.yaml", "../../src/pages/DrillMap/config/drillMapConfig.js"],
];

describe.each(PAGES)("%s legend sizes", (_page, MapLegend, { MAP_CONFIG }, yamlPath, configPath) => {
  const variable = (name) => screen.getByRole("complementary", { name: "Map legend" }).style.getPropertyValue(name);

  it("applies its YAML legend sizes as CSS variables", () => {
    const { legend } = MAP_CONFIG;
    render(<MapLegend />);

    expect(variable("--legend-symbol-size")).toBe(`${legend.symbolSize}px`);
    expect(variable("--legend-rig-scale")).toBe(String(legend.symbols.rigIconScale));
    expect(variable("--legend-label-size")).toBe(`${legend.labelFontSize}px`);
    expect(variable("--legend-title-size")).toBe(`${legend.titleFontSize}px`);
    expect(variable("--legend-gt-row-gap")).toBe(`${legend.gt.rowGap}px`);
    expect(variable("--legend-redox-row-gap")).toBe(`${legend.redox.rowGap}px`);
    expect(variable("--legend-padding-inline")).toBe(`${legend.paddingInline}px`);
  });

  // GT circles and Redox squares sit in the same symbol box as the type
  // symbols, so every section's labels line up.
  it("centres every GT, Redox and type symbol in the same box", () => {
    const { container } = render(<MapLegend />);
    const rows = [...container.querySelectorAll(".map-legend li")];

    expect(rows.length).toBeGreaterThan(9);
    rows.forEach((row) => expect(row.firstElementChild.className).toBe("legend-symbol"));
    expect(container.querySelectorAll(".map-legend__gt .legend-symbol > .legend-dot")).toHaveLength(MAP_CONFIG.gtRanges.length);
    expect(container.querySelectorAll(".map-legend__redox .legend-symbol > .legend-swatch")).toHaveLength(3);
  });

  it("keeps the three sections in order", () => {
    render(<MapLegend />);

    expect(screen.getAllByRole("heading").map((heading) => heading.textContent))
      .toEqual(["GT @75 ppm", "Redox Status", "Symbol"]);
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

  it("rejects a missing size", async () => {
    const actual = (await vi.importActual(yamlPath)).default;
    const legend = { ...actual.legend };
    delete legend.labelGap;
    vi.doMock(yamlPath, () => ({ default: { ...actual, legend } }));

    await expect(import(configPath)).rejects.toThrow(/legend\.labelGap/);
  });
});

describe("TechnoMap legend symbols", () => {
  it("puts all 12 symbols in the same symbol box", () => {
    const { container } = render(<TechnoLegend />);
    const boxes = container.querySelectorAll(".map-legend__symbols li > .legend-symbol");

    expect(boxes).toHaveLength(12);
    expect(container.querySelectorAll(".map-legend__symbols .marker-symbol--small")).toHaveLength(9);
    expect(container.querySelector(".map-legend__symbols .legend-rig-icon")).toBeTruthy();
  });
});
