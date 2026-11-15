import { describe, expect, it } from "vitest";
import { buildXlsx, zipStored } from "../../../src/pages/TechnoMap/utils/xlsx";
import { columnIndex, readXlsx } from "../../../src/pages/TechnoMap/utils/xlsxRead";
import { buildHexagons, orderAroundCentre, parseStoredHexagons } from "../../../src/pages/TechnoMap/utils/hexagons";

const HEADER = ["Name", "Type", "X [m]", "Y [m]", "Associated production cells"];

/** Six injectors round (0, 0), radius 10, listed out of angle order. */
const RING = [0, 3, 1, 4, 2, 5].map((k) => {
  const angle = (k * Math.PI) / 3;

  return [Math.round(10 * Math.cos(angle) * 1000) / 1000, Math.round(10 * Math.sin(angle) * 1000) / 1000];
});

const injectorRows = RING.map(([x, y], index) => [`IZO_${index}`, "Injector", x, y, "CZO_A"]);

async function deflateRaw(bytes) {
  const stream = new Response(bytes).body.pipeThrough(new CompressionStream("deflate-raw"));

  return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe("xlsx reader", () => {
  it("reads back a workbook made by the in-house writer", async () => {
    const bytes = buildXlsx({ name: "Wells", header: HEADER, rows: [["IZO_1", "Injector", 421099.5, 4893621, "CZO_A,CZO_B"]] });
    const table = await readXlsx(bytes.buffer);

    expect(table.header).toEqual(HEADER);
    expect(table.rows).toEqual([["IZO_1", "Injector", 421099.5, 4893621, "CZO_A,CZO_B"]]);
  });

  it("reads deflated parts, shared strings and gaps between cells", async () => {
    const encoder = new TextEncoder();
    const sheet = '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
      + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>'
      + '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>12.5</v></c></row>'
      + "</sheetData></worksheet>";
    const shared = '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      + "<si><t>Name</t></si><si><r><t>X </t></r><r><t>[m]</t></r></si><si><t>IZO_1</t></si></sst>";
    const files = [
      { name: "xl/worksheets/sheet1.xml", data: encoder.encode(sheet) },
      { name: "xl/sharedStrings.xml", data: encoder.encode(shared) },
    ];
    const zip = await deflatedZip(files);
    const table = await readXlsx(zip.buffer);

    expect(table.header).toEqual(["Name", "", "X [m]"]);
    expect(table.rows).toEqual([["IZO_1", null, 12.5]]);
  });

  it("rejects a file that is not a workbook", async () => {
    await expect(readXlsx(new TextEncoder().encode("Name;X;Y\n").buffer)).rejects.toThrow(/not an Excel/);
  });

  it("turns cell references into column indexes", () => {
    expect(columnIndex("A1")).toBe(0);
    expect(columnIndex("Z9")).toBe(25);
    expect(columnIndex("AB7")).toBe(27);
  });
});

/** A ZIP whose entries are deflated: zipStored's layout with method 8 and the compressed bytes. */
async function deflatedZip(files) {
  const deflated = await Promise.all(files.map(async (file) => ({ ...file, packed: await deflateRaw(file.data) })));
  // Build a stored ZIP of the packed bytes, then patch method and uncompressed size in both headers.
  const zip = zipStored(deflated.map(({ name, packed }) => ({ name, data: packed })));
  const view = new DataView(zip.buffer);
  for (let at = 0; at < zip.length - 4; at += 1) {
    const signature = view.getUint32(at, true);
    if (signature === 0x04034b50) view.setUint16(at + 8, 8, true);
    if (signature === 0x02014b50) view.setUint16(at + 10, 8, true);
  }

  return zip;
}

describe("hexagons", () => {
  it("outlines each cell through the wells that list it, in angle order", () => {
    const { cells, skipped } = buildHexagons({
      header: HEADER,
      rows: [
        ...injectorRows,
        ["PZO_A", "Producer", 0, 0, "CZO_A"],
        ["MZO_A", "Monitoring", 1, 1, ""],
      ],
    });

    expect(skipped).toBe(0);
    expect(cells).toHaveLength(1);
    expect(cells[0].id).toBe("CZO_A");
    expect(cells[0].points).toHaveLength(6);
    const angles = cells[0].points.map(({ x, y }) => Math.atan2(y, x));
    expect([...angles].sort((a, b) => a - b)).toEqual(angles);
  });

  it("puts a well shared by several cells on each of them", () => {
    const { cells } = buildHexagons({
      header: HEADER,
      rows: [
        ["I1", "Injector", 0, 0, "C1, C2"],
        ["I2", "Injector", 10, 0, "C1;C2"],
        ["I3", "Injector", 5, 8, "C1"],
        ["I4", "Injector", 5, -8, "C2"],
      ],
    });

    expect(cells.map(({ id }) => id).sort()).toEqual(["C1", "C2"]);
  });

  it("skips cells with fewer than three wells and rows without coordinates", () => {
    const { cells, skipped } = buildHexagons({
      header: HEADER,
      rows: [
        ["I1", "Injector", 0, 0, "C1"],
        ["I2", "Injector", 10, 0, "C1"],
        ["I3", "Injector", null, 8, "C1"],
      ],
    });

    expect(cells).toEqual([]);
    expect(skipped).toBe(1);
  });

  it("matches headers whatever their case and spacing, and accepts text numbers", () => {
    const { cells } = buildHexagons({
      header: ["type", "x", "Y", "ASSOCIATED  PRODUCTION CELLS"],
      rows: [["Injector", "0", "0", "C"], ["Injector", "10,5", "0", "C"], ["Injector", "5", "8", "C"]],
    });

    expect(cells[0].points).toContainEqual({ x: 10.5, y: 0 });
  });

  it("names a missing column", () => {
    expect(() => buildHexagons({ header: ["Name", "X [m]", "Y [m]"], rows: [] })).toThrow(/Associated production cells/);
  });

  it("orders points round their centre", () => {
    const ordered = orderAroundCentre([{ x: 1, y: 1 }, { x: -1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: -1 }]);

    expect(ordered).toEqual([{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }]);
  });

  it("restores a stored upload and drops malformed cells", () => {
    const stored = { fileName: "wells.xlsx", cells: [{ id: "C", points: [{ x: 1, y: 2 }] }, { id: 3 }, null] };

    expect(parseStoredHexagons(stored)).toEqual({ fileName: "wells.xlsx", cells: [{ id: "C", points: [{ x: 1, y: 2 }] }] });
    expect(parseStoredHexagons(null)).toBeNull();
    expect(parseStoredHexagons({ cells: [] })).toBeNull();
  });
});
