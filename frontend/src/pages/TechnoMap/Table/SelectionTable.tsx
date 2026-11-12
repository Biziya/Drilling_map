import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import ColumnFilterMenu from './ColumnFilterMenu';
import { useWindowedRows } from './useWindowedRows';
import ColumnsMenu from './ColumnsMenu';
import ExportMenu from './ExportMenu';
import {
  HIDDEN_COLUMNS_STORAGE_KEY,
  TABLE_COLUMNS,
  applyFilters,
  buildRows,
  columnWidths,
  distinctValues,
  isColumnFiltered,
  parseHiddenColumns,
  setColumnFilter,
  sortRows,
  toggleHidden,
  visibleColumns,
} from '../utils/selectionTable';
import type { ColumnFilters, SortState } from '../utils/selectionTable';
import { download } from '../utils/exportMap';
import { exportBlob, exportSheet, tableExportFileName } from '../utils/tableExport';
import type { TableExportFormat } from '../utils/tableExport';
import { readStored, writeStored } from '../utils/storage';
import type { MarkerFeature } from '../utils/markerLayer';

export interface SelectionTableProps {
  /** The selected holes, in the order they were selected. */
  features: readonly MarkerFeature[];
  /** The hole whose popup is pinned, highlighted in the table. */
  pinnedKey: string | null;
  onRowClick: (key: string) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
}

const NO_FILTERS: ColumnFilters = {};
const NO_EXCLUSIONS: ReadonlySet<string> = new Set();

/** Every body row's height in px; TechnoMap.css sets the same (.selection-table tbody td). */
export const TABLE_ROW_HEIGHT = 30;
/** Horizontal padding and border of a cell, in px, added to its width in characters. */
const CELL_CHROME = 22;
/** The remove (×) column, in px. */
const REMOVE_COL_WIDTH = 30;

