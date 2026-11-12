// The Data Team's New Year greeting: its season, the once-per-browser memory,
// and the dialog itself.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import NewYearGreeting from "../../../src/components/NewYearGreeting/NewYearGreeting.jsx";
import {
  GREETING_TEXT,
  hasSeenGreeting,
  isGreetingSeason,
  markGreetingSeen,
  seenKey,
  shouldShowGreeting,
} from "../../../src/components/NewYearGreeting/greeting.js";

const day = (year, month, date) => new Date(year, month - 1, date, 12);

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("greeting season", () => {
  it("runs from Nov 12 to Dec 31, inclusive", () => {
    expect(isGreetingSeason(day(2026, 11, 11))).toBe(false);
    expect(isGreetingSeason(day(2026, 11, 12))).toBe(true);
    expect(isGreetingSeason(day(2026, 12, 31))).toBe(true);
    expect(isGreetingSeason(day(2027, 1, 1))).toBe(false);
    expect(isGreetingSeason(day(2027, 6, 15))).toBe(false);
  });

  it("is remembered per year, so it comes back next season", () => {
    expect(seenKey(day(2026, 12, 1))).not.toBe(seenKey(day(2027, 12, 1)));

    markGreetingSeen(day(2026, 12, 1));
    expect(shouldShowGreeting(day(2026, 12, 20))).toBe(false);
    expect(shouldShowGreeting(day(2027, 11, 20))).toBe(true);
  });

  it("still works when storage throws: it just shows again", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });

    expect(() => markGreetingSeen(day(2026, 12, 1))).not.toThrow();
    expect(hasSeenGreeting(day(2026, 12, 1))).toBe(false);
    expect(shouldShowGreeting(day(2026, 12, 1))).toBe(true);
  });
});

describe("greeting dialog", () => {
  it("shows the Mongolian greeting first, signed by the Data Team", () => {
    render(<NewYearGreeting open onClose={() => {}} />);

    expect(screen.getByRole("heading", { name: GREETING_TEXT.mn.heading })).toBeTruthy();
    expect(screen.getByText("— Data Team")).toBeTruthy();
  });

  it("switches to English and remembers it", () => {
    render(<NewYearGreeting open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByRole("heading", { name: "Happy New Year!" })).toBeTruthy();
    cleanup();

    render(<NewYearGreeting open onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Happy New Year!" })).toBeTruthy();
  });

  it("closes from the thank-you button and the × button", () => {
    const onClose = vi.fn();
    render(<NewYearGreeting open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: GREETING_TEXT.mn.closeLabel }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders nothing when closed", () => {
    render(<NewYearGreeting open={false} onClose={() => {}} />);

    expect(screen.queryByRole("heading")).toBeNull();
  });
});
