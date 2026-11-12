import { describe, expect, it } from "vitest";
import { buildXlsx, columnName, crc32, escapeXml, sheetXml } from "../../../src/pages/TechnoMap/utils/xlsx.js";

/** Reads a stored (uncompressed) ZIP: every local entry's name, data and CRC check. */
function readZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const entries = {};
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    expect(view.getUint16(at + 8, true)).toBe(0); // stored
    const crc = view.getUint32(at + 14, true);
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const name = decoder.decode(bytes.subarray(at + 30, at + 30 + nameLength));
    const data = bytes.subarray(at + 30 + nameLength, at + 30 + nameLength + size);
    expect(crc32(data)).toBe(crc);
    entries[name] = decoder.decode(data);
    at += 30 + nameLength + size;
  }
  // Central directory follows, then the end record.
  expect(view.getUint32(at, true)).toBe(0x02014b50);
  expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
  expect(view.getUint16(bytes.length - 12, true)).toBe(Object.keys(entries).length);

  return entries;
}

const SHEET = { name: "Selection", header: ["Key", "Depth (m)"], rows: [["H<1>&", 12.5], [null, 3], ["Zoë", null]] };

describe("crc32", () => {
  it("matches the standard check value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
});

describe("columnName", () => {
  it("counts A..Z, then AA", () => {
    expect([0, 25, 26, 27, 51, 52].map(columnName)).toEqual(["A", "Z", "AA", "AB", "AZ", "BA"]);
  });
});

describe("buildXlsx", () => {
  it("is a valid ZIP holding every part a workbook needs", () => {
    const entries = readZip(buildXlsx(SHEET));

    expect(Object.keys(entries)).toEqual(expect.arrayContaining([
      "[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml",
    ]));
    expect(entries["xl/workbook.xml"]).toContain('name="Selection"');
  });

  it("writes a bold frozen header, numbers as numbers, and escaped text", () => {
    const xml = readZip(buildXlsx(SHEET))["xl/worksheets/sheet1.xml"];

    expect(xml).toContain('state="frozen"');
    expect(xml).toContain('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Key</t></is></c>');
    expect(xml).toContain('<c r="B2"><v>12.5</v></c>');
    expect(xml).toContain("H&lt;1&gt;&amp;");
    expect(xml).toContain("Zoë");
    // Empty cells are left out, not written as blanks.
    expect(xml).not.toContain('r="A3"');
  });
});

describe("escapeXml / sheetXml", () => {
  it("drops characters XML cannot hold", () => {
    expect(escapeXml("a\u0001b\"c")).toBe("ab&quot;c");
    expect(sheetXml({ name: "S", header: ["x"], rows: [["\u0007bell"]] })).toContain(">bell<");
  });
});
