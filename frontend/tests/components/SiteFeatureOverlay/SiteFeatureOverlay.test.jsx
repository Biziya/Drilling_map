import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import SiteFeatureOverlay from "../../../src/components/SiteFeatureOverlay/SiteFeatureOverlay.jsx";
import { siteOutlinesVisible } from "../../../src/components/SiteFeatureOverlay/siteFeatureLayout.js";

const FEATURES = [
  {
    id: "pit", name: "Mud pit", type: "mud_pit", iconSrc: "/mud_pit.svg", areaHa: 10.26,
    lonLat: [110.019853, 44.179244], utm: { x: 50, y: 50 },
    outlineUtm: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 0 }],
  },
  {
    id: "plant", name: "Zoovch Pilot", type: "pilot_factory", iconSrc: "/missing.svg", areaHa: null,
    lonLat: [110.012374, 44.189857], utm: { x: 300, y: 200 }, outlineUtm: [],
  },
];
// UTM stands in for viewport px here.
const identity = (point) => point;

function renderOverlay(props = {}) {
  const onToggle = vi.fn();
  const utils = render(
    <div className="map-viewport">
      <SiteFeatureOverlay features={FEATURES} toViewport={identity} showOutlines={false} pinnedId={null}
        onToggle={onToggle} viewport={{ width: 800, height: 600 }} {...props} />
    </div>,
  );

  return { ...utils, onToggle };
}

afterEach(cleanup);

describe("SiteFeatureOverlay", () => {
  it("places a 32 px icon per feature at its point", () => {
    renderOverlay();
    const pit = screen.getByRole("button", { name: "Mud pit" });

    expect(pit.style.left).toBe("50px");
    expect(pit.style.top).toBe("50px");
    expect(pit.style.getPropertyValue("--site-icon-size")).toBe("32px");
    expect(pit.querySelector("img").getAttribute("src")).toBe("/mud_pit.svg");
    expect(screen.getByRole("button", { name: "Zoovch Pilot" })).toBeTruthy();
  });

  it("draws the dashed footprints only when asked, skipping features with none", () => {
    const { container, rerender } = renderOverlay();
    expect(container.querySelector(".site-feature-outlines")).toBeNull();

    rerender(
      <SiteFeatureOverlay features={FEATURES} toViewport={identity} showOutlines pinnedId={null}
        onToggle={() => {}} viewport={{ width: 800, height: 600 }} />,
    );
    const outlines = container.querySelectorAll(".site-feature-outlines polygon");
    expect(outlines).toHaveLength(1);
    expect(outlines[0].getAttribute("points")).toBe("0.0,0.0 100.0,0.0 100.0,100.0 0.0,0.0");
  });

  it("toggles on click and shows name, area and lat/lon in the popup", () => {
    const { onToggle, rerender } = renderOverlay();
    fireEvent.click(screen.getByRole("button", { name: "Mud pit" }));
    expect(onToggle).toHaveBeenCalledWith("pit");

    rerender(
      <SiteFeatureOverlay features={FEATURES} toViewport={identity} showOutlines={false} pinnedId="pit"
        onToggle={onToggle} viewport={{ width: 800, height: 600 }} />,
    );
    const popup = screen.getByRole("tooltip");
    expect(popup.textContent).toContain("Mud pit");
    expect(popup.textContent).toContain("10.26 ha");
    expect(popup.textContent).toContain("44.17924, 110.01985");
  });

  it("shows a dash for a missing area", () => {
    renderOverlay({ pinnedId: "plant" });

    expect(screen.getByRole("tooltip").textContent).toContain("Area—");
  });

  it("hides the popup and lets clicks through while a map tool is active", () => {
    const { container } = renderOverlay({ pinnedId: "pit", isInteractive: false });

    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(container.querySelector(".site-feature-layer.is-inert")).toBeTruthy();
  });

  it("falls back to a coloured circle when the icon image fails", () => {
    renderOverlay();
    const plant = screen.getByRole("button", { name: "Zoovch Pilot" });
    fireEvent.error(plant.querySelector("img"));

    expect(plant.classList.contains("is-fallback")).toBe(true);
    expect(plant.querySelector("img")).toBeNull();
    expect(plant.style.getPropertyValue("--site-fallback-color")).toMatch(/^hsl\(/);
  });

  it("renders nothing without features", () => {
    const { container } = renderOverlay({ features: [] });

    expect(container.querySelector(".site-feature-layer")).toBeNull();
  });
});

describe("siteOutlinesVisible", () => {
  const bounds = { minX: 0, maxX: 10000, minY: 0, maxY: 10000 };

  it("is true once 100 px covers at most the threshold", () => {
    // 1000 px wide map at zoom 1: 100 px = 1000 m.
    expect(siteOutlinesVisible(bounds, 1000, 1, 350)).toBe(false);
    expect(siteOutlinesVisible(bounds, 1000, 2.8, 350)).toBe(false);
    expect(siteOutlinesVisible(bounds, 1000, 2.86, 350)).toBe(true);
    expect(siteOutlinesVisible(bounds, 1000, 10, 350)).toBe(true);
  });

  it("is false before the map has a size", () => {
    expect(siteOutlinesVisible(bounds, 0, 5, 350)).toBe(false);
  });
});
