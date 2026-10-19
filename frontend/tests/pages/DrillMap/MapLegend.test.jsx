import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import MapLegend from "../../../src/pages/DrillMap/Legends/MapLegend.jsx";
import { MAP_CONFIG } from "../../../src/pages/DrillMap/config/drillMapConfig.js";

afterEach(cleanup);

const symbolSection = () => screen.getByRole("heading", { name: "Symbol" }).closest("section");
const symbolItems = () => within(symbolSection()).getAllByRole("listitem");

describe("DrillMap MapLegend", () => {
  it("is labelled for assistive tech", () => {
    render(<MapLegend />);

    expect(screen.getByRole("complementary", { name: "Map legend" })).toBeTruthy();
  });

  it("lists Producer, Drillhole and Drill Rig, in that order", () => {
    render(<MapLegend />);

    expect(symbolItems().map((item) => item.textContent)).toEqual(["Producer", "Drillhole", "Drill Rig"]);
  });

  it("does not list the Techno Map's Injector", () => {
    render(<MapLegend />);

    expect(within(symbolSection()).queryByText("Injector")).toBeNull();
  });

  it("draws each symbol with the same shapes the map uses", () => {
    render(<MapLegend />);
    const [producer, drillhole, rig] = symbolItems();

    expect(producer.querySelector(".marker-symbol--triangle.marker-symbol--small")).toBeTruthy();
    expect(drillhole.querySelector(".marker-symbol--square.marker-symbol--small")).toBeTruthy();
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
