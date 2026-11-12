import { usePopover } from './usePopover';
import type { TableExportFormat } from '../utils/tableExport';

export interface ExportMenuProps {
  /** False when the filters leave no rows: there is nothing to export. */
  disabled: boolean;
  onExport: (format: TableExportFormat) => void;
}

const FORMATS: readonly { format: TableExportFormat; label: string; hint: string }[] = [
  { format: 'xlsx', label: 'Excel (.xlsx)', hint: 'Numbers stay numbers, header row frozen' },
  { format: 'csv', label: 'CSV (.csv)', hint: 'Plain text, opens anywhere' },
];

/** Table bar menu: download the table as it is shown, as Excel or CSV. */
export default function ExportMenu({ disabled, onExport }: ExportMenuProps) {
  const { isOpen, setIsOpen, wrapperRef, buttonRef } = usePopover();

  return (
    <div ref={wrapperRef} className="table-menu">
      <button
        ref={buttonRef}
        type="button"
        className="selection-table__button is-primary"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        disabled={disabled}
        title={disabled ? 'No rows to export' : 'Export the rows and columns shown'}
        onClick={() => setIsOpen((open) => !open)}
      >
        {/* A tray with an arrow into it: download. */}
        <svg className="selection-table__icon" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 11v2.5h11V11" />
        </svg>
        Export
        <svg className="selection-table__chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
      </button>
      {isOpen && (
        <div className="table-menu__panel" role="menu" aria-label="Export format">
          {FORMATS.map(({ format, label, hint }) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              className="table-menu__item"
              onClick={() => { setIsOpen(false); onExport(format); }}
            >
              <strong>{label}</strong>
              <span>{hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
