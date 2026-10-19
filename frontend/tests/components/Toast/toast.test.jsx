import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import ToastContainer from "../../../src/components/Toast/ToastContainer.jsx";
import {
  TOAST_DURATIONS,
  TOAST_EXIT_MS,
  clearToasts,
  dismissToast,
  showToast,
} from "../../../src/components/Toast/toastStore.js";

const renderToasts = () => render(<ToastContainer />);
const messages = () => screen.queryAllByText(/./, { selector: "[data-type] > span.min-w-0" })
  .map((node) => node.textContent);
// Advances past a toast's lifetime plus its exit transition.
const elapse = (ms) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  act(() => clearToasts());
  cleanup();
  vi.useRealTimers();
});

describe("toasts", () => {
  it("uses the documented durations", () => {
    expect(TOAST_DURATIONS).toEqual({ error: 5000, warning: 3000, success: 3000 });
  });

  it.each([
    ["error", 5000],
    ["warning", 3000],
    ["success", 3000],
  ])("dismisses a %s toast after %i ms", (type, duration) => {
    renderToasts();
    act(() => { showToast(type, `A ${type}`); });

    elapse(duration - 1);
    expect(messages()).toEqual([`A ${type}`]);

    elapse(1 + TOAST_EXIT_MS);
    expect(messages()).toEqual([]);
  });

  it("renders at the top-centre of the application, above the map", () => {
    renderToasts();
    act(() => { showToast("success", "Saved"); });

    const region = screen.getByRole("region", { name: "Notifications" });
    expect(region.className).toContain("fixed");
    expect(region.className).toContain("top-3");
    expect(region.className).toContain("items-center");
    // Clicks pass through the empty strip to the map below.
    expect(region.className).toContain("pointer-events-none");
    expect(within(region).getByText("Saved")).toBeTruthy();
  });

  it("announces errors as alerts and the rest as status", () => {
    renderToasts();
    act(() => {
      showToast("error", "Broken");
      showToast("success", "Fine");
    });

    expect(screen.getByRole("alert").textContent).toContain("Broken");
    expect(screen.getByRole("status").textContent).toContain("Fine");
  });

  it("shows a repeated message once and restarts its timer", () => {
    renderToasts();
    act(() => { showToast("warning", "Offline"); });
    elapse(2000);
    act(() => { showToast("warning", "Offline"); });

    expect(messages()).toEqual(["Offline"]);

    // The first timer would have fired here; the restarted one has not.
    elapse(2000);
    expect(messages()).toEqual(["Offline"]);

    elapse(1000 + TOAST_EXIT_MS);
    expect(messages()).toEqual([]);
  });

  it("keeps at most three toasts, dismissing the oldest", () => {
    renderToasts();
    act(() => {
      ["one", "two", "three", "four"].forEach((message) => showToast("success", message));
    });
    elapse(TOAST_EXIT_MS);

    expect(messages()).toEqual(["two", "three", "four"]);
  });

  it("closes on the dismiss button", () => {
    renderToasts();
    act(() => { showToast("error", "Broken"); });

    act(() => { screen.getByRole("button", { name: "Dismiss notification" }).click(); });
    elapse(TOAST_EXIT_MS);

    expect(messages()).toEqual([]);
  });

  it("cancels the auto-dismiss timer of a toast closed by hand", () => {
    renderToasts();
    const id = showToast("error", "Broken");

    act(() => dismissToast(id));
    elapse(TOAST_EXIT_MS);

    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears every pending timer", () => {
    renderToasts();
    act(() => {
      showToast("error", "a");
      showToast("success", "b");
    });

    act(() => clearToasts());

    expect(messages()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
