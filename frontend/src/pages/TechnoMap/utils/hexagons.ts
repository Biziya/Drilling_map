// Production-cell hexagons from an uploaded wellfield design.
//
//   row    -> one well: Type, X [m], Y [m], Associated production cells
//   cell   -> every well that lists it in "Associated production cells"
//             (e.g. CZO_457_063_50_A); producers and monitoring wells sit
//             inside a cell, so only the other wells (injectors) outline it
//   shape  -> the cell's wells in angle order round their centre, closed
//
// A cell with fewer than three wells cannot be drawn and is skipped.

import type { ReadCell, ReadTable } from './xlsxRead';
import type { UtmCoordinates } from '../../../types/map';

export interface HexCell {
  /** The production cell's name, as in the file. */
  id: string;
  /** The outline's corners in UTM metres, in drawing order. */
  points: UtmCoordinates[];
}

export interface HexagonResult {
  cells: HexCell[];
  /** Cells named in the file with fewer than three wells. */
  skipped: number;
}

/** Wells inside a cell, not on its outline. */
const INNER_TYPES = new Set(['producer', 'monitoring']);

const normalise = (text: string) => text.toLowerCase().replace(/[\s_]+/g, ' ').trim();

/** The first column whose header matches one of `names` (case and spacing ignored). */
function findColumn(header: readonly string[], names: readonly string[], label: string): number {
  const wanted = names.map(normalise);
  const index = header.findIndex((title) => wanted.includes(normalise(title)));
  if (index < 0) throw new Error(`The file has no "${label}" column.`);

  return index;
}

function toNumber(value: ReadCell | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));

  return Number.isFinite(parsed) ? parsed : null;
}

/** Points ordered by angle round their centroid: a clean outline for a convex cell. */
export function orderAroundCentre(points: readonly UtmCoordinates[]): UtmCoordinates[] {
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;

  return [...points].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

export function buildHexagons({ header, rows }: ReadTable): HexagonResult {
  const cellCol = findColumn(header, ['Associated production cells', 'Associated production cell', 'Associated'], 'Associated production cells');
  const xCol = findColumn(header, ['X [m]', 'X'], 'X [m]');
  const yCol = findColumn(header, ['Y [m]', 'Y'], 'Y [m]');
  const typeIndex = header.findIndex((title) => normalise(title) === 'type');

  const byCell = new Map<string, UtmCoordinates[]>();
  for (const row of rows) {
    const type = typeIndex >= 0 ? String(row[typeIndex] ?? '').trim().toLowerCase() : '';
    if (INNER_TYPES.has(type)) continue;
    const x = toNumber(row[xCol]);
    const y = toNumber(row[yCol]);
    if (x === null || y === null) continue;

    const names = String(row[cellCol] ?? '').split(/[,;]/).map((name) => name.trim()).filter(Boolean);
    for (const name of new Set(names)) {
      const points = byCell.get(name) ?? [];
      // The same corner twice (a duplicate row) would draw a spike.
      if (!points.some((p) => p.x === x && p.y === y)) points.push({ x, y });
      byCell.set(name, points);
    }
  }

  const cells: HexCell[] = [];
  let skipped = 0;
  for (const [id, points] of byCell) {
    if (points.length < 3) skipped += 1;
    else cells.push({ id, points: orderAroundCentre(points) });
  }

  return { cells, skipped };
}

/** A stored upload, or null when `value` is not one. */
export function parseStoredHexagons(value: unknown): { fileName: string; cells: HexCell[] } | null {
  if (typeof value !== 'object' || value === null) return null;
  const { fileName, cells } = value as Record<string, unknown>;
  if (typeof fileName !== 'string' || !Array.isArray(cells)) return null;

  const valid = cells.filter((cell): cell is HexCell => typeof cell === 'object' && cell !== null
    && typeof (cell as HexCell).id === 'string' && Array.isArray((cell as HexCell).points)
    && (cell as HexCell).points.every((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)));

  return { fileName, cells: valid };
}
