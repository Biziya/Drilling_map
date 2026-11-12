import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isMac, modKeyLabel } from './help';
import type { HelpButtonEntry, HelpSection, HelpShortcut } from './help';
import './HelpDialog.css';

export interface HelpButtonProps {
  /** The page title; the dialog is "<title> help". */
  title: string;
  sections: readonly HelpSection[];
}

/** True when a key press is someone typing, not a shortcut. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** A circle with a question mark inside. */
function HelpIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-icon="help"
    >
      <circle cx="12" cy="12" r="9.5" />
      <path d="M9.4 9.3a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.4-2.6 4" />
      <path d="M12 17.4h.01" />
    </svg>
  );
}

function Shortcuts({ shortcuts }: { shortcuts: readonly HelpShortcut[] }) {
  const mac = isMac();

  return (
    <dl className="help-dialog__shortcuts">
      {shortcuts.map(({ keys, action }) => (
        <div key={`${keys.join('+')}:${action}`} className="help-dialog__row">
          <dt>
            {keys.map((key, index) => (
              <span key={key}>
                {index > 0 && <span className="help-dialog__plus" aria-hidden="true">+</span>}
                <kbd>{modKeyLabel(key, mac)}</kbd>
              </span>
            ))}
          </dt>
          <dd>{action}</dd>
        </div>
      ))}
    </dl>
  );
}

function Buttons({ buttons }: { buttons: readonly HelpButtonEntry[] }) {
  return (
    <ul className="help-dialog__buttons">
      {buttons.map(({ icon, name, description }) => (
        <li key={name} className="help-dialog__row">
          <span className="help-dialog__icon" aria-hidden="true">{icon}</span>
          <span>
            <strong>{name}</strong>
            <span className="help-dialog__description">{description}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The round "?" header button and the help dialog it opens: every shortcut and
 * every button on the page, as the page describes them. Pressing "?" anywhere
 * on the page also opens it, unless the user is typing or another dialog is up.
 */
export default function HelpButton({ title, sections }: HelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();

  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return undefined;
    // The native modal traps focus and makes the rest of the page inert.
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('.help-dialog__close')?.focus();
    const button = buttonRef.current;

    return () => {
      if (dialog.open) dialog.close();
      button?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // "?" itself, or Shift + the slash key where a layout or driver reports no key text.
      const isQuestionMark = event.key === '?' || (event.shiftKey && event.code === 'Slash');
      if (!isQuestionMark || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target) || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      setIsOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border border-line bg-paper/95 text-muted hover:bg-control-hover hover:text-brand focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus aria-expanded:bg-control-selected aria-expanded:text-brand"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Help"
        title="Help: shortcuts and buttons (?)"
      >
        <HelpIcon />
      </button>

      {/* Portalled to <body>: page header styles (e.g. .map-header strong) must not reach it. */}
      {isOpen && createPortal(
        <dialog
          ref={dialogRef}
          className="help-dialog"
          aria-labelledby={titleId}
          // Esc: the browser's cancel, handled here so React state follows.
          onCancel={(event) => { event.preventDefault(); close(); }}
          // A press on the backdrop lands on the dialog element itself.
          onClick={(event) => { if (event.target === event.currentTarget) close(); }}
        >
          <div className="help-dialog__panel">
            <header className="help-dialog__header">
              <h2 id={titleId}>{title} help</h2>
              <button className="help-dialog__close" type="button" aria-label="Close help" onClick={close}>×</button>
            </header>
            <div className="help-dialog__body">
              <div className="help-dialog__columns">
              {sections.map((section) => (
                <section key={section.title} className="help-dialog__section">
                  <h3>{section.title}</h3>
                  {section.shortcuts?.length ? <Shortcuts shortcuts={section.shortcuts} /> : null}
                  {section.buttons?.length ? <Buttons buttons={section.buttons} /> : null}
                </section>
              ))}
              </div>
            </div>
          </div>
        </dialog>,
        document.body,
      )}
    </>
  );
}
