// The merge added two sidebar entries that both land on one page component,
// told apart by a `dimension` prop. These cover what the merge itself can
// break: the navigation wiring, the keying that stops the two pages sharing
// filter state, and the scoping that keeps the dashboard's styles and its
// dialog off the rest of the application.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../../../src/App.jsx";
import WeeklyGeos from "../../../src/pages/WeeklyGeos/WeeklyGeos.jsx";

// The page is tested against fixed figures rather than the mock generator,
// so an edit to the generator cannot fail these, and a backend arriving
// cannot either.
const WEEKS = [
  {
    weekNum: 14, weekLabel: "S14", monthNum: 4, monthName: "April",
    holeCount: 3, realizedM: 1000, cumulativeM: 1000, cumulativeTargetM: 900,
    pctCored: 0.4, avgDeviationPct: 0.8, avgRecoveryPct: 97, inCampaign: true,
  },
  {
    weekNum: 15, weekLabel: "S15", monthNum: 4, monthName: "April",
    holeCount: 4, realizedM: 1400, cumulativeM: 2400, cumulativeTargetM: 1800,
    pctCored: 0.5, avgDeviationPct: 0.9, avgRecoveryPct: 96, inCampaign: true,
  },
];

const FILTERS = {
  years: [{ year: 2026, startWeek: 14, endWeek: 45, annualTarget: 38000 }],
  categories: ["Delineation", "Techno"],
  rigs: ["P7000_O5", "P9000_O9"],
  donuts: [{ category: "Delineation", metric: "coredSplit" }],
};

vi.mock("../../../src/pages/WeeklyGeos/api/client.js", () => ({
  api: {
    filters: () => Promise.resolve(FILTERS),
    summary: () => Promise.resolve({
      holeCount: 7, startWeek: 14, endWeek: 45, annualTarget: 38000,
    }),
    weekly: () => Promise.resolve(WEEKS),
    weeklyByRig: () => Promise.resolve([
      { weekNum: 14, weekLabel: "S14", monthNum: 4, monthName: "April", rig: "P7000_O5", realizedM: 1000 },
      { weekNum: 15, weekLabel: "S15", monthNum: 4, monthName: "April", rig: "P9000_O9", realizedM: 1400 },
    ]),
    campaignAverages: () => Promise.resolve({
      campaignAvgDeviationPct: 0.85, campaignAvgRecoveryPct: 96.5, campaignPctCored: 0.45,
    }),
    typeSplit: () => Promise.resolve([
      { category: "Delineation", coredM: 900, destructiveM: 1500, holeCount: 7 },
    ]),
  },
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// ECharts refuses to draw into a box it measures as 0x0, which is every
// element in jsdom. It reads clientWidth/clientHeight first and falls back
// to the bounding rect, so both have to answer.
function giveElementsASize() {
  for (const [prop, value] of [["clientWidth", 600], ["clientHeight", 280]]) {
    vi.spyOn(HTMLElement.prototype, prop, "get").mockReturnValue(value);
  }

  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 600, height: 280, top: 0, left: 0, right: 600, bottom: 280, x: 0, y: 0,
  });
}

beforeEach(() => {
  globalThis.ResizeObserver = ResizeObserverStub;
  giveElementsASize();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Waits for the banner, which needs the summary query to have answered. */
async function waitForDashboard() {
  await waitFor(() => {
    expect(screen.getByText("Campaign W14–W45")).toBeTruthy();
  });
}

describe("Weekly Geos navigation", () => {
  it("offers both new entries in the sidebar alongside the map pages", () => {
    render(<App />);

    const nav = screen.getByRole("navigation", { name: "Main navigation" });

    expect(within(nav).getByRole("button", { name: "Exploration Map" })).toBeTruthy();
    expect(within(nav).getByRole("button", { name: "Techno Map" })).toBeTruthy();
    expect(within(nav).getByRole("button", { name: "Drilling Details" })).toBeTruthy();
    expect(within(nav).getByRole("button", { name: "Drilling by Rig" })).toBeTruthy();
  });

  it.each([
    ["Drilling Details", "Drilling details"],
    ["Drilling by Rig", "Drilling details by rig"],
  ])("shows the dashboard when %s is chosen", async (label, heading) => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: label }));

    // Lazily loaded, so it is a tick behind the click.
    expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeTruthy();
    await waitForDashboard();
  });

  it("leaves the map pages unmounted while the dashboard is open", async () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Drilling Details" }));
    await waitForDashboard();

    expect(container.querySelector(".drill-map-page")).toBeNull();
    expect(container.querySelector(".techno-map-page")).toBeNull();
    expect(container.querySelector(".weekly-geos-page")).toBeTruthy();
  });
});

