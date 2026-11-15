// A minimal .xlsx reader: the first sheet's header row and data rows, as text
// and numbers. The counterpart of the in-house writer (xlsx.ts), kept
// dependency-free: the ZIP is walked by hand and deflated parts are inflated
// with the browser's DecompressionStream. Formulas give their cached value;
// formatting, merged cells and dates-as-dates are not interpreted.

export type ReadCell = string | number | null;

export interface ReadTable {
  header: string[];
  rows: ReadCell[][];
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/** Every ZIP entry's name → a function that reads its bytes. */
function zipEntries(bytes: Uint8Array): Map<string, () => Promise<Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end-of-central-directory record is within the last 22 + 65535 bytes.
  let eocd = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 0xffff); at -= 1) {
    if (view.getUint32(at, true) === EOCD_SIGNATURE) {
      eocd = at;
      break;
    }
  }
  if (eocd < 0) throw new Error('The file is not an Excel .xlsx workbook.');

  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries = new Map<string, () => Promise<Uint8Array>>();

  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(at, true) !== CENTRAL_SIGNATURE) throw new Error('The .xlsx file is damaged.');
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localOffset = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));

    entries.set(name, async () => {
      if (view.getUint32(localOffset, true) !== LOCAL_SIGNATURE) throw new Error('The .xlsx file is damaged.');
      const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
      const data = bytes.subarray(start, start + compressedSize);
      if (method === 0) return data;
      if (method !== 8) throw new Error('The .xlsx file uses an unsupported compression.');

      return inflateRaw(data);
    });
    at += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const body = new Response(data as BodyInit).body;
  if (!body) throw new Error('The .xlsx file could not be read.');
  const stream = body.pipeThrough(new DecompressionStream('deflate-raw'));

  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('The .xlsx file is damaged.');

  return doc;
}

/** Elements by local name, whatever namespace prefix the file uses. */
const byName = (node: Document | Element, name: string) => Array.from(node.getElementsByTagNameNS('*', name));

/** Column index from a cell reference: A1 → 0, AB7 → 27. */
export function columnIndex(ref: string): number {
  let index = 0;
  for (const char of ref.toUpperCase()) {
    if (char < 'A' || char > 'Z') break;
    index = index * 26 + (char.charCodeAt(0) - 64);
  }

  return index - 1;
}

/** All text of a shared or inline string, rich-text runs joined. */
const stringText = (node: Element) => byName(node, 't').map((t) => t.textContent ?? '').join('');

/** The workbook's first sheet: its part path inside the ZIP. */
async function firstSheetPath(read: (name: string) => Promise<string | null>): Promise<string> {
  const fallback = 'xl/worksheets/sheet1.xml';
  const [workbook, rels] = await Promise.all([read('xl/workbook.xml'), read('xl/_rels/workbook.xml.rels')]);
  if (!workbook || !rels) return fallback;

  const sheet = byName(parseXml(workbook), 'sheet')[0];
  const id = sheet && Array.from(sheet.attributes).find((attr) => attr.localName === 'id' && attr.prefix)?.value;
  const target = byName(parseXml(rels), 'Relationship').find((rel) => rel.getAttribute('Id') === id)?.getAttribute('Target');
  if (!target) return fallback;

  return target.startsWith('/') ? target.slice(1) : `xl/${target}`;
}

/** The first sheet of an .xlsx file: row 1 as the header, the rest as rows. */
export async function readXlsx(buffer: ArrayBuffer): Promise<ReadTable> {
  const entries = zipEntries(new Uint8Array(buffer));
  const decoder = new TextDecoder();
  const read = async (name: string) => {
    const entry = entries.get(name);

    return entry ? decoder.decode(await entry()) : null;
  };

  const sheetPath = await firstSheetPath(read);
  const [sheetText, sharedText] = await Promise.all([read(sheetPath), read('xl/sharedStrings.xml')]);
  if (!sheetText) throw new Error('The workbook has no sheet.');
  const shared = sharedText ? byName(parseXml(sharedText), 'si').map(stringText) : [];

  const grid: ReadCell[][] = byName(parseXml(sheetText), 'row').map((row) => {
    const cells: ReadCell[] = [];
    byName(row, 'c').forEach((cell, position) => {
      const ref = cell.getAttribute('r');
      const col = ref ? columnIndex(ref) : position;
      const type = cell.getAttribute('t');
      const raw = byName(cell, 'v')[0]?.textContent ?? null;
      let value: ReadCell = null;
      if (type === 's') value = raw === null ? null : (shared[Number(raw)] ?? null);
      else if (type === 'inlineStr') value = stringText(cell);
      else if (type === 'str' || type === 'e') value = raw;
      else if (type === 'b') value = raw === null ? null : Number(raw);
      else if (raw !== null && raw !== '') value = Number.isFinite(Number(raw)) ? Number(raw) : raw;
      cells[col] = value;
    });

    return Array.from(cells, (value) => value ?? null);
  });

  const [header = [], ...rows] = grid;

  return { header: header.map((value) => (value === null ? '' : String(value).trim())), rows };
}
