// The selection table as a file: exactly what the table shows (rows after the
// filters, in the current sort, visible columns only), as CSV or Excel.

import type { DrillholeColumn } from './tooltipFields';
import type { TableRow } from './selectionTable';
import { buildXlsx } from './xlsx';
import type { Sheet, SheetCell } from './xlsx';

export type TableExportFormat = 'xlsx' | 'csv';

const pad = (value: number) => String(value).padStart(2, '0');

/** TechnoMap_selection_YYYY-MM-DD_HH-mm-ss.<ext>, in local time, like the map export. */
export function tableExportFileName(format: TableExportFormat, date = new Date()): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  return `TechnoMap_selection_${day}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.${format}`;
}

/**
 * Header and cells for the shown rows. Number columns keep their raw number
 * (the screen shows it rounded) so a spreadsheet can sum and sort it; every
 * other column is its display text; empty cells are null.
 */
export function exportSheet(rows: readonly TableRow[], columns: readonly DrillholeColumn[]): Sheet {
  return {
    name: 'Selection',
    header: columns.map((column) => column.label),
    rows: rows.map((row) => columns.map((column): SheetCell => {
      if (column.sort === 'number') {
        const value = row.sortValues[column.label];

        return typeof value === 'number' ? value : null;
      }

      return row.cells[column.label] ?? null;
    })),
  };
}

/** One CSV field: quoted when it holds a comma, quote, or line break (RFC 4180). */
function csvField(value: SheetCell): string {
  if (value === null) return '';
  const text = String(value);

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Byte order mark: tells Excel the CSV is UTF-8. */
const BOM = String.fromCharCode(0xfeff);

/** CSV text with a UTF-8 BOM (so Excel reads accents correctly) and CRLF line ends. */
export function toCsv(sheet: Sheet): string {
  const lines = [sheet.header, ...sheet.rows].map((row) => row.map(csvField).join(','));

  return `${BOM}${lines.join('\r\n')}\r\n`;
}

export function exportBlob(format: TableExportFormat, sheet: Sheet): Blob {
  if (format === 'csv') return new Blob([toCsv(sheet)], { type: 'text/csv;charset=utf-8' });

  return new Blob([buildXlsx(sheet)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