describe("Weekly Geos page", () => {
  it("renders the campaign banner and the four cards", async () => {
    render(<WeeklyGeos dimension="category" />);
    await waitForDashboard();

    expect(screen.getByText("Campaign W14–W45")).toBeTruthy();
    expect(screen.getByText("Target 38,000 m")).toBeTruthy();

    for (const label of ["Holes drilled", "Drilled to date", "Planned to date", "Against plan"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    // 2,400 m against a 1,800 m plan.
    expect(screen.getByText("133%")).toBeTruthy();
  });

  it("titles the metres chart differently on the two pages", async () => {
    const { unmount } = render(<WeeklyGeos dimension="category" />);
    await waitForDashboard();
    expect(screen.getByRole("heading", { level: 2, name: "Metres drilled" })).toBeTruthy();
    unmount();

    render(<WeeklyGeos dimension="rig" />);
    await waitForDashboard();
    expect(screen.getByRole("heading", { level: 2, name: "Metres drilled by rig" })).toBeTruthy();
  });

  it("keeps every rule inside the page root", async () => {
    const { container } = render(<WeeklyGeos dimension="category" />);
    await waitForDashboard();

    const root = container.querySelector(".weekly-geos-page");

    expect(root).toBeTruthy();
    expect(root.querySelector(".dash")).toBeTruthy();
    // The sidebar it arrived with would collide with the application's own.
    expect(container.querySelector(".sidebar")).toBeNull();
  });
});

describe("Weekly Geos filter state", () => {
  it("does not carry a selection from one page to the other", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Drilling Details" }));
    await waitForDashboard();

    // Pick a hole purpose on the first page.
    fireEvent.click(screen.getByRole("button", { name: "All purposes" }));
    fireEvent.click(screen.getByLabelText("Delineation"));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Delineation" })).toBeTruthy();
    });

    // The second page must come up unfiltered, with its slicer agreeing.
    fireEvent.click(screen.getByRole("button", { name: "Drilling by Rig" }));
    await waitForDashboard();

    expect(screen.getByRole("button", { name: "All purposes" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
  });
});

describe("Weekly Geos enlarged chart", () => {
  it("portals the dialog out of the page's CSS container", async () => {
    const { container } = render(<WeeklyGeos dimension="category" />);
    await waitForDashboard();

    fireEvent.click(screen.getByRole("button", { name: "Enlarge Metres drilled" }));

    const dialog = screen.getByRole("dialog", { name: "Metres drilled" });

    // `container: inline-size` on the page root is the containing block for
    // a fixed-position backdrop, so the dialog must sit outside it.
    expect(container.querySelector(".weekly-geos-page").contains(dialog)).toBe(false);
    // It still needs the page class, which is what its styles are scoped to.
    expect(dialog.closest(".weekly-geos-page.is-overlay")).toBeTruthy();
  });

  it("closes on Escape", async () => {
    render(<WeeklyGeos dimension="category" />);
    await waitForDashboard();

    fireEvent.click(screen.getByRole("button", { name: "Enlarge Metres drilled" }));
    expect(screen.getByRole("dialog", { name: "Metres drilled" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Metres drilled" })).toBeNull();
    });
  });
});
