import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import MapLegend from "../../../src/pages/TechnoMap/Legends/MapLegend.jsx";
import {
  DRILLHOLE_TYPE_CONFIG,
  FILTER_ENTRIES,
  MAP_CONFIG,
} from "../../../src/pages/TechnoMap/config/technoMapConfig.js";
import { setAllFilters } from "../../../src/pages/TechnoMap/utils/mapFilters.js";

afterEach(cleanup);

const symbolSection = () => screen.getByRole("heading", { name: "Symbol" }).closest("section");
const symbolItems = () => within(symbolSection()).getAllByRole("listitem");
const itemFor = (label) => symbolItems().find((item) => item.textContent === label);

describe("TechnoMap MapLegend", () => {
  it("is labelled for assistive tech", () => {
    render(<MapLegend />);

    expect(screen.getByRole("complementary", { name: "Map legend" })).toBeTruthy();
  });

  it("lists all 12 layers in filter order", () => {
    render(<MapLegend />);

    expect(symbolItems().map((item) => item.textContent)).toEqual(FILTER_ENTRIES.map(({ label }) => label));
    expect(symbolItems()).toHaveLength(12);
  });

  it("does not list the Exploration Map's plain Drillhole", () => {
    render(<MapLegend />);

    expect(within(symbolSection()).queryByText("Drillhole")).toBeNull();
  });

  it("draws each type with its configured shape and colour", () => {
    render(<MapLegend />);

    MAP_CONFIG.drillholeTypes.forEach(({ label, shape, color }) => {
      const symbol = itemFor(label).querySelector(".marker-symbol--small");

      expect(symbol.classList.contains(`marker-symbol--${shape}`)).toBe(true);
      expect(symbol.style.getPropertyValue("--status-color")).toBe(color);
    });
    expect(itemFor("Producer").querySelector(".marker-symbol--triangle")).toBeTruthy();
    expect(itemFor("Injector").querySelector(".marker-symbol--square")).toBeTruthy();
    expect(DRILLHOLE_TYPE_CONFIG.producer.shape).toBe("triangle");
  });

  it("uses the rig icon for drilling in progress and swatches for the feature layers", () => {
    render(<MapLegend />);

    expect(itemFor("Drilling in progress").querySelector(".legend-rig-icon").getAttribute("src"))
      .toBe(MAP_CONFIG.rigIconSrc);
    expect(itemFor("Technological cells").querySelector(".layer-swatch-cell")).toBeTruthy();
    expect(itemFor("Deviation line").querySelector(".layer-swatch-line")).toBeTruthy();
  });

  it("keeps hidden layers listed, faded", () => {
    render(<MapLegend filters={{ ...setAllFilters(true), water: false, "deviation-line": false }} />);

    expect(symbolItems()).toHaveLength(12);
    expect(itemFor("Water").className).toBe("is-hidden");
    expect(itemFor("Deviation line").className).toBe("is-hidden");
    expect(itemFor("Producer").className).toBe("");
  });

  it("fades every layer after Hide All, removing none", () => {
    render(<MapLegend filters={setAllFilters(false)} />);

    expect(symbolItems().every((item) => item.className === "is-hidden")).toBe(true);
  });

  it("lists every GT band and redox class from this page's config", () => {
    render(<MapLegend />);

    expect(screen.getByRole("heading", { name: "GT @75 ppm" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Redox Status" })).toBeTruthy();
    MAP_CONFIG.gtRanges.forEach(({ label }) => expect(screen.getByText(label)).toBeTruthy());
    Object.keys(MAP_CONFIG.redox).forEach((label) => expect(screen.getByText(label)).toBeTruthy());
  });
});
