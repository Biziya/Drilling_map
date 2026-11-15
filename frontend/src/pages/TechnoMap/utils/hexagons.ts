// Production-cell hexagons from an uploaded wellfield design.
//
//   row    -> one well: Type, X [m], Y [m], Associated production cells
//   cell   -> every well that lists it in "Associated production cells"
//             (e.g. CZO_457_063_50_A); producers and monitoring wells sit
//             inside a cell, so only the other wells (injectors) outline it
//   shape  -> the cell's wells in angle order round their centre, closed
//
// A cell with fewer than three wells cannot be drawn and is skipped.
//
// The file holds design positions; drilled wells sit a few metres off. Each
// corner keeps its well name so snapHexagons can move it onto the drilled
// (database) position at draw time.

import type { ReadCell, ReadTable } from './xlsxRead';
import { readDrillholeText, readDrillholeValue } from '../../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../../types/drillhole';
import type { UtmCoordinates } from '../../../types/map';

/** One outline corner: a well position in UTM metres, with its name when the file has one. */
export interface HexCorner extends UtmCoordinates {
  name?: string;
}

export interface HexCell {
  /** The production cell's name, as in the file. */
  id: string;
  /** The outline's corners in UTM metres, in drawing order. */
  points: HexCorner[];
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
export function orderAroundCentre<T extends UtmCoordinates>(points: readonly T[]): T[] {
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;

  return [...points].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

export function buildHexagons({ header, rows }: ReadTable): HexagonResult {
  const cellCol = findColumn(header, ['Associated production cells', 'Associated production cell', 'Associated'], 'Associated production cells');
  const xCol = findColumn(header, ['X [m]', 'X'], 'X [m]');
  const yCol = findColumn(header, ['Y [m]', 'Y'], 'Y [m]');
  const typeIndex = header.findIndex((title) => normalise(title) === 'type');
  const nameIndex = header.findIndex((title) => ['name', 'hole id', 'holeid', 'well'].includes(normalise(title)));

  const byCell = new Map<string, HexCorner[]>();
  for (const row of rows) {
    const type = typeIndex >= 0 ? String(row[typeIndex] ?? '').trim().toLowerCase() : '';
    if (INNER_TYPES.has(type)) continue;
    const x = toNumber(row[xCol]);
    const y = toNumber(row[yCol]);
    if (x === null || y === null) continue;

    const wellName = nameIndex >= 0 ? String(row[nameIndex] ?? '').trim() : '';
    const corner: HexCorner = wellName ? { x, y, name: wellName } : { x, y };
    const names = String(row[cellCol] ?? '').split(/[,;]/).map((name) => name.trim()).filter(Boolean);
    for (const name of new Set(names)) {
      const points = byCell.get(name) ?? [];
      // The same corner twice (a duplicate row) would draw a spike.
      if (!points.some((p) => p.x === x && p.y === y)) points.push(corner);
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
    && (cell as HexCell).points.every((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)
      && (p.name === undefined || typeof p.name === 'string')));

  return { fileName, cells: valid };
}

/** A well name for matching: upper case, without the trailing "_" the database adds. */
export function wellKey(name: string): string {
  return name.trim().toUpperCase().replace(/_+$/, '');
}

export interface SnapResult {
  cells: HexCell[];
  /** Corners moved onto a drilled well. */
  moved: number;
  /** Named corners with no drilled well on the map: left at the design position. */
  unmatched: number;
  /** The largest move, in metres. */
  maxShift: number;
}

/**
 * Moves each corner onto the map well of the same name, so cell edges pass
 * through the drilled injectors rather than their design positions. Corners
 * with no matching well (not drilled yet, or no name) keep the file position.
 */
export function snapHexagons(cells: readonly HexCell[], drillholes: readonly DrillholeApiRecord[]): SnapResult {
  const wells = new Map<string, UtmCoordinates>();
  for (const hole of drillholes) {
    const id = readDrillholeText(hole, 'holeId');
    const x = Number(readDrillholeValue(hole, 'x'));
    const y = Number(readDrillholeValue(hole, 'y'));
    if (!id || !Number.isFinite(x) || !Number.isFinite(y) || readDrillholeValue(hole, 'x') === undefined || readDrillholeValue(hole, 'y') === undefined) continue;
    wells.set(wellKey(id), { x, y });
  }

  let moved = 0;
  let unmatched = 0;
  let maxShift = 0;
  const snapped = cells.map((cell) => {
    let changed = false;
    const points = cell.points.map((corner) => {
      if (!corner.name) return corner;
      const well = wells.get(wellKey(corner.name));
      if (!well) {
        unmatched += 1;
        return corner;
      }
      const shift = Math.hypot(well.x - corner.x, well.y - corner.y);
      if (shift === 0) return corner;
      moved += 1;
      maxShift = Math.max(maxShift, shift);
      changed = true;
      return { ...corner, x: well.x, y: well.y };
    });

    return changed ? { ...cell, points: orderAroundCentre(points) } : cell;
  });

  return { cells: snapped, moved, unmatched, maxShift };
}

/** "12 corners moved to drilled wells (max 4.2 m) · 3 at design position", or null when nothing to say. */
export function describeSnap({ moved = 0, unmatched = 0, maxShift = 0 }: Partial<Pick<SnapResult, 'moved' | 'unmatched' | 'maxShift'>>): string | null {
  const parts: string[] = [];
  if (moved) parts.push(`${moved} corner${moved === 1 ? '' : 's'} moved to drilled wells (max ${maxShift.toFixed(1)} m)`);
  if (unmatched) parts.push(`${unmatched} at design position`);

  return parts.length ? parts.join(' · ') : null;
}
