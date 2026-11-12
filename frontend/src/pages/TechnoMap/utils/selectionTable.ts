// The selection table's data: rows for the selected holes, Excel-style column
// filters (a set of excluded values per column) and a single-column sort.
// Pure, so the page and its tests share one implementation.

import { TOOLTIP_FIELDS } from './tooltipFields';
import type { DrillholeColumn } from './tooltipFields';
import type { MarkerFeature } from './markerLayer';

/** The filter-list entry for an empty cell. */
export const BLANK = '(Blank)';

/** The table's columns: every popup field that has a data source. */
export const TABLE_COLUMNS: readonly DrillholeColumn[] = TOOLTIP_FIELDS.filter((column) => column.available);

export interface TableRow {
  key: string;
  feature: MarkerFeature;
  /** Formatted cell text by column label; null for an empty cell. */
  cells: Readonly<Record<string, string | null>>;
  /** What each column sorts by: the raw number for 'number' columns, else the text. */
  sortValues: Readonly<Record<string, number | string | null>>;
}

/** Excluded values per column label. A missing or empty set: every value shown. */
export type ColumnFilters = Readonly<Record<string, ReadonlySet<string>>>;

export type SortDirection = 'asc' | 'desc';
export interface SortState {
  column: string;
  direction: SortDirection;
}

export function buildRows(features: readonly MarkerFeature[], columns = TABLE_COLUMNS): TableRow[] {
  return features.map((feature) => {
    const cells: Record<string, string | null> = {};
    const sortValues: Record<string, number | string | null> = {};
    for (const column of columns) {
      const text = column.read(feature.drillhole);
      cells[column.label] = text;
      sortValues[column.label] = column.sort === 'number' && column.sortValue ? column.sortValue(feature.drillhole) : text;
    }

    return { key: feature.key, feature, cells, sortValues };
  });
}

/** The value a cell contributes to its column's filter list. */
export const filterValueOf = (row: TableRow, column: string): string => row.cells[column] ?? BLANK;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Ascending comparison of two non-null sort values. */
function compareValues(a: number | string, b: number | string): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;

  return collator.compare(String(a), String(b));
}

export interface DistinctValue {
  value: string;
  count: number;
}

/**
 * Every value in a column across `rows`, each once with how many rows hold it,
 * in the column's ascending order; (Blank) last.
 */
export function distinctValues(rows: readonly TableRow[], column: string): DistinctValue[] {
  const entries = new Map<string, { count: number; sort: number | string | null }>();
  for (const row of rows) {
    const value = filterValueOf(row, column);
    const entry = entries.get(value);
    if (entry) entry.count += 1;
    else entries.set(value, { count: 1, sort: row.cells[column] === null ? null : row.sortValues[column] ?? null });
  }

  return [...entries]
    .sort(([, a], [, b]) => {
      if (a.sort === null || b.sort === null) return (a.sort === null ? 1 : 0) - (b.sort === null ? 1 : 0);

      return compareValues(a.sort, b.sort);
    })
    .map(([value, { count }]) => ({ value, count }));
}

export const isColumnFiltered = (filters: ColumnFilters, column: string): boolean => (filters[column]?.size ?? 0) > 0;

/** The rows every column filter lets through. */
export function applyFilters(rows: readonly TableRow[], filters: ColumnFilters): TableRow[] {
  const active = Object.entries(filters).filter(([, excluded]) => excluded.size > 0);
  if (!active.length) return [...rows];

  return rows.filter((row) => active.every(([column, excluded]) => !excluded.has(filterValueOf(row, column))));
}

/** Sorted by one column; empty cells always last, ties keep selection order. */
export function sortRows(rows: readonly TableRow[], sort: SortState | null): TableRow[] {
  if (!sort) return [...rows];
  const sign = sort.direction === 'asc' ? 1 : -1;

  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const x = a.row.sortValues[sort.column] ?? null;
      const y = b.row.sortValues[sort.column] ?? null;
      if (x === null || y === null) {
        const blanks = (x === null ? 1 : 0) - (y === null ? 1 : 0);

        return blanks || a.index - b.index;
      }

      return sign * compareValues(x, y) || a.index - b.index;
    })
    .map(({ row }) => row);
}

/** A copy of `filters` with one column's excluded set replaced (an empty set removes it). */
export function setColumnFilter(filters: ColumnFilters, column: string, excluded: ReadonlySet<string>): ColumnFilters {
  const next: Record<string, ReadonlySet<string>> = { ...filters };
  if (excluded.size) next[column] = excluded;
  else delete next[column];

  return next;
}
