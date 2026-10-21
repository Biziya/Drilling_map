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

    expect(variable("--legend-symbol-box-width")).toBe(`${legend.symbols.boxWidth}px`);
    expect(variable("--legend-symbol-box-height")).toBe(`${legend.symbols.boxHeight}px`);
    expect(variable("--legend-symbol-size")).toBe(`${legend.symbols.size}px`);
    expect(variable("--legend-rig-size")).toBe(`${legend.symbols.rigIconSize}px`);
    expect(variable("--legend-label-size")).toBe(`${legend.labelFontSize}px`);
    expect(variable("--legend-title-size")).toBe(`${legend.titleFontSize}px`);
    expect(variable("--legend-gt-width")).toBe(`${legend.gt.width}px`);
    expect(variable("--legend-redox-height")).toBe(`${legend.redox.height}px`);
    expect(variable("--legend-padding-inline")).toBe(`${legend.paddingInline}px`);
  });

  it("keeps the three sections in order", () => {
    render(<MapLegend />);

    expect(screen.getAllByRole("heading").map((heading) => heading.textContent))
      .toEqual(["GT @75 ppm", "Redox Status", "Symbol"]);
  });

  it("follows a changed YAML value", async () => {
    const actual = (await vi.importActual(yamlPath)).default;
    vi.doMock(yamlPath, () => ({
      default: { ...actual, legend: { ...actual.legend, symbols: { ...actual.legend.symbols, size: 22 } } },
    }));
    const { MAP_CONFIG: reloaded } = await import(configPath);

    expect(reloaded.legend.symbols.size).toBe(22);
  });

  it("rejects a negative size, naming the setting", async () => {
    const actual = (await vi.importActual(yamlPath)).default;
    vi.doMock(yamlPath, () => ({
      default: { ...actual, legend: { ...actual.legend, gt: { ...actual.legend.gt, width: -4 } } },
    }));

    await expect(import(configPath)).rejects.toThrow(/legend\.gt\.width: expected 0 or more/);
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
