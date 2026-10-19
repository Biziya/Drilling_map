import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import MarkerSymbol from "../../../src/map/Legends/MarkerSymbol.jsx";

afterEach(cleanup);

// Getting the colour variable wrong renders every marker uncoloured with no
// error, so the exact contract with map.css is pinned here.
describe("MarkerSymbol", () => {
  const props = { color: "#15803d", shape: "square" };

  it("sets the colour on the variable the stylesheet reads", () => {
    const { container } = render(<MarkerSymbol {...props} />);

    expect(container.firstChild.style.getPropertyValue("--status-color")).toBe("#15803d");
  });

  it("does not set the retired Techno-prefixed variable", () => {
    const { container } = render(<MarkerSymbol {...props} />);

    expect(container.firstChild.style.getPropertyValue("--techno-status-color")).toBe("");
  });

  it("applies the base and shape classes", () => {
    const { container } = render(<MarkerSymbol {...props} />);

    expect(container.firstChild.className).toBe("marker-symbol marker-symbol--square");
  });

  it.each(["square", "triangle"])("renders the %s shape modifier", (shape) => {
    const { container } = render(<MarkerSymbol {...props} shape={shape} />);

    expect(container.firstChild.className).toContain(`marker-symbol--${shape}`);
  });

  it("adds the small modifier for legend swatches", () => {
    const { container } = render(<MarkerSymbol {...props} small />);

    expect(container.firstChild.className).toBe("marker-symbol marker-symbol--square marker-symbol--small");
  });

  it("is hidden from assistive tech", () => {
    const { container } = render(<MarkerSymbol {...props} />);

    expect(container.firstChild.getAttribute("aria-hidden")).toBe("true");
  });
});
