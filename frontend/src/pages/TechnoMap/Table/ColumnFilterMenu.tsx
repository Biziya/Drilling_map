import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useWindowedRows } from './useWindowedRows';
import type { DrillholeColumn } from '../utils/tooltipFields';
import type { DistinctValue, SortDirection, SortState } from '../utils/selectionTable';

export interface ColumnFilterMenuProps {
  column: DrillholeColumn;
  /** The header button it opened from; the menu is placed under it. */
  anchor: HTMLElement;
  values: readonly DistinctValue[];
  excluded: ReadonlySet<string>;
  sort: SortState | null;
  onExcludedChange: (excluded: ReadonlySet<string>) => void;
  onSort: (direction: SortDirection | null) => void;
  /** Hides this column; absent when it is the last one shown. */
  onHide?: () => void;
  onClose: () => void;
}

const MENU_WIDTH = 240;
/** Each value row's height in px; TechnoMap.css sets the same (.column-filter-menu__values label). */
const VALUE_ROW_HEIGHT = 26;

/** Sort labels by column kind: words read A-Z, numbers and dates ascending. */
function sortLabels(kind: DrillholeColumn['sort']): Record<SortDirection, string> {
  return kind === 'text'
    ? { asc: 'Sort A → Z', desc: 'Sort Z → A' }
    : { asc: 'Sort ascending', desc: 'Sort descending' };
}

/**
 * Excel-style column menu: sort, a search box, Select all / Unselect all and a
 * checkbox per distinct value (only those in view are rendered, so a column
 * with thousands of values opens at once). Changes apply at once. Fixed-positioned, so the
 * table's scroll box cannot clip it; closes on Esc or a press outside.
 */
export default function ColumnFilterMenu({
  column, anchor, values, excluded, sort, onExcludedChange, onSort, onHide, onClose,
}: ColumnFilterMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    const bounds = anchor.getBoundingClientRect();
    const left = Math.max(8, Math.min(bounds.left, window.innerWidth - MENU_WIDTH - 8));
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    // Under the button, or above it when the page has no room below.
    const below = bounds.bottom + 4;
    const top = menuHeight && below + menuHeight > window.innerHeight ? Math.max(8, bounds.top - menuHeight - 4) : below;
    setPosition({ left, top });
  }, [anchor]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); anchor.focus(); }
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [anchor, onClose]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return needle ? values.filter(({ value }) => value.toLowerCase().includes(needle)) : values;
  }, [query, values]);

  const rowWindow = useWindowedRows(listRef, visible.length, VALUE_ROW_HEIGHT);
  const labels = sortLabels(column.sort);
  const activeDirection = sort?.column === column.label ? sort.direction : null;
  const allVisibleChecked = visible.every(({ value }) => !excluded.has(value));

  // Select all / Unselect all act on the values the search shows, like a spreadsheet.
  const setVisible = (checked: boolean) => {
    const next = new Set(excluded);
    for (const { value } of visible) {
      if (checked) next.delete(value); else next.add(value);
    }
    onExcludedChange(next);
  };

  const toggle = (value: string) => {
    const next = new Set(excluded);
    if (next.has(value)) next.delete(value); else next.add(value);
    onExcludedChange(next);
  };

  return (
    <div
      ref={menuRef}
      className="column-filter-menu"
      role="dialog"
      aria-label={`Filter ${column.label}`}
      style={{ left: position.left, top: position.top, width: MENU_WIDTH }}
    >
      <div className="column-filter-menu__sort">
        {(['asc', 'desc'] as const).map((direction) => (
          <button
            key={direction}
            type="button"
            className={activeDirection === direction ? 'is-active' : ''}
            aria-pressed={activeDirection === direction}
            onClick={() => onSort(activeDirection === direction ? null : direction)}
          >
            {labels[direction]}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="column-filter-menu__hide"
        onClick={onHide}
        disabled={!onHide}
        title={onHide ? undefined : 'At least one column stays visible'}
      >
        {/* An eye with a slash: hide. */}
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /><path d="M2.5 13.5 13.5 2.5" /></svg>
        Hide column
      </button>

      <input
        className="column-filter-menu__search"
        type="search"
        placeholder="Search values"
        aria-label={`Search ${column.label} values`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="column-filter-menu__bulk">
        <button type="button" onClick={() => setVisible(true)} disabled={allVisibleChecked}>Select all</button>
        <button type="button" onClick={() => setVisible(false)} disabled={visible.every(({ value }) => excluded.has(value))}>Unselect all</button>
      </div>

      <ul className="column-filter-menu__values" ref={listRef}>
        {rowWindow.padTop > 0 && <li className="column-filter-menu__spacer" style={{ height: rowWindow.padTop }} aria-hidden="true" />}
        {visible.slice(rowWindow.start, rowWindow.end).map(({ value, count }) => (
          <li key={value}>
            <label>
              <input type="checkbox" checked={!excluded.has(value)} onChange={() => toggle(value)} />
              <span className="column-filter-menu__value">{value}</span>
              <span className="column-filter-menu__count">{count}</span>
            </label>
          </li>
        ))}
        {rowWindow.padBottom > 0 && <li className="column-filter-menu__spacer" style={{ height: rowWindow.padBottom }} aria-hidden="true" />}
        {!visible.length && <li className="column-filter-menu__empty">No matching values</li>}
      </ul>
    </div>
  );
}
