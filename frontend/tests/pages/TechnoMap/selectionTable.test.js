import { describe, expect, it } from "vitest";
import {
  BLANK,
  TABLE_COLUMNS,
  applyFilters,
  buildRows,
  columnWidths,
  distinctValues,
  isColumnFiltered,
  parseHiddenColumns,
  setColumnFilter,
  sortRows,
  toggleHidden,
  visibleColumns,
} from "../../../src/pages/TechnoMap/utils/selectionTable.js";

/** Just enough of a MarkerFeature for the table: a key and a record. */
const feature = (key, drillhole) => ({ key, drillhole });

const ROWS = buildRows([
  feature("a", { holeId: "H-10", license: "North", screenLength: 12.5, startDate: "2024-03-01" }),
  feature("b", { holeId: "H-2", license: "south", screenLength: "3", startDate: "2023-11-20T08:00:00" }),
  feature("c", { holeId: "H-1", license: null, screenLength: 100, startDate: "" }),
  feature("d", { HoleId: "H-3", License: "North", ScreenLength: null, StartDate: "2025-01-05" }),
]);
const keys = (rows) => rows.map((row) => row.key);

describe("columns", () => {
  it("are the popup fields that have a data source", () => {
    const labels = TABLE_COLUMNS.map((column) => column.label);
    expect(labels[0]).toBe("Key");
    expect(labels).toContain("Screen length (m)");
    expect(labels).not.toContain("Z (m)");
    expect(labels).not.toContain("Mining level");
  });
});

describe("buildRows", () => {
  it("formats cells like the popup and keeps raw numbers to sort by", () => {
    const [a, b] = ROWS;
    expect(a.cells.Key).toBe("H-10");
    expect(b.sortValues["Screen length (m)"]).toBe(3);
    expect(a.cells["Start Date"]).toBe("2024-03-01");
    expect(ROWS[3].cells.License).toBe("North");
    expect(ROWS[2].cells.License).toBeNull();
  });
});

describe("distinctValues", () => {
  it("lists each value once with its count, sorted, blanks last", () => {
    expect(distinctValues(ROWS, "License")).toEqual([
      { value: "North", count: 2 },
      { value: "south", count: 1 },
      { value: BLANK, count: 1 },
    ]);
  });

  it("orders a number column numerically, not as text", () => {
    expect(distinctValues(ROWS, "Screen length (m)").map(({ count, value }) => [value === BLANK ? BLANK : Number(value.replace(/[^\d.]/g, "")), count]))
      .toEqual([[3, 1], [12.5, 1], [100, 1], [BLANK, 1]]);
  });
});

describe("applyFilters", () => {
  it("shows everything with no exclusions", () => {
    expect(keys(applyFilters(ROWS, {}))).toEqual(["a", "b", "c", "d"]);
  });

  it("hides rows whose value is excluded, blanks included", () => {
    expect(keys(applyFilters(ROWS, { License: new Set(["North"]) }))).toEqual(["b", "c"]);
    expect(keys(applyFilters(ROWS, { License: new Set([BLANK]) }))).toEqual(["a", "b", "d"]);
  });

  it("combines columns, and Unselect all (every value excluded) empties the table", () => {
    const all = new Set(distinctValues(ROWS, "License").map(({ value }) => value));
    expect(applyFilters(ROWS, { License: all })).toEqual([]);
    expect(keys(applyFilters(ROWS, { License: new Set(["south"]), Key: new Set(["H-3"]) }))).toEqual(["a", "c"]);
  });

  it("Select all (an empty set) removes the column's filter", () => {
    const filtered = setColumnFilter({}, "License", new Set(["North"]));
    expect(isColumnFiltered(filtered, "License")).toBe(true);
    const cleared = setColumnFilter(filtered, "License", new Set());
    expect(isColumnFiltered(cleared, "License")).toBe(false);
    expect(cleared).toEqual({});
  });
});

describe("sortRows", () => {
  it("keeps selection order with no sort", () => {
    expect(keys(sortRows(ROWS, null))).toEqual(["a", "b", "c", "d"]);
  });

  it("sorts text A-Z and Z-A, case-insensitively and with natural numbers", () => {
    expect(keys(sortRows(ROWS, { column: "Key", direction: "asc" }))).toEqual(["c", "b", "d", "a"]);
    expect(keys(sortRows(ROWS, { column: "Key", direction: "desc" }))).toEqual(["a", "d", "b", "c"]);
    expect(keys(sortRows(ROWS, { column: "License", direction: "asc" }))).toEqual(["a", "d", "b", "c"]);
  });

  it("sorts numbers ascending and descending, blanks always last", () => {
    expect(keys(sortRows(ROWS, { column: "Screen length (m)", direction: "asc" }))).toEqual(["b", "a", "c", "d"]);
    expect(keys(sortRows(ROWS, { column: "Screen length (m)", direction: "desc" }))).toEqual(["c", "a", "b", "d"]);
  });

  it("sorts dates chronologically", () => {
    expect(keys(sortRows(ROWS, { column: "Start Date", direction: "asc" }))).toEqual(["b", "a", "d", "c"]);
    expect(keys(sortRows(ROWS, { column: "Start Date", direction: "desc" }))).toEqual(["d", "a", "b", "c"]);
  });
});

describe("column visibility", () => {
  const labels = (columns) => columns.map((column) => column.label);

  it("hides and shows columns, keeping table order", () => {
    const hidden = toggleHidden(new Set(), "License");
    expect(labels(visibleColumns(TABLE_COLUMNS, hidden))).not.toContain("License");
    expect(labels(visibleColumns(TABLE_COLUMNS, toggleHidden(hidden, "License")))).toEqual(labels(TABLE_COLUMNS));
  });

  it("never hides the last visible column", () => {
    const allButKey = new Set(TABLE_COLUMNS.map((column) => column.label).filter((label) => label !== "Key"));
    expect(toggleHidden(allButKey, "Key")).toBe(allButKey);
  });

  it("reads stored labels, dropping unknown ones and an everything-hidden list", () => {
    expect([...parseHiddenColumns(["License", "Nope", 3])]).toEqual(["License"]);
    expect(parseHiddenColumns(TABLE_COLUMNS.map((column) => column.label)).size).toBe(0);
    expect(parseHiddenColumns("x").size).toBe(0);
  });
});

describe("thousands of rows", () => {
  it("builds each hole's row once and reuses it", () => {
    const hole = feature("x", { holeId: "H-9" });
    const [first] = buildRows([hole]);
    const [again] = buildRows([feature("y", { holeId: "H-8" }), hole]).slice(1);

    expect(again).toBe(first);
  });

  it("sizes each column to its longest cell or header, within limits", () => {
    const columns = TABLE_COLUMNS.filter((column) => ["Key", "License"].includes(column.label));
    const rows = buildRows([
      feature("p", { holeId: "H-1", license: "x".repeat(80) }),
      feature("q", { holeId: "GTZO-123456789", license: null }),
    ]);
    const widths = columnWidths(rows, columns);

    expect(widths.Key).toBe("GTZO-123456789".length);
    expect(widths.License).toBe(40);
    expect(columnWidths([], columns).Key).toBe("Key".length + 4 < 6 ? 6 : "Key".length + 4);
  });
});
