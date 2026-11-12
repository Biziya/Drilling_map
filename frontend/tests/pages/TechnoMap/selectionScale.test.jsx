// The Techno Map with 5,000 drillholes, all selected: the selection must stay
// cheap. Rings are drawn on the marker canvas, the table renders only the rows
// in view, and panning or hovering the map never re-renders the table.
// Also covers switching base maps with a big selection.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import TechnoMap from "../../../src/pages/TechnoMap/TechnoMap.jsx";
import { clearAllMapViews } from "../../../src/state/mapViewStore.js";
import { clearMapData, getMapData } from "../../../src/state/mapDataStore.js";
import { DATASET_IDS, clearCachedDataset } from "../../../src/services/cache/drillholeCache.js";
import { loadMapImages, markerCanvas, selectedRingCount } from "./canvasMap.js";

const tableRenders = vi.hoisted(() => ({ count: 0 }));

// The page loads a 5,000-hole dataset through its normal backend path.
vi.mock("../../../src/services/api/mapData.js", async (importOriginal) => {
  const actual = await importOriginal();
  const { buildPerfDataset } = await import("./perfDataset.js");

  return { ...actual, fetchTechnoMap: vi.fn(() => Promise.resolve(buildPerfDataset(5000))) };
});

// Every render of the selection table calls this hook once: a render counter.
vi.mock("../../../src/pages/TechnoMap/Table/useWindowedRows.js", async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    useWindowedRows: (ref, count, rowHeight, overscan) => {
      if (ref.current?.classList.contains("selection-table__scroll") || count > 1000) tableRenders.count += 1;

      return actual.useWindowedRows(ref, count, rowHeight, overscan);
    },
  };
});

const VIEWPORT = { width: 1000, height: 700 };

beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.PointerEvent ??= class PointerEvent extends MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  };
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
});

beforeEach(async () => {
  clearAllMapViews();
  clearMapData();
  localStorage.clear();
  await clearCachedDataset(DATASET_IDS.technoMap);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    ...VIEWPORT, top: 0, left: 0, right: VIEWPORT.width, bottom: VIEWPORT.height, x: 0, y: 0,
  });
  globalThis.fetch = vi.fn(() => new Promise(() => {}));
  tableRenders.count = 0;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const viewportOf = (container) => container.querySelector(".techno-map-page .map-viewport");
const bodyRows = (container) => container.querySelectorAll(".selection-table tbody tr[data-key]");
const selectedCount = (container) => Number(container.querySelector(".selection-table__count")?.textContent ?? 0);

/** The page with every drawn hole selected by one box over the whole map. */
async function selectEverything() {
  const result = render(<TechnoMap />);
  await waitFor(() => expect(getMapData("techno-map").records).not.toBeNull());
  await loadMapImages(result.container);
  const drawn = Number(markerCanvas(result.container).dataset.drawn);

  fireEvent.click(screen.getByRole("button", { name: "Select drillholes by area" }));
  const overlay = result.container.querySelector(".box-select");
  fireEvent.pointerDown(overlay, { clientX: 1, clientY: 1, button: 0, buttons: 1, pointerId: 1 });
  fireEvent.pointerMove(overlay, { clientX: 999, clientY: 699, buttons: 1, pointerId: 1 });
  fireEvent.pointerUp(overlay, { clientX: 999, clientY: 699, button: 0, buttons: 0, pointerId: 1 });
  fireEvent.keyDown(window, { key: "Escape" });

  return { ...result, drawn };
}

