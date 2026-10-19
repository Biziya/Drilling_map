/** Rendered in place of a measurement that is missing rather than zero. */
const EMPTY_VALUE = '—';

const formatters = new Map<number, Intl.NumberFormat>();

function getFormatter(maximumFractionDigits: number): Intl.NumberFormat {
  const cached = formatters.get(maximumFractionDigits);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits });
  formatters.set(maximumFractionDigits, formatter);

  return formatter;
}

/**
 * Converts a raw API value to a number, or rejects it.
 *
 * `Number()` coerces null, '', '   ', false, [] and {} all to 0. A missing
 * measurement must never be rendered as a real reading of zero, so every
 * non-numeric input is rejected before formatting.
 */
function toMeasuredNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return null;
  if (typeof value === 'object') return null;
  if (typeof value === 'string' && !value.trim()) return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

/**
 * Formats a value for display, or returns the empty marker.
 *
 * Takes `unknown` because every caller is reading a field straight off an API
 * record, where any of the values rejected above is a real possibility.
 */
export function formatNumber(value: unknown, maximumFractionDigits = 4): string {
  const number = toMeasuredNumber(value);
  if (number === null) return EMPTY_VALUE;

  return getFormatter(maximumFractionDigits).format(number);
}

/** Formats a value as a distance in metres. */
export function formatMeasurement(value: unknown): string {
  const formatted = formatNumber(value, 2);
  if (formatted === EMPTY_VALUE) return formatted;

  return `${formatted} m`;
}
