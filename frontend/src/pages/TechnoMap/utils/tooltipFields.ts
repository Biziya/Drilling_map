// The TechnoMap hover popup's rows: label, and how each value is read and
// formatted from an already-loaded API record. Shared by the popup and its tests.

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

const text = (field: DrillholeField): Read => (drillhole) => readDrillholeText(drillhole, field)?.trim() || null;

/** Metres and coordinates, always two decimals; the record itself is not rounded. */
const measure = (field: DrillholeField): Read => (drillhole) => {
  const number = toNumber(readDrillholeValue(drillhole, field));

  return number === null ? null : metres.format(number);
};

/**
 * A date as YYYY-MM-DD, plus HH:mm when the value carries a time (and
 * `withTime`). A date-only value never gains an invented time; anything
 * unrecognised is shown as sent.
 */
const date = (field: DrillholeField, withTime = false): Read => (drillhole) => {
  const value = readDrillholeText(drillhole, field)?.trim();
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?)?/.exec(value);
  if (!match) return value;
  const [, day, time] = match;

  return withTime && time && time !== '00:00' ? `${day} ${time}` : day ?? value;
};

/** Not in pyISR_AllData_V2 or the API yet: always shown, always a dash. */
const notYetAvailable: Read = () => null;

/**
 * The popup rows, in the agreed order (Screen max depth once, though the
 * request listed it twice). Fields with no data source yet read
 * `notYetAvailable`; connecting one later means giving it a reader. Built
 * once, not per hover.
 */
export const TOOLTIP_FIELDS: readonly { label: string; read: Read }[] = [
  { label: 'ID', read: text('id') },
  { label: 'Key', read: text('holeId') },
  { label: 'Type', read: text('holePurpose') },
  { label: 'License', read: text('license') },
  { label: 'Stratigraphic Unit', read: text('stratigraphicUnit') },
  { label: 'X (m)', read: measure('x') },
  { label: 'Y (m)', read: measure('y') },
  // No verified source: the API's `z` is the well-head topo level, below.
  { label: 'Z (m)', read: notYetAvailable },
  { label: 'Z (well head-topo) (m)', read: measure('z') },
  { label: 'Screen min depth (m)', read: measure('screenMinDepth') },
  { label: 'Screen max depth (m)', read: measure('screenMaxDepth') },
  { label: 'Screen length (m)', read: measure('screenLength') },
  { label: 'Screen top altitude (m)', read: measure('screenTopAltitude') },
  { label: 'Status', read: text('holeStatus') },
  { label: 'Drilling Company', read: text('drillingCompany') },
  { label: 'Drilling Rig', read: text('drillingRig') },
  { label: 'Start Date', read: date('startDate') },
  { label: 'End Date', read: date('endDate') },
  { label: 'Billing Time', read: date('billingDate', true) },
  { label: 'Relative level', read: text('relativeLevel') },
  { label: 'Mining level', read: notYetAvailable },
  { label: 'Associated Production cells', read: notYetAvailable },
  { label: 'Development Flowrates (m³/h)', read: notYetAvailable },
];