describe("5,000 selected drillholes", () => {
  it("rings them on the canvas and renders only the table rows in view", async () => {
    const { container, drawn } = await selectEverything();

    expect(drawn).toBeGreaterThan(4800);
    expect(selectedCount(container)).toBe(drawn);
    expect(selectedRingCount(container)).toBe(drawn);
    expect(container.querySelectorAll(".marker-highlight")).toHaveLength(0);
    expect(bodyRows(container).length).toBeGreaterThan(10);
    expect(bodyRows(container).length).toBeLessThan(60);
  });

  it("brings later rows in as the table scrolls", async () => {
    const { container } = await selectEverything();
    const firstKey = bodyRows(container)[0].dataset.key;
    const scroll = container.querySelector(".selection-table__scroll");

    scroll.scrollTop = 30 * 3000;
    await act(async () => fireEvent.scroll(scroll));

    const rows = bodyRows(container);
    expect(rows[0].dataset.key).not.toBe(firstKey);
    expect(rows.length).toBeLessThan(60);
    // Spacers keep the full height, so the scrollbar is right.
    const spacers = [...container.querySelectorAll(".selection-table__spacer")].map((row) => parseFloat(row.style.height));
    expect(spacers.reduce((sum, height) => sum + height, 0) + rows.length * 30).toBe(selectedCount(container) * 30);
  });

  it("exports every shown row, not just the rendered ones", async () => {
    let blob = null;
    URL.createObjectURL = vi.fn((value) => { blob = value; return "blob:test"; });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { container } = await selectEverything();

    fireEvent.click(within(container.querySelector(".selection-table")).getByRole("button", { name: /Export/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /CSV/ }));

    // jsdom's Blob has no text(); FileReader reads it.
    const text = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(blob);
    });
    const lines = text.trim().split("\r\n");
    expect(lines).toHaveLength(selectedCount(container) + 1);
  });

  it("does not re-render the table while the map is hovered, panned or zoomed", async () => {
    const { container } = await selectEverything();
    const before = tableRenders.count;
    const viewport = viewportOf(container);

    for (let i = 0; i < 20; i += 1) {
      fireEvent.pointerMove(viewport, { clientX: 100 + i * 37, clientY: 100 + i * 23, buttons: 0, pointerId: 1 });
    }
    fireEvent.wheel(viewport, { clientX: 500, clientY: 350, deltaY: -100 });
    fireEvent.pointerDown(viewport, { clientX: 500, clientY: 350, button: 0, buttons: 1, pointerId: 1 });
    fireEvent.pointerMove(viewport, { clientX: 560, clientY: 390, buttons: 1, pointerId: 1 });
    fireEvent.pointerUp(viewport, { clientX: 560, clientY: 390, button: 0, buttons: 0, pointerId: 1 });

    expect(tableRenders.count).toBe(before);
  });

  it("opens a filter menu on 5,000 keys with only the values in view", async () => {
    const { container } = await selectEverything();

    fireEvent.click(within(container.querySelector(".selection-table")).getByRole("button", { name: /^Key/ }));
    const menu = screen.getByRole("dialog", { name: "Filter Key" });
    expect(within(menu).getAllByRole("checkbox").length).toBeLessThan(60);

    // Unselect all still reaches every value, not just the rendered ones.
    fireEvent.click(within(menu).getByRole("button", { name: "Unselect all" }));
    expect(bodyRows(container)).toHaveLength(0);
  });
});

describe("base maps", () => {
  it("offers Geological (selected) and White Grid only, and switching keeps the selection", async () => {
    const { container } = await selectEverything();
    const selected = selectedCount(container);

    fireEvent.click(screen.getByRole("button", { name: "Base map" }));
    const items = within(screen.getByRole("menu", { name: "Base map" })).getAllByRole("menuitemradio");
    expect(items.map((item) => [item.textContent, item.getAttribute("aria-checked")])).toEqual([
      ["Geological Map", "true"],
      ["White Grid Map", "false"],
    ]);

    fireEvent.click(items[1]);
    expect(container.querySelector(".base-map").classList.contains("is-hidden")).toBe(true);
    expect(container.querySelector(".coordinate-grid")).not.toBeNull();
    expect(selectedCount(container)).toBe(selected);
    expect(selectedRingCount(container)).toBe(selected);
  });
});
