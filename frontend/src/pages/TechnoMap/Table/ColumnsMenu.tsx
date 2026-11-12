import { usePopover } from './usePopover';
import type { DrillholeColumn } from '../utils/tooltipFields';

export interface ColumnsMenuProps {
  columns: readonly DrillholeColumn[];
  hidden: ReadonlySet<string>;
  onToggle: (label: string) => void;
  onShowAll: () => void;
}

/** Table bar menu: a checkbox per column to show or hide it, and Show all. */
export default function ColumnsMenu({ columns, hidden, onToggle, onShowAll }: ColumnsMenuProps) {
  const { isOpen, setIsOpen, wrapperRef, buttonRef } = usePopover();
  const visibleCount = columns.length - hidden.size;

  return (
    <div ref={wrapperRef} className="table-menu">
      <button
        ref={buttonRef}
        type="button"
        className={`selection-table__button${hidden.size ? ' is-active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        Columns{hidden.size > 0 && <span className="selection-table__badge">{hidden.size} hidden</span>}
        <svg className="selection-table__chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
      </button>
      {isOpen && (
        <div className="table-menu__panel" role="dialog" aria-label="Show or hide columns">
          <button type="button" className="table-menu__action" onClick={onShowAll} disabled={hidden.size === 0}>Show all</button>
          <ul className="table-menu__list">
            {columns.map((column) => {
              const isVisible = !hidden.has(column.label);

              return (
                <li key={column.label}>
                  <label>
                    <input
                      type="checkbox"
                      checked={isVisible}
                      // The last visible column stays, so the table is never empty of columns.
                      disabled={isVisible && visibleCount <= 1}
                      onChange={() => onToggle(column.label)}
                    />
                    <span>{column.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
