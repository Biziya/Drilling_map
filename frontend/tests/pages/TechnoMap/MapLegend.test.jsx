import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import MapLegend from "../../../src/pages/TechnoMap/Legends/MapLegend.jsx";
import { MAP_CONFIG } from "../../../src/pages/TechnoMap/config/technoMapConfig.js";
import { setAllFilters } from "../../../src/pages/TechnoMap/utils/mapFilters.js";

afterEach(cleanup);

const legend = () => screen.getByRole("complementary", { name: "Map legend" });
const items = () => within(legend()).getAllByRole("listitem");
const itemFor = (label) => items().find((item) => item.textContent === label);

const ORDER = [
  "Development", "Exploration", "Geotechnical", "Injector", "Monitoring", "Producer",
  "Ra-grade-sampling", "Sediment-sampling", "Water", "Drilling in progress", "Deviation line",
];

describe("TechnoMap MapLegend", () => {
  it("is labelled for assistive tech", () => {
    render(<MapLegend />);

    expect(legend()).toBeTruthy();
  });

  it("lists the 11 map categories, one per row, in the agreed order", () => {
    render(<MapLegend />);

    expect(within(legend()).getAllByRole("list")).toHaveLength(1);
    expect(items().map((item) => item.textContent)).toEqual(ORDER);
  });

  it("puts each symbol before its label, all in the same symbol box", () => {
    render(<MapLegend />);

    items().forEach((item) => {
      expect(item.firstElementChild.className).toBe("legend-symbol");
      expect(item.lastElementChild.tagName).toBe("SPAN");
    });
  });

  it("leaves Technological cells to the Legends panel", () => {
    render(<MapLegend />);

    expect(itemFor("Technological cells")).toBeUndefined();
    expect(legend().querySelector(".layer-swatch-cell")).toBeNull();
  });

  it("has no Redox Status, GT or Symbol section", () => {
    const { container } = render(<MapLegend />);

    expect(screen.queryAllByRole("heading")).toHaveLength(0);
    expect(screen.queryByText(/Redox/)).toBeNull();
    Object.keys(MAP_CONFIG.redox).forEach((label) => expect(screen.queryByText(label)).toBeNull());
    expect(screen.queryByText(/GT @75/i)).toBeNull();
    expect(container.querySelector(".legend-swatch, .legend-dot, section")).toBeNull();
  });

  it("draws each type with its configured shape and colour", () => {
    render(<MapLegend />);

    MAP_CONFIG.drillholeTypes.forEach(({ label, shape, color }) => {
      const symbol = itemFor(label).querySelector(".marker-symbol--small");

      expect(symbol.classList.contains(`marker-symbol--${shape}`)).toBe(true);
      expect(symbol.style.getPropertyValue("--status-color")).toBe(color);
    });
  });

  it("uses the rig icon for drilling in progress and the line swatch for deviation", () => {
    render(<MapLegend />);

    expect(itemFor("Drilling in progress").querySelector(".legend-rig-icon").getAttribute("src"))
      .toBe(MAP_CONFIG.rigIconSrc);
    expect(itemFor("Deviation line").querySelector(".layer-swatch-line")).toBeTruthy();
  });

  it("keeps hidden categories listed, faded, and is not itself a control", () => {
    render(<MapLegend filters={{ ...setAllFilters(true), water: false, "deviation-line": false }} />);

    expect(items()).toHaveLength(11);
    expect(itemFor("Water").className).toBe("is-hidden");
    expect(itemFor("Deviation line").className).toBe("is-hidden");
    expect(itemFor("Producer").className).toBe("");
    expect(within(legend()).queryAllByRole("checkbox")).toHaveLength(0);
    expect(within(legend()).queryAllByRole("button")).toHaveLength(0);
  });

  it("fades every category after Hide All, removing none", () => {
    render(<MapLegend filters={setAllFilters(false)} />);

    expect(items()).toHaveLength(11);
    expect(items().every((item) => item.className === "is-hidden")).toBe(true);
  });
});
