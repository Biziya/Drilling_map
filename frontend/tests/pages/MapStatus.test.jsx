// Both pages currently share this behaviour; split this file when one page diverges.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import DrillMapStatus from "../../src/pages/DrillMap/Map/MapStatus.jsx";
import TechnoMapStatus from "../../src/pages/TechnoMap/Map/MapStatus.jsx";

afterEach(cleanup);

const PAGES = [
  ["DrillMap", DrillMapStatus],
  ["TechnoMap", TechnoMapStatus],
];

describe.each(PAGES)("%s MapStatus", (_page, MapStatus) => {
  it("renders nothing once the map is ready", () => {
    const { container } = render(<MapStatus status="ready" imageFailed={false} />);

    expect(container.firstChild).toBeNull();
  });

  it("shows a loading message with a spinner", () => {
    const { container } = render(<MapStatus status="loading" imageFailed={false} />);

    expect(screen.getByText(/Loading drillholes/)).toBeTruthy();
    expect(container.querySelector(".map-state__spinner")).toBeTruthy();
  });

  it.each([
    ["empty", /No drillholes found/],
    ["unplaceable", /No drillholes to place/],
    ["unavailable", /No map data available/],
  ])("explains the %s state", (status, text) => {
    const { container } = render(<MapStatus status={status} imageFailed={false} />);

    expect(screen.getByText(text)).toBeTruthy();
    expect(container.querySelector(`.map-state--${status}`)).toBeTruthy();
  });

  it("explains why the data is unavailable when the failure is known", () => {
    render(<MapStatus status="unavailable" imageFailed={false} failure={{ kind: "http", status: 500 }} />);

    expect(screen.getByText("Backend error (HTTP 500).")).toBeTruthy();
    expect(screen.getByText(/No map data available/)).toBeTruthy();
  });

  it("gives no failure reason for any other state", () => {
    render(<MapStatus status="empty" imageFailed={false} failure={{ kind: "http", status: 500 }} />);

    expect(screen.queryByText(/Backend error/)).toBeNull();
  });

  // Temporary feedback moved to toasts; the notice offers no retry button.
  it("has no buttons", () => {
    render(<MapStatus status="unavailable" imageFailed={false} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("exposes the state to assistive tech", () => {
    render(<MapStatus status="loading" imageFailed={false} />);

    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("reports a missing base map ahead of the data state", () => {
    render(<MapStatus status="ready" imageFailed />);

    expect(screen.getByText("Base map not found")).toBeTruthy();
    expect(screen.getByText("public/base-map.svg")).toBeTruthy();
  });
});
