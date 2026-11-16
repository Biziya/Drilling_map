// The selection table's data: rows for the selected holes, Excel-style column
// filters (a set of excluded values per column) and a single-column sort.
// Pure and map-agnostic: each map passes its own columns.

import type { DrillholeColumn } from './columns';
import type { DrillholeApiRecord } from '../../types/drillhole';

/** The filter-list entry for an empty cell. */
export const BLANK = '(Blank)';

/** What a map hands the table per selected hole. */
export interface TableItem {
  /** Stable selection key. */
  key: string;
  drillhole: DrillholeApiRecord;
}

export interface TableRow {
  key: string;
  item: TableItem;
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

function buildRow(item: TableItem, columns: readonly DrillholeColumn[]): TableRow {
  const cells: Record<string, string | null> = {};
  const sortValues: Record<string, number | string | null> = {};
  for (const column of columns) {
    const text = column.read(item.drillhole);
    cells[column.label] = text;
    sortValues[column.label] = column.sort === 'number' && column.sortValue ? column.sortValue(item.drillhole) : text;
  }

  return { key: item.key, item, cells, sortValues };
}

/**
 * Rows cached per column list and item. Items are rebuilt whenever the data
 * changes, so a cached row is never stale; adding one hole to a selection of
 * thousands formats one row, not all of them.
 */
const rowCaches = new WeakMap<readonly DrillholeColumn[], WeakMap<TableItem, TableRow>>();

export function buildRows(items: readonly TableItem[], columns: readonly DrillholeColumn[]): TableRow[] {
  let cache = rowCaches.get(columns);
  if (!cache) {
    cache = new WeakMap();
    rowCaches.set(columns, cache);
  }

  return items.map((item) => {
    let row = cache.get(item);
    if (!row) {
      row = buildRow(item, columns);
      cache.set(item, row);
    }

    return row;
  });
}

/** Column widths, in characters, kept between these so one long value cannot take over. */
export const COLUMN_WIDTH_LIMITS = { min: 6, max: 40 } as const;

/**
 * Each column's width in characters: its longest cell over every row (not
 * just the rendered ones, so widths stay put while scrolling) or its header,
 * whichever is longer, within COLUMN_WIDTH_LIMITS.
 */
export function columnWidths(rows: readonly TableRow[], columns: readonly DrillholeColumn[]): Record<string, number> {
  const widths: Record<string, number> = {};
  for (const column of columns) {
    // The header also holds the sort arrow, dot and chevron.
    let longest = column.label.length + 4;
    for (const row of rows) {
      const text = row.cells[column.label];
      if (text && text.length > longest) longest = text.length;
    }
    widths[column.label] = Math.min(COLUMN_WIDTH_LIMITS.max, Math.max(COLUMN_WIDTH_LIMITS.min, longest));
  }

  return widths;
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

// --- Column visibility ---------------------------------------------------------

/** The columns still shown, in table order. */
export function visibleColumns(columns: readonly DrillholeColumn[], hidden: ReadonlySet<string>): DrillholeColumn[] {
  return columns.filter((column) => !hidden.has(column.label));
}

/**
 * `hidden` with `label` shown again, or hidden. The last visible column
 * cannot be hidden, so the table never ends up with none.
 */
export function toggleHidden(hidden: ReadonlySet<string>, label: string, columns: readonly DrillholeColumn[]): ReadonlySet<string> {
  const next = new Set(hidden);
  if (next.has(label)) {
    next.delete(label);
    return next;
  }
  if (visibleColumns(columns, hidden).length <= 1) return hidden;
  next.add(label);

  return next;
}

/** Hidden labels from storage, keeping only columns that still exist and never all of them. */
export function parseHiddenColumns(value: unknown, columns: readonly DrillholeColumn[]): ReadonlySet<string> {
  if (!Array.isArray(value)) return new Set();
  const labels = new Set(columns.map((column) => column.label));
  const hidden = new Set(value.filter((label): label is string => typeof label === 'string' && labels.has(label)));

  return hidden.size >= columns.length ? new Set() : hidden;
}