/** A down arrow: the column's menu. */
function ChevronIcon() {
  return (
    <svg className="selection-table__chevron" viewBox="0 0 16 16" aria-hidden="true">
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

/**
 * The selected holes as a table over the bottom of the map, one column per
 * popup field. Each header opens a filter/sort/hide menu; the bar shows or
 * hides columns and exports what is shown. Filters and sort last until the
 * selection is cleared (the page unmounts the table then); hidden columns are
 * remembered per browser.
 *
 * Built for thousands of selected holes: only the rows in view are rendered
 * (useWindowedRows), column widths come from every row so they do not jump
 * while scrolling, and the page memoises it so panning the map never
 * re-renders it.
 */
function SelectionTable({ features, pinnedKey, onRowClick, onRemove, onClear }: SelectionTableProps) {
  const [filters, setFilters] = useState<ColumnFilters>(NO_FILTERS);
  const [sort, setSort] = useState<SortState | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => parseHiddenColumns(readStored(HIDDEN_COLUMNS_STORAGE_KEY)));
  const [menu, setMenu] = useState<{ column: string; anchor: HTMLElement } | null>(null);

  useEffect(() => writeStored(HIDDEN_COLUMNS_STORAGE_KEY, [...hidden]), [hidden]);

  const columns = useMemo(() => visibleColumns(TABLE_COLUMNS, hidden), [hidden]);
  const rows = useMemo(() => buildRows(features), [features]);
  const shownRows = useMemo(() => sortRows(applyFilters(rows, filters), sort), [rows, filters, sort]);
  const menuColumn = menu ? columns.find((column) => column.label === menu.column) : undefined;
  const menuValues = useMemo(() => (menu ? distinctValues(rows, menu.column) : []), [rows, menu]);
  const hasFilters = Object.keys(filters).length > 0 || sort !== null;
  const closeMenu = useCallback(() => setMenu(null), []);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowWindow = useWindowedRows(scrollRef, shownRows.length, TABLE_ROW_HEIGHT);
  const widths = useMemo(() => columnWidths(shownRows, columns), [shownRows, columns]);
  const tableStyle = useMemo<CSSProperties>(() => {
    const characters = columns.reduce((sum, column) => sum + (widths[column.label] ?? 0), 0);

    return { minWidth: `calc(${characters}ch + ${columns.length * CELL_CHROME + REMOVE_COL_WIDTH}px)` };
  }, [columns, widths]);

  const handleExport = (format: TableExportFormat) => {
    download(exportBlob(format, exportSheet(shownRows, columns)), tableExportFileName(format));
  };

  return (
    <section className="selection-table" aria-label="Selected drillholes">
      <header className="selection-table__bar">
        <h2>
          <span className="selection-table__count">{features.length}</span> selected
          {shownRows.length !== rows.length && <span className="selection-table__shown"> · {shownRows.length} shown</span>}
        </h2>
        <div className="selection-table__actions">
          <button
            type="button"
            className="selection-table__button"
            onClick={() => { setFilters(NO_FILTERS); setSort(null); }}
            disabled={!hasFilters}
          >
            Clear filters
          </button>
          <ColumnsMenu
            columns={TABLE_COLUMNS}
            hidden={hidden}
            onToggle={(label) => setHidden((current) => toggleHidden(current, label))}
            onShowAll={() => setHidden(new Set())}
          />
          <ExportMenu disabled={shownRows.length === 0} onExport={handleExport} />
          <span className="selection-table__divider" aria-hidden="true" />
          <button type="button" className="selection-table__button is-quiet" onClick={onClear}>Clear selection</button>
          <button type="button" className="selection-table__close" onClick={onClear} aria-label="Close table" title="Close and clear selection">×</button>
        </div>
      </header>

      <div className="selection-table__scroll" ref={scrollRef}>
        <table style={tableStyle}>
          <colgroup>
            <col style={{ width: REMOVE_COL_WIDTH }} />
            {columns.map((column) => (
              <col key={column.label} style={{ width: `calc(${widths[column.label]}ch + ${CELL_CHROME}px)` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="selection-table__remove-col" aria-label="Remove" />
              {columns.map((column) => {
                const filtered = isColumnFiltered(filters, column.label);
                const sorted = sort?.column === column.label ? sort.direction : null;

                return (
                  <th key={column.label} aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}>
                    <button
                      type="button"
                      className={`selection-table__header${filtered || sorted ? ' is-active' : ''}`}
                      aria-haspopup="dialog"
                      aria-expanded={menu?.column === column.label}
                      onClick={(event) => {
                        const anchor = event.currentTarget;
                        setMenu((current) => (current?.column === column.label ? null : { column: column.label, anchor }));
                      }}
                    >
                      <span>{column.label}</span>
                      {sorted && <span className="selection-table__sort" aria-hidden="true">{sorted === 'asc' ? '▲' : '▼'}</span>}
                      {filtered && <span className="selection-table__dot" aria-hidden="true" />}
                      <ChevronIcon />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rowWindow.padTop > 0 && <tr className="selection-table__spacer" style={{ height: rowWindow.padTop }} aria-hidden="true" />}
            {shownRows.slice(rowWindow.start, rowWindow.end).map((row, offset) => (
              <tr
                key={row.key}
                className={`${(rowWindow.start + offset) % 2 ? 'is-odd' : ''}${row.key === pinnedKey ? ' is-pinned' : ''}`.trim() || undefined}
                data-key={row.key}
                onClick={() => onRowClick(row.key)}
              >
                <td className="selection-table__remove-col">
                  <button
                    type="button"
                    aria-label={`Remove ${row.cells.Key ?? 'drillhole'} from selection`}
                    title="Remove from selection"
                    onClick={(event) => { event.stopPropagation(); onRemove(row.key); }}
                  >
                    ×
                  </button>
                </td>
                {columns.map((column) => (
                  <td key={column.label} className={column.sort === 'number' ? 'is-number' : undefined} title={row.cells[column.label] ?? undefined}>
                    {row.cells[column.label] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
            {rowWindow.padBottom > 0 && <tr className="selection-table__spacer" style={{ height: rowWindow.padBottom }} aria-hidden="true" />}
            {!shownRows.length && (
              <tr className="selection-table__empty">
                <td colSpan={columns.length + 1}>No selected drillholes match the filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {menu && menuColumn && (
        <ColumnFilterMenu
          column={menuColumn}
          anchor={menu.anchor}
          values={menuValues}
          excluded={filters[menu.column] ?? NO_EXCLUSIONS}
          sort={sort}
          onExcludedChange={(excluded) => setFilters((current) => setColumnFilter(current, menu.column, excluded))}
          onSort={(direction) => setSort(direction ? { column: menu.column, direction } : null)}
          onHide={columns.length > 1 ? () => { setHidden((current) => toggleHidden(current, menu.column)); setMenu(null); } : undefined}
          onClose={closeMenu}
        />
      )}
    </section>
  );
}

export default memo(SelectionTable);
