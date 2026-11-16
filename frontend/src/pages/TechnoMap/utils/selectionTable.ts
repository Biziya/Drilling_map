// The Techno Map's selection table: the shared table model
// (components/SelectionTable) with this map's columns and storage key.

import { TOOLTIP_FIELDS } from './tooltipFields';
import type { DrillholeColumn } from './tooltipFields';
import * as model from '../../../components/SelectionTable/tableModel';
import type { TableItem, TableRow } from '../../../components/SelectionTable/tableModel';

export {
  BLANK,
  COLUMN_WIDTH_LIMITS,
  applyFilters,
  columnWidths,
  distinctValues,
  filterValueOf,
  isColumnFiltered,
  setColumnFilter,
  sortRows,
  visibleColumns,
} from '../../../components/SelectionTable/tableModel';
export type { ColumnFilters, DistinctValue, SortDirection, SortState, TableItem, TableRow } from '../../../components/SelectionTable/tableModel';

/** The table's columns: every popup field that has a data source. */
export const TABLE_COLUMNS: readonly DrillholeColumn[] = TOOLTIP_FIELDS.filter((column) => column.available);

/** Where the hidden column labels are remembered, per browser. */
export const HIDDEN_COLUMNS_STORAGE_KEY = 'techno-map:table-columns';

export const buildRows = (items: readonly TableItem[], columns: readonly DrillholeColumn[] = TABLE_COLUMNS): TableRow[] => model.buildRows(items, columns);

export const toggleHidden = (hidden: ReadonlySet<string>, label: string, columns: readonly DrillholeColumn[] = TABLE_COLUMNS) =>
  model.toggleHidden(hidden, label, columns);

export const parseHiddenColumns = (value: unknown, columns: readonly DrillholeColumn[] = TABLE_COLUMNS) =>
  model.parseHiddenColumns(value, columns);
