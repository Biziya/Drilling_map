import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import DrillMapStatusOverlay from "../../../src/pages/DrillMap/MapStatusOverlay.jsx";
import TechnoMapStatusOverlay from "../../../src/pages/TechnoMap/MapStatusOverlay.jsx";

afterEach(cleanup);

const copies = [
  ["DrillMap", DrillMapStatusOverlay, "map-state"],
  ["TechnoMap", TechnoMapStatusOverlay, "techno-map-state"],
];

describe.each(copies)("%s/MapStatusOverlay", (_name, MapStatusOverlay, baseClass) => {
  const renderOverlay = (props) =>
    render(<MapStatusOverlay status="loading" message="" onRetry={() => {}} {...props} />);

  it("renders nothing once the map is ready", () => {
    // The overlay sits above the canvas, so it must fully unmount when not needed.
    const { container } = renderOverlay({ status: "ready" });

    expect(container.innerHTML).toBe("");
  });

  it("shows a loading message while fetching", () => {
    renderOverlay({ status: "loading" });

    expect(screen.getByText(/Loading drillholes/)).toBeDefined();
  });

  it("explains an empty result set", () => {
    renderOverlay({ status: "empty" });

    expect(screen.getByText(/No drillholes found/)).toBeDefined();
    expect(screen.getByText(/empty result/)).toBeDefined();
  });

  it("surfaces the error message from the API", () => {
    renderOverlay({ status: "error", message: "Database offline" });

    expect(screen.getByText("Database offline")).toBeDefined();
  });

  it("offers a retry button only in the error state", () => {
    renderOverlay({ status: "error", message: "boom" });
    expect(screen.getByRole("button", { name: /try again/i })).toBeDefined();

    cleanup();
    renderOverlay({ status: "loading" });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("calls onRetry when the retry button is pressed", () => {
    const onRetry = vi.fn();
    renderOverlay({ status: "error", message: "boom", onRetry });

    screen.getByRole("button", { name: /try again/i }).click();

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("exposes the state to assistive tech", () => {
    const { container } = renderOverlay({ status: "loading" });

    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });

  it("tags the wrapper with the current status for styling", () => {
    const { container } = renderOverlay({ status: "error", message: "boom" });

    expect(container.querySelector(`.${baseClass}--error`)).not.toBeNull();
  });

  it("renders an empty error message without crashing", () => {
    // resolveFailedState can produce a blank message if the Error had none.
    expect(() => renderOverlay({ status: "error", message: "" })).not.toThrow();
  });
});
