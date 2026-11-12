import { useCallback, useMemo, useState } from 'react';
import ColumnFilterMenu from './ColumnFilterMenu';
import {
  TABLE_COLUMNS,
  applyFilters,
  buildRows,
  distinctValues,
  isColumnFiltered,
  setColumnFilter,
  sortRows,
} from '../utils/selectionTable';
import type { ColumnFilters, SortState } from '../utils/selectionTable';
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

/** A funnel, filled while the column is filtered. */
function FilterIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M2 3h12l-4.5 5.5V13l-3 1.5v-6z" />
    </svg>
  );
}

/**
 * The selected holes as a table under the map, one column per popup field.
 * Each header opens a filter/sort menu. Filters and sort are kept until the
 * selection is cleared (the page unmounts the table then).
 */
export default function SelectionTable({ features, pinnedKey, onRowClick, onRemove, onClear }: SelectionTableProps) {
  const [filters, setFilters] = useState<ColumnFilters>(NO_FILTERS);
  const [sort, setSort] = useState<SortState | null>(null);
  const [menu, setMenu] = useState<{ column: string; anchor: HTMLElement } | null>(null);

  const rows = useMemo(() => buildRows(features), [features]);
  const shownRows = useMemo(() => sortRows(applyFilters(rows, filters), sort), [rows, filters, sort]);
  const menuColumn = menu ? TABLE_COLUMNS.find((column) => column.label === menu.column) : undefined;
  const menuValues = useMemo(() => (menu ? distinctValues(rows, menu.column) : []), [rows, menu]);
  const hasFilters = Object.keys(filters).length > 0 || sort !== null;
  const closeMenu = useCallback(() => setMenu(null), []);

  return (
    <section className="selection-table" aria-label="Selected drillholes">
      <header className="selection-table__bar">
        <h2>
          {features.length} selected
          {shownRows.length !== rows.length && <span> · {shownRows.length} shown</span>}
        </h2>
        <div className="selection-table__actions">
          <button type="button" onClick={() => { setFilters(NO_FILTERS); setSort(null); }} disabled={!hasFilters}>Clear filters</button>
          <button type="button" onClick={onClear}>Clear selection</button>
          <button type="button" className="selection-table__close" onClick={onClear} aria-label="Close table" title="Close and clear selection">×</button>
        </div>
      </header>

      <div className="selection-table__scroll">
        <table>
          <thead>
            <tr>
              <th className="selection-table__remove-col" aria-label="Remove" />
              {TABLE_COLUMNS.map((column) => {
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
                      <FilterIcon active={filtered} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shownRows.map((row) => (
              <tr
                key={row.key}
                className={row.key === pinnedKey ? 'is-pinned' : undefined}
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
                {TABLE_COLUMNS.map((column) => (
                  <td key={column.label} className={column.sort === 'number' ? 'is-number' : undefined}>
                    {row.cells[column.label] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
            {!shownRows.length && (
              <tr className="selection-table__empty">
                <td colSpan={TABLE_COLUMNS.length + 1}>No selected drillholes match the filters.</td>
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
          onClose={closeMenu}
        />
      )}
    </section>
  );
}
