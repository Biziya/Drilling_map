import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RefreshButton from "../../../src/map/Controls/RefreshButton.jsx";

afterEach(cleanup);

const button = () => screen.getByRole("button", { name: "Refresh map data" });

describe("RefreshButton", () => {
  it("has an accessible label and a tooltip", () => {
    render(<RefreshButton isRefreshing={false} onRefresh={() => {}} />);

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
    expect(button().querySelector("svg").getAttribute("class")).toContain("animate-spin");
  });

  it("sits in the top-right corner of the map", () => {
    render(<RefreshButton isRefreshing={false} onRefresh={() => {}} />);

    expect(button().className).toMatch(/\babsolute\b.*\btop-3\.5\b.*\bright-3\.5\b/);
  });
});
