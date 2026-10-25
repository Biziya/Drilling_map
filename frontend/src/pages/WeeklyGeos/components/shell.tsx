import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

/* The sidebar, its three inline icons and its collapse toggle are gone:
   the application's own sidebar navigates to these pages now, and a
   second one inside the page would have been both a duplicate and a
   class-name collision — it used .sidebar, .sidebar__link, .sidebar__label
   and .sidebar__icon, all of which the application sidebar owns. */

/* ------------------------------------------------------------------ */
/* Slicers                                                             */
/* ------------------------------------------------------------------ */

export function Select({
  label, value, options, onChange, allLabel,
}: {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (v: string | null) => void;
  allLabel?: string;
}) {
  return (
    <label className="slicer">
      <span className="slicer__label">{label}</span>
      <select
        className="slicer__input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      >
        {allLabel && <option value="">{allLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/**
 * Checkbox dropdown. A native multiple <select> technically works but is
 * unusable in practice — it needs ctrl-click to add, and a stray plain
 * click silently wipes the whole selection.
 *
 * An empty selection means "all", matching the API's convention, so the
 * summary reads "All rigs" rather than "none".
 */
export function MultiSelect({
  label, selected, options, onChange, allLabel,
}: {
  label: string;
  selected: string[];
  options: string[];
  onChange: (next: string[]) => void;
  allLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = (option: string) =>
    onChange(selected.includes(option)
      ? selected.filter((s) => s !== option)
      : [...selected, option]);

  const summary =
    selected.length === 0 ? allLabel
    : selected.length === 1 ? selected[0]
    : `${selected.length} selected`;

  return (
    <div className="slicer" ref={box}>
      <span className="slicer__label">{label}</span>

      <button
        type="button"
        className={`slicer__input slicer__trigger${
          selected.length ? ' is-active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="slicer__summary">{summary}</span>
        <span className="slicer__caret" aria-hidden="true" />
      </button>

      {open && (
        <div className="slicer__menu" role="listbox" aria-multiselectable="true">
          {options.length === 0 && (
            <p className="slicer__none">Nothing matches the other filters.</p>
          )}

          {options.map((option) => (
            <label key={option} className="slicer__option">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggle(option)}
              />
              <span>{option}</span>
            </label>
          ))}

          {selected.length > 0 && (
            <button
              type="button"
              className="slicer__clear"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel + cards                                                       */
/* ------------------------------------------------------------------ */

export function Panel({
  title, note, action, onExpand, children, className = '',
}: {
  title: string;
  note?: string;
  /** Optional control shown on the right of the header. */
  action?: ReactNode;
  /** When given, an enlarge button appears in the header. */
  onExpand?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel__head">
        <h2 className="panel__title">{title}</h2>
        {note && <span className="panel__note">{note}</span>}
        <div className="panel__action">
          {action}
          {onExpand && <ExpandButton title={title} onClick={onExpand} />}
        </div>
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}

export function ExpandButton({
  title, onClick,
}: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="panel__expand"
      onClick={onClick}
      aria-label={`Enlarge ${title}`}
      title="Enlarge"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6 2H2v4M10 14h4v-4M2 10v4h4M14 6V2h-4"
              fill="none" stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/**
 * Enlarges one chart over the page.
 *
 * Deliberately opened from a button rather than by clicking the chart
 * itself: the bar chart already uses clicks to cross-filter, and
 * overloading the same gesture would make both feel unreliable.
 */
export function Modal({
  title, onClose, children,
}: { title: string; onClose: () => void; children: ReactNode }) {
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    // The page behind must not scroll while a dialog is over it.
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  // Portalled to <body>, and so out of the page's CSS container. The page
  // declares `container: inline-size` so the dashboard grid reflows against
  // the main area rather than the window, and a container is also the
  // containing block for `position: fixed` descendants — rendered in place,
  // this backdrop would cover the main area only and leave the sidebar lit.
  // The wrapper carries the page class because the tokens, the typeface and
  // every .modal rule are scoped under it; is-overlay switches off the page
  // frame the class otherwise brings with it.
  return createPortal(
    <div className="weekly-geos-page is-overlay">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="modal__panel">
          <header className="modal__head">
            <h2 className="modal__title">{title}</h2>
            <button
              ref={closeButton}
              type="button"
              className="modal__close"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </header>
          <div className="modal__body">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Two or three mutually exclusive choices, for switching a view rather
 * than filtering data — a dropdown would be heavier than the choice.
 */
export function Segmented<T extends string>({
  value, options, onChange, label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`segmented__option${
            option.value === value ? ' is-selected' : ''}`}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function StatCard({
  label, value, sub, tone = 'default',
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: 'default' | 'positive';
}) {
  return (
    <div className={`stat stat--${tone}`}>
      <p className="stat__label">{label}</p>
      <p className="stat__value">{value}</p>
      {sub && <p className="stat__sub">{sub}</p>}
    </div>
  );
}

/** The wide banner card. The original measure rendered without a
 *  separator — "Campaign W14 - W45Target: 38,000 m". Fixed here. */
export function CampaignBanner({
  startWeek, endWeek, annualTarget,
}: { startWeek: number | null; endWeek: number | null; annualTarget: number | null }) {
  if (startWeek === null || endWeek === null || annualTarget === null) {
    return (
      <div className="banner banner--empty">
        No campaign is configured for this year.
      </div>
    );
  }
  return (
    <div className="banner">
      <span className="banner__weeks">
        Campaign W{startWeek}–W{endWeek}
      </span>
      <span className="banner__sep" aria-hidden="true" />
      <span className="banner__target">
        Target {annualTarget.toLocaleString()} m
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* States                                                              */
/* ------------------------------------------------------------------ */

export function Loading({ label = 'Loading' }: { label?: string }) {
  return <div className="state" role="status">{label}…</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="state state--empty">{children}</div>;
}

export function Failed({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof Error ? error.message : 'Could not load this data.';
  return (
    <div className="state state--error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="state__retry" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
