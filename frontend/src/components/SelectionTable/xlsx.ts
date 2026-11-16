// A minimal .xlsx writer: one sheet, a bold frozen header row, text and number
// cells. An .xlsx file is a ZIP of a few XML parts; entries are stored without
// compression, which every spreadsheet program reads. Kept in-house so the
// table export adds no dependency.

export type SheetCell = string | number | null;

export interface Sheet {
  name: string;
  header: readonly string[];
  rows: readonly (readonly SheetCell[])[];
}

// --- ZIP (stored) -----------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }

  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);

  return (crc ^ 0xffffffff) >>> 0;
}

/** DOS time and date fields for a ZIP entry. */
function dosDateTime(date: Date): { time: number; day: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/** A ZIP archive of the given files, stored (no compression), names in UTF-8. */
export function zipStored(files: readonly { name: string; data: Uint8Array }[], date = new Date()): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const { time, day } = dosDateTime(date);
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, time, true);
    lv.setUint16(12, day, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    locals.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, day, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);

    offset += local.length + data.length;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, end];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }

  return out;
}

// --- Workbook XML ------------------------------------------------------------

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** XML-escapes text and drops characters XML 1.0 does not allow. */
export function escapeXml(text: string): string {
  return text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Spreadsheet column letters: 0 → A, 25 → Z, 26 → AA. */
export function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;

  return name;
}

function cellXml(value: SheetCell, ref: string, bold: boolean): string {
  const style = bold ? ' s="1"' : '';
  if (value === null || value === '') return bold ? `<c r="${ref}"${style}/>` : '';
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;

  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

/** Column widths in characters, from the longest value, within sensible limits. */
function columnWidths(sheet: Sheet): number[] {
  return sheet.header.map((title, index) => {
    const longest = sheet.rows.reduce((max, row) => Math.max(max, String(row[index] ?? '').length), title.length);

    return Math.min(60, Math.max(8, longest + 2));
  });
}

export function sheetXml(sheet: Sheet): string {
  const cols = columnWidths(sheet)
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join('');
  const rows = [sheet.header, ...sheet.rows].map((row, rowIndex) => {
    const cells = row.map((value, col) => cellXml(value, `${columnName(col)}${rowIndex + 1}`, rowIndex === 0)).join('');

    return `<row r="${rowIndex + 1}">${cells}</row>`;
  });

  return `${XML_HEAD}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + `<cols>${cols}</cols><sheetData>${rows.join('')}</sheetData></worksheet>`;
}

/** Sheet names: at most 31 characters, none of : \ / ? * [ ]. */
const safeSheetName = (name: string) => name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Sheet1';

/** The .xlsx file's bytes. */
export function buildXlsx(sheet: Sheet, date = new Date()): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const parts: Record<string, string> = {
    '[Content_Types].xml': `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + '</Types>',
    '_rels/.rels': `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + '</Relationships>',
    'xl/workbook.xml': `${XML_HEAD}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
      + `<sheets><sheet name="${escapeXml(safeSheetName(sheet.name))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
      + '</Relationships>',
    // Style 0: default; style 1: bold header on a light green fill.
    'xl/styles.xml': `${XML_HEAD}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
      + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
      + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
      + '<fill><patternFill patternType="solid"><fgColor rgb="FFEDF3EF"/><bgColor indexed="64"/></patternFill></fill></fills>'
      + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
      + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
      + '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
      + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>'
      + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
      + '</styleSheet>',
    'xl/worksheets/sheet1.xml': sheetXml(sheet),
  };

  return zipStored(Object.entries(parts).map(([name, xml]) => ({ name, data: encoder.encode(xml) })), date);
}
