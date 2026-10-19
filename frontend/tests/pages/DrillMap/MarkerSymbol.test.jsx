import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import MarkerSymbol from "../../../src/pages/DrillMap/MarkerSymbol.jsx";
import TechnoMapMarkerSymbol from "../../../src/pages/TechnoMap/TechnoMapMarkerSymbol.jsx";

afterEach(cleanup);

// The two modules are prefixed copies, and the prefix extends to the CSS custom
// property each one reads. Getting this wrong renders every marker uncoloured
// with no error, so the exact contract is pinned here per module.
const copies = [
  ["DrillMap", MarkerSymbol, "marker-symbol", "--status-color"],
  ["TechnoMap", TechnoMapMarkerSymbol, "techno-marker-symbol", "--techno-status-color"],
];

describe.each(copies)("%s marker symbol", (_name, Symbol_, baseClass, colorVar) => {
  const config = { color: "#15803d", shape: "square" };

  it("sets the colour on the variable its own stylesheet reads", () => {
    const { container } = render(<Symbol_ config={config} />);

    expect(container.firstChild.style.getPropertyValue(colorVar)).toBe("#15803d");
  });

  it("does not set the other module's variable", () => {
    const otherVar = colorVar === "--status-color" ? "--techno-status-color" : "--status-color";
    const { container } = render(<Symbol_ config={config} />);

    expect(container.firstChild.style.getPropertyValue(otherVar)).toBe("");
  });

  it("applies the base and shape classes", () => {
    const { container } = render(<Symbol_ config={config} />);

    expect(container.firstChild.className).toBe(`${baseClass} ${baseClass}--square`);
  });

  it.each(["circle", "diamond", "triangle", "square-outline"])(
    "renders the %s shape modifier",
    (shape) => {
      const { container } = render(<Symbol_ config={{ ...config, shape }} />);

      expect(container.firstChild.className).toContain(`${baseClass}--${shape}`);
    },
  );

  it("is hidden from assistive tech", () => {
    const { container } = render(<Symbol_ config={config} />);

    expect(container.firstChild.getAttribute("aria-hidden")).toBe("true");
  });
});
