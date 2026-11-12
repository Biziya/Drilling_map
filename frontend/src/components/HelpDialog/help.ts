// Types for the help dialog's content, and the key-label helper. Separate from
// the component so pages can describe their help without importing React code.

import type { ReactNode } from 'react';

/** A shortcut: the keys or gestures, and what they do. */
export interface HelpShortcut {
  /** Chips joined by "+", e.g. ['Ctrl', 'Click']. "Ctrl" shows as ⌘ on a Mac. */
  keys: readonly string[];
  action: string;
}

/** A button on the page: its icon as the user sees it, its name and what it does. */
export interface HelpButtonEntry {
  icon: ReactNode;
  /** The control's accessible name, so tests can match help to controls. */
  name: string;
  description: string;
}

export interface HelpSection {
  title: string;
  shortcuts?: readonly HelpShortcut[];
  buttons?: readonly HelpButtonEntry[];
}

export const isMac = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

/** The label of a key chip: Ctrl is ⌘ on a Mac, where Cmd+click does the same. */
export function modKeyLabel(key: string, mac = isMac()): string {
  return mac && key === 'Ctrl' ? '⌘' : key;
}
