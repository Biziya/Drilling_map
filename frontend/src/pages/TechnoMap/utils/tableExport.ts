// The Techno Map's table export: the shared export with this map's file name.

import { tableExportFileName as sharedFileName } from '../../../components/SelectionTable/tableExport';
import type { TableExportFormat } from '../../../components/SelectionTable/tableExport';

export { exportBlob, exportSheet, toCsv } from '../../../components/SelectionTable/tableExport';
export type { TableExportFormat } from '../../../components/SelectionTable/tableExport';

/** File names start with this, e.g. TechnoMap_selection_2026-11-12_09-05-07.xlsx. */
export const TABLE_EXPORT_PREFIX = 'TechnoMap_selection';

export const tableExportFileName = (format: TableExportFormat, date = new Date()): string => sharedFileName(TABLE_EXPORT_PREFIX, format, date);
