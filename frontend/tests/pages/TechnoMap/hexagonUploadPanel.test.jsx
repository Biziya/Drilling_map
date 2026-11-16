import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";
import HexagonUploadPanel from "../../../src/pages/TechnoMap/Controls/HexagonUploadPanel.jsx";
import MapControls from "../../../src/pages/TechnoMap/Controls/MapControls.jsx";

afterEach(cleanup);

const SOURCE = { fileName: "2026_wells.xlsx", count: 31, moved: 118, unmatched: 14, maxShift: 4.24 };

function controls(props = {}) {
  const onUpload = vi.fn();
  const onClearHexagons = vi.fn();
  render(<MapControls zoom={1} maxZoom={10} onZoomIn={() => {}} onZoomOut={() => {}} onReset={() => {}}
    onUpload={onUpload} isUploading={false} hexagons={null} onClearHexagons={onClearHexagons}
    isMeasuring={false} onToggleMeasure={() => {}} isBoxSelecting={false} onToggleBoxSelect={() => {}}
    isExporting={false} isSelecting={false} onToggleScreenshot={() => {}} {...props} />);

  return { onUpload, onClearHexagons, button: screen.getByRole("button", { name: "Upload hexagons from Excel" }) };
}

const dialog = () => screen.queryByRole("dialog", { name: "Hexagons from Excel" });

describe("Upload window", () => {
  it("opens from the toolbar button and closes on a second click, Esc or a press outside", () => {
    const { button } = controls();
    expect(dialog()).toBeNull();
    fireEvent.click(button);
    expect(dialog()).toBeTruthy();
    expect(button.getAttribute("aria-expanded")).toBe("true");
    // A press inside the window keeps it open.
    fireEvent.pointerDown(screen.getByText("No file uploaded"));
    expect(dialog()).toBeTruthy();
    fireEvent.click(button);
    expect(dialog()).toBeNull();

    fireEvent.click(button);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(dialog()).toBeNull();

    fireEvent.click(button);
    fireEvent.pointerDown(document.body);
    expect(dialog()).toBeNull();
  });

  it("is disabled, and closes, in screenshot mode", () => {
    const { button } = controls();
    fireEvent.click(button);
    cleanup();
    const again = controls({ isSelecting: true });
    expect(again.button.disabled).toBe(true);
    expect(dialog()).toBeNull();
  });

  it("shows the empty state with the needed columns", () => {
    render(<HexagonUploadPanel hexagons={null} isUploading={false} onUpload={() => {}} onClear={() => {}} />);
    expect(screen.getByText("No file uploaded")).toBeTruthy();
    expect(screen.getByText(/Needs columns: Name, Type, X \[m\], Y \[m\], Associated production cells/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose Excel file" })).toBeTruthy();
  });

  it("shows the file name, cell count and snap result, and removes the file", () => {
    const onClear = vi.fn();
    render(<HexagonUploadPanel hexagons={SOURCE} isUploading={false} onUpload={() => {}} onClear={onClear} />);
    expect(screen.getByText("2026_wells.xlsx").title).toBe("2026_wells.xlsx");
    expect(screen.getByText("31 hexagon cells")).toBeTruthy();
    expect(screen.getByText("118 corners moved to drilled wells (max 4.2 m) · 14 at design position")).toBeTruthy();
    expect(screen.queryByText("No file uploaded")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove file" }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Replace file" })).toBeTruthy();
  });

  it("uploads a chosen or dropped file", () => {
    const onUpload = vi.fn();
    render(<HexagonUploadPanel hexagons={null} isUploading={false} onUpload={onUpload} onClear={() => {}} />);
    const file = new File(["x"], "wells.xlsx");
    const input = screen.getByTestId("hexagon-file-input");
    fireEvent.change(input, { target: { files: [file] } });
    expect(onUpload).toHaveBeenLastCalledWith(file);

    const zone = screen.getByTestId("hexagon-drop-zone");
    const dataTransfer = { types: ["Files"], files: [file], dropEffect: "none" };
    fireEvent.dragEnter(zone, { dataTransfer });
    expect(zone.classList.contains("is-dragging")).toBe(true);
    const over = createEvent.dragOver(zone, { dataTransfer });
    fireEvent(zone, over);
    expect(over.defaultPrevented).toBe(true);
    fireEvent.drop(zone, { dataTransfer });
    expect(onUpload).toHaveBeenCalledTimes(2);
    expect(zone.classList.contains("is-dragging")).toBe(false);
  });

  it("shows progress while a file is read", () => {
    render(<HexagonUploadPanel hexagons={null} isUploading onUpload={() => {}} onClear={() => {}} />);
    expect(screen.getByRole("button", { name: "Reading…" }).disabled).toBe(true);
  });
});
