import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import HelpButton from "../../../src/components/HelpDialog/HelpDialog.jsx";
import { modKeyLabel } from "../../../src/components/HelpDialog/help.js";

const SECTIONS = [
  { title: "Moving around", shortcuts: [{ keys: ["Drag"], action: "Pan the map." }, { keys: ["Ctrl", "Click"], action: "Select a hole." }] },
  { title: "Toolbar", buttons: [{ icon: "+", name: "Zoom in", description: "Zoom in on the centre." }] },
];

afterEach(cleanup);

const renderHelp = () => render(<><HelpButton title="Test Map" sections={SECTIONS} /><input aria-label="Notes" /></>);
const helpButton = () => screen.getByRole("button", { name: "Help" });
const dialog = () => screen.queryByRole("dialog", { name: "Test Map help" });

describe("HelpButton", () => {
  it("is a round button with a question mark in a circle", () => {
    renderHelp();
    const icon = helpButton().querySelector('svg[data-icon="help"]');
    expect(icon?.querySelector("circle")).toBeTruthy();
    expect(helpButton().className).toContain("rounded-full");
    expect(helpButton().getAttribute("aria-haspopup")).toBe("dialog");
  });

  it("opens a dialog listing every section, shortcut and button", () => {
    renderHelp();
    fireEvent.click(helpButton());

    const help = dialog();
    expect(help).toBeTruthy();
    expect(helpButton().getAttribute("aria-expanded")).toBe("true");
    expect(within(help).getByRole("heading", { name: "Moving around" })).toBeTruthy();
    expect(within(help).getByRole("heading", { name: "Toolbar" })).toBeTruthy();
    expect(help.textContent).toContain("Pan the map.");
    expect(help.textContent).toContain("Zoom in on the centre.");
    expect([...help.querySelectorAll("kbd")].map((key) => key.textContent)).toEqual(expect.arrayContaining(["Drag", "Click"]));
  });

  it("closes with × or Esc, and gives focus back to the button", () => {
    renderHelp();
    fireEvent.click(helpButton());
    fireEvent.click(screen.getByRole("button", { name: "Close help" }));
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(helpButton());

    fireEvent.click(helpButton());
    fireEvent(dialog(), new Event("cancel", { cancelable: true }));
    expect(dialog()).toBeNull();
  });

  it("closes on a press on the backdrop, not inside the panel", () => {
    renderHelp();
    fireEvent.click(helpButton());
    fireEvent.click(dialog().querySelector(".help-dialog__body"));
    expect(dialog()).toBeTruthy();
    fireEvent.click(dialog());
    expect(dialog()).toBeNull();
  });

  it("opens on ?, but not while typing or with a modifier held", () => {
    renderHelp();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Notes" }), { key: "?" });
    expect(dialog()).toBeNull();
    fireEvent.keyDown(window, { key: "?", ctrlKey: true });
    expect(dialog()).toBeNull();

    fireEvent.keyDown(window, { key: "?" });
    expect(dialog()).toBeTruthy();
  });

  it("also opens on Shift + the slash key when no key text is reported", () => {
    renderHelp();
    fireEvent.keyDown(window, { key: "", code: "Slash", shiftKey: true });
    expect(dialog()).toBeTruthy();
  });

  it("renders the dialog outside the page, so page header styles cannot reach it", () => {
    const { container } = renderHelp();
    fireEvent.click(helpButton());
    expect(container.contains(dialog())).toBe(false);
    expect(dialog().parentElement).toBe(document.body);
  });
});

describe("modKeyLabel", () => {
  it("shows Ctrl as ⌘ on a Mac and leaves other keys alone", () => {
    expect(modKeyLabel("Ctrl", true)).toBe("⌘");
    expect(modKeyLabel("Ctrl", false)).toBe("Ctrl");
    expect(modKeyLabel("Esc", true)).toBe("Esc");
  });
});
