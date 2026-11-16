// Table columns (and tooltip rows) over drillhole API records: a label, how
// the value is read and formatted, and how the column sorts. Each map builds
// its own list from these helpers; the table, its filters, its export and the
// map tooltips all read the same list.

import { readDrillholeText, readDrillholeValue } from '../../utils/drillholeFields';
import type { DrillholeField } from '../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../types/drillhole';

const metres = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A finite number from an API value, or null; '', null and booleans are not 0. */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

export type Read = (drillhole: DrillholeApiRecord) => string | null;

/** How a column sorts in the selection table: words A-Z, numbers and dates ascending. */
export type SortKind = 'text' | 'number' | 'date';

/** One tooltip row / table column. */
export interface DrillholeColumn {
  label: string;
  /** The formatted value, or null for a dash. */
  read: Read;
  sort: SortKind;
  /** The raw number a 'number' column sorts by (the display is rounded). */
  sortValue?: (drillhole: DrillholeApiRecord) => number | null;
  /** False while the field has no data source: always a dash, left out of the table. */
  available: boolean;
}

export type ColumnSpec = Omit<DrillholeColumn, 'label'>;

export const textColumn = (field: DrillholeField): ColumnSpec => ({
  read: (drillhole) => readDrillholeText(drillhole, field)?.trim() || null,
  sort: 'text',
  available: true,
});

/** A number shown with `decimals` decimals; the record itself is not rounded. */
export const numberColumn = (field: DrillholeField, decimals = 2): ColumnSpec => {
  const format = decimals === 2
    ? metres
    : new Intl.NumberFormat(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const sortValue = (drillhole: DrillholeApiRecord) => toNumber(readDrillholeValue(drillhole, field));

  return {
    read: (drillhole) => {
      const number = sortValue(drillhole);

      return number === null ? null : format.format(number);
    },
    sort: 'number',
    sortValue,
    available: true,
  };
};

/** Metres and coordinates, always two decimals. */
export const measureColumn = (field: DrillholeField): ColumnSpec => numberColumn(field, 2);

/**
 * A date as YYYY-MM-DD, plus HH:mm when the value carries a time (and
 * `withTime`). A date-only value never gains an invented time; anything
 * unrecognised is shown as sent. YYYY-MM-DD[ HH:mm] sorts correctly as text.
 */
export const dateColumn = (field: DrillholeField, withTime = false): ColumnSpec => ({
  read: (drillhole) => {
    const value = readDrillholeText(drillhole, field)?.trim();
    if (!value) return null;
    const match = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?)?/.exec(value);
    if (!match) return value;
    const [, day, time] = match;

    return withTime && time && time !== '00:00' ? `${day} ${time}` : day ?? value;
  },
  sort: 'date',
  available: true,
});

/** No data source yet: always shown in the tooltip as a dash, left out of the table. */
export const notYetAvailable: ColumnSpec = { read: () => null, sort: 'text', available: false };
