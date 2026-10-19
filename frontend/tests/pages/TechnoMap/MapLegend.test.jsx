import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import MapLegend from "../../../src/pages/TechnoMap/Legends/MapLegend.jsx";
import { MAP_CONFIG } from "../../../src/pages/TechnoMap/config/technoMapConfig.js";

afterEach(cleanup);

const symbolSection = () => screen.getByRole("heading", { name: "Symbol" }).closest("section");
const symbolItems = () => within(symbolSection()).getAllByRole("listitem");

describe("TechnoMap MapLegend", () => {
  it("is labelled for assistive tech", () => {
    render(<MapLegend />);

    expect(screen.getByRole("complementary", { name: "Map legend" })).toBeTruthy();
  });

  it("lists Injector, Producer and Drill Rig, in that order", () => {
    render(<MapLegend />);

    expect(symbolItems().map((item) => item.textContent)).toEqual(["Injector", "Producer", "Drill Rig"]);
  });

  it("does not list the Exploration Map's plain Drillhole", () => {
    render(<MapLegend />);

    expect(within(symbolSection()).queryByText("Drillhole")).toBeNull();
  });

  it("draws each symbol with the same shapes the map uses", () => {
    render(<MapLegend />);
    const [injector, producer, rig] = symbolItems();

    expect(injector.querySelector(".marker-symbol--square.marker-symbol--small")).toBeTruthy();
    expect(producer.querySelector(".marker-symbol--triangle.marker-symbol--small")).toBeTruthy();
    expect(rig.querySelector(".legend-rig-icon").getAttribute("src")).toBe(MAP_CONFIG.rigIconSrc);
    expect(rig.querySelector(".marker-symbol")).toBeNull();
  });

  it("paints the shape swatches in the neutral legend colour", () => {
    const { container } = render(<MapLegend />);

    container.querySelectorAll(".marker-symbol").forEach((symbol) => {
      expect(symbol.style.getPropertyValue("--status-color")).toBe(MAP_CONFIG.legendSymbolColor);
    });
  });

  it("lists every GT band and redox class from this page's config", () => {
    render(<MapLegend />);

    MAP_CONFIG.gtRanges.forEach(({ label }) => expect(screen.getByText(label)).toBeTruthy());
    Object.keys(MAP_CONFIG.redox).forEach((label) => expect(screen.getByText(label)).toBeTruthy());
  });
});
