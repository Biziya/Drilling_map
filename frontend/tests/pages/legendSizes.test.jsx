// Both maps draw their legend with the shared card (components/MapLegend):
// one look, sized by the --map-symbol-* / --map-legend-* tokens in index.css,
// differing only in content. The Techno Map legend is one untitled list; the
// Exploration Map's keeps its four titled sections.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import TechnoLegend from "../../src/pages/TechnoMap/Legends/MapLegend.jsx";
import DrillLegend from "../../src/pages/DrillMap/Legends/MapLegend.jsx";
import * as technoConfig from "../../src/pages/TechnoMap/config/technoMapConfig.js";
import * as drillConfig from "../../src/pages/DrillMap/config/drillMapConfig.js";

afterEach(cleanup);

const SRC = resolve(import.meta.dirname, "../../src");
const read = (path) => readFileSync(resolve(SRC, path), "utf8");

const PAGES = [
  ["TechnoMap", TechnoLegend, technoConfig, []],
  ["DrillMap", DrillLegend, drillConfig, ["GT @75 ppm", "Redox Status", "Drillhole Types", "Overlays"]],
];

describe.each(PAGES)("%s legend", (_page, MapLegend, { MAP_CONFIG }, headings) => {
  it("is the shared card, with no sizes of its own", () => {
    render(<MapLegend />);
    const card = screen.getByRole("complementary", { name: "Map legend" });

    expect(card.className).toBe("map-legend");
    expect(card.getAttribute("style")).toBeNull();
    expect(MAP_CONFIG).not.toHaveProperty("legend");
  });

  it("centres every symbol in the shared symbol box", () => {
    const { container } = render(<MapLegend />);
    const rows = [...container.querySelectorAll(".map-legend li")];

    expect(rows.length).toBeGreaterThan(9);
    rows.forEach((row) => expect(row.firstElementChild.className).toBe("legend-symbol"));
    expect(container.querySelectorAll(".legend-symbol .legend-symbol")).toHaveLength(0);
  });

  it("keeps its section headings in order", () => {
    render(<MapLegend />);

    expect(screen.queryAllByRole("heading").map((heading) => heading.textContent)).toEqual(headings);
  });

  it("scales the rig image into the symbol box", () => {
    const { container } = render(<MapLegend />);

    expect(container.querySelector(".legend-rig-icon").classList.contains("legend-image")).toBe(true);
  });
});

describe("shared legend styles", () => {
  it("defines the symbol size once, in index.css", () => {
    expect(read("index.css")).toMatch(/--map-symbol-size:\s*13px/);
    expect(read("pages/DrillMap/DrillMap.css")).not.toMatch(/--map-symbol-size:|\.map-legend|\.legend-symbol/);
    expect(read("pages/TechnoMap/TechnoMap.css")).not.toMatch(/--map-symbol-size:|\.map-legend|\.legend-symbol/);
  });

  it("sizes every legend and Layers-panel icon from the shared token", () => {
    const css = read("components/MapLegend/mapLegend.css");

    [".legend-image", ".legend-dot", ".layer-swatch-hexagon"].forEach((selector) => expect(css).toContain(selector));
    expect(css.match(/width: var\(--map-symbol-size\)/g).length).toBeGreaterThanOrEqual(3);
    expect(read("pages/DrillMap/DrillMap.css")).toMatch(/marker-symbol--small \{[^}]*width: var\(--map-symbol-size\)/);
    expect(read("pages/TechnoMap/TechnoMap.css")).toMatch(/marker-symbol--small \{[^}]*width: var\(--map-symbol-size\)/);
  });
});

describe("TechnoMap legend symbols", () => {
  it("puts all 12 symbols, Hexagons included after an upload, in the same symbol box", () => {
    const { container } = render(<TechnoLegend hasHexagons />);
    const boxes = container.querySelectorAll(".map-legend li > .legend-symbol");

    expect(boxes).toHaveLength(12);
    expect(container.querySelectorAll(".map-legend .marker-symbol--small")).toHaveLength(9);
    expect(container.querySelector(".map-legend .legend-rig-icon")).toBeTruthy();
  });
});
