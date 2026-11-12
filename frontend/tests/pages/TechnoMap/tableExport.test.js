import { describe, expect, it } from "vitest";
import { TABLE_COLUMNS, applyFilters, buildRows, sortRows, visibleColumns } from "../../../src/pages/TechnoMap/utils/selectionTable.js";
import { exportBlob, exportSheet, tableExportFileName, toCsv } from "../../../src/pages/TechnoMap/utils/tableExport.js";

const feature = (key, drillhole) => ({ key, drillhole });
const ROWS = buildRows([
  feature("a", { holeId: "H-1", license: "North, East", screenLength: 12.345, startDate: "2024-03-01T00:00:00" }),
  feature("b", { holeId: "H-2", license: 'Say "hi"', screenLength: "3", startDate: null }),
  feature("c", { holeId: "H-3", license: "line\nbreak", screenLength: null, startDate: "2023-01-02" }),
]);
const COLUMNS = TABLE_COLUMNS.filter((column) => ["Key", "License", "Screen length (m)", "Start Date"].includes(column.label));

describe("exportSheet", () => {
  it("exports the shown rows, in the table's order, with only the visible columns", () => {
    const shown = sortRows(applyFilters(ROWS, { Key: new Set(["H-2"]) }), { column: "Key", direction: "desc" });
    const columns = visibleColumns(COLUMNS, new Set(["License"]));
    const sheet = exportSheet(shown, columns);

    expect(sheet.header).toEqual(["Key", "Screen length (m)", "Start Date"]);
    expect(sheet.rows.map((row) => row[0])).toEqual(["H-3", "H-1"]);
  });

  it("keeps raw numbers for number columns, display text elsewhere, and null for empty cells", () => {
    const sheet = exportSheet(ROWS, COLUMNS);

    expect(sheet.rows[0]).toEqual(["H-1", "North, East", 12.345, "2024-03-01"]);
    expect(sheet.rows[1][2]).toBe(3);
    expect(sheet.rows[1][3]).toBeNull();
    expect(sheet.rows[2][2]).toBeNull();
  });
});

describe("toCsv", () => {
  it("starts with a BOM, uses CRLF, and quotes commas, quotes and line breaks", () => {
    const csv = toCsv(exportSheet(ROWS, COLUMNS));

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Key,License,Screen length (m),Start Date");
    expect(lines[1]).toBe('H-1,"North, East",12.345,2024-03-01');
    expect(lines[2]).toBe('H-2,"Say ""hi""",3,');
    expect(csv).toContain('"line\nbreak"');
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});

describe("files", () => {
  it("names files like the map export, with the format's extension", () => {
    const date = new Date(2026, 10, 12, 9, 5, 7);
    expect(tableExportFileName("xlsx", date)).toBe("TechnoMap_selection_2026-11-12_09-05-07.xlsx");
    expect(tableExportFileName("csv", date)).toBe("TechnoMap_selection_2026-11-12_09-05-07.csv");
  });

  it("makes a CSV or spreadsheet blob with the right type", () => {
    const sheet = exportSheet(ROWS, COLUMNS);
    expect(exportBlob("csv", sheet).type).toBe("text/csv;charset=utf-8");
    expect(exportBlob("xlsx", sheet).type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });
});
