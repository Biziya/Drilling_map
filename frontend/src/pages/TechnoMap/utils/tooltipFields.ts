// The TechnoMap hover popup's rows, which are also the selection table's
// columns: label, how each value is read and formatted from an already-loaded
// API record, and how the column sorts. Shared by the popup, the table and
// their tests.

import { readDrillholeText, readDrillholeValue } from '../../../utils/drillholeFields';
import type { DrillholeField } from '../../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../../types/drillhole';

const metres = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A finite number from an API value, or null; '', null and booleans are not 0. */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

export type Read = (drillhole: DrillholeApiRecord) => string | null;

/** How a column sorts in the selection table: words A-Z, numbers and dates ascending. */
export type SortKind = 'text' | 'number' | 'date';

/** One popup row / table column. */
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

type ColumnSpec = Omit<DrillholeColumn, 'label'>;

const text = (field: DrillholeField): ColumnSpec => ({
  read: (drillhole) => readDrillholeText(drillhole, field)?.trim() || null,
  sort: 'text',
  available: true,
});

/** Metres and coordinates, always two decimals; the record itself is not rounded. */
const measure = (field: DrillholeField): ColumnSpec => {
  const sortValue = (drillhole: DrillholeApiRecord) => toNumber(readDrillholeValue(drillhole, field));

  return {
    read: (drillhole) => {
      const number = sortValue(drillhole);

      return number === null ? null : metres.format(number);
    },
    sort: 'number',
    sortValue,
    available: true,
  };
};

/**
 * A date as YYYY-MM-DD, plus HH:mm when the value carries a time (and
 * `withTime`). A date-only value never gains an invented time; anything
 * unrecognised is shown as sent. YYYY-MM-DD[ HH:mm] sorts correctly as text.
 */
const date = (field: DrillholeField, withTime = false): ColumnSpec => ({
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

/** Not in pyISR_AllData_V2 or the API yet: always shown, always a dash. */
const notYetAvailable: ColumnSpec = { read: () => null, sort: 'text', available: false };

/**
 * The popup rows, in the agreed order, under the ID title (Screen max depth
 * once, though the request listed it twice). Fields with no data source yet are
 * `notYetAvailable`; connecting one later means giving it a reader. Built
 * once, not per hover.
 */
export const TOOLTIP_FIELDS: readonly DrillholeColumn[] = [
  { label: 'Key', ...text('holeId') },
  { label: 'Type', ...text('holePurpose') },
  { label: 'License', ...text('license') },
  { label: 'Stratigraphic Unit', ...text('stratigraphicUnit') },
  { label: 'X (m)', ...measure('x') },
  { label: 'Y (m)', ...measure('y') },
  // No verified source: the API's `z` is the well-head topo level, below.
  { label: 'Z (m)', ...notYetAvailable },
  { label: 'Z (well head-topo) (m)', ...measure('z') },
  { label: 'Screen min depth (m)', ...measure('screenMinDepth') },
  { label: 'Screen max depth (m)', ...measure('screenMaxDepth') },
  { label: 'Screen length (m)', ...measure('screenLength') },
  { label: 'Screen top altitude (m)', ...measure('screenTopAltitude') },
  { label: 'Status', ...text('holeStatus') },
  { label: 'Drilling Company', ...text('drillingCompany') },
  { label: 'Drilling Rig', ...text('drillingRig') },
  { label: 'Start Date', ...date('startDate') },
  { label: 'End Date', ...date('endDate') },
  { label: 'Billing Time', ...date('billingDate', true) },
  { label: 'Relative level', ...text('relativeLevel') },
  { label: 'Mining level', ...notYetAvailable },
  { label: 'Associated Production cells', ...notYetAvailable },
  { label: 'Development Flowrates (m³/h)', ...notYetAvailable },
];
