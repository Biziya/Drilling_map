// Both pages currently share this behaviour; split this file when one page diverges.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import DrillRefreshButton from "../../src/pages/DrillMap/Controls/RefreshButton.jsx";
import TechnoRefreshButton from "../../src/pages/TechnoMap/Controls/RefreshButton.jsx";

afterEach(cleanup);

const PAGES = [
  ["DrillMap", DrillRefreshButton],
  ["TechnoMap", TechnoRefreshButton],
];

const button = () => screen.getByRole("button", { name: "Refresh map data" });
const icon = () => button().querySelector('svg[data-icon="refresh"]');

describe.each(PAGES)("%s RefreshButton", (_page, RefreshButton) => {
  it("has an accessible label and a tooltip", () => {
    render(<RefreshButton isRefreshing={false} onRefresh={() => {}} />);

    expect(button().getAttribute("aria-label")).toBe("Refresh map data");
    expect(button().getAttribute("title")).toBe("Refresh map data");
  });

  it("calls onRefresh when clicked", () => {
    const onRefresh = vi.fn();
    render(<RefreshButton isRefreshing={false} onRefresh={onRefresh} />);

    fireEvent.click(button());

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("is disabled, busy and spinning while a request runs", () => {
    const onRefresh = vi.fn();
    render(<RefreshButton isRefreshing onRefresh={onRefresh} />);

    fireEvent.click(button());

    expect(onRefresh).not.toHaveBeenCalled();
    expect(button().disabled).toBe(true);
    expect(button().getAttribute("aria-busy")).toBe("true");
    expect(icon().getAttribute("class")).toContain("motion-safe:animate-spin");
  });

  it("is enabled, idle and still when no request runs", () => {
    render(<RefreshButton isRefreshing={false} onRefresh={() => {}} />);

    expect(button().disabled).toBe(false);
    expect(button().getAttribute("aria-busy")).toBe("false");
    expect(icon().getAttribute("class")).not.toContain("animate-spin");
  });

  // Two arcs and two arrow heads.
  it("draws the refresh icon from four paths, hidden from assistive tech", () => {
    render(<RefreshButton isRefreshing={false} onRefresh={() => {}} />);

    expect(icon()).toBeTruthy();
    expect(icon().querySelectorAll("path")).toHaveLength(4);
    expect(icon().getAttribute("aria-hidden")).toBe("true");
  });

  // It now sits in the page header, not floating over the map.
  it("is not absolutely positioned", () => {
    render(<RefreshButton isRefreshing={false} onRefresh={() => {}} />);

    expect(button().className).not.toMatch(/\babsolute\b/);
  });
});
