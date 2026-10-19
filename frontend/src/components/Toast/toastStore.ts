// App-wide toast notifications.
//
// A module-level store, so anything with access to the UI layer (pages, data
// loaders) can raise a toast without threading callbacks through props. The
// store owns every timer: a toast dismisses itself, and clearing the store
// cancels whatever is still pending.

import { useSyncExternalStore } from 'react';

export type ToastType = 'success' | 'warning' | 'error';

export const TOAST_DURATIONS: Readonly<Record<ToastType, number>> = {
  error: 5000,
  warning: 3000,
  success: 3000,
};

/** Older toasts are dismissed beyond this, so a burst cannot fill the screen. */
const MAX_TOASTS = 3;
/** How long a dismissed toast stays mounted to play its exit transition. */
export const TOAST_EXIT_MS = 150;

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  /** True while the exit transition plays, just before removal. */
  leaving: boolean;
}

let toasts: readonly Toast[] = [];
let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();

function setToasts(next: readonly Toast[]) {
  toasts = next;
  listeners.forEach((listener) => listener());
}

function schedule(id: number, delay: number, action: () => void) {
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(action, delay));
}

export function dismissToast(id: number): void {
  const toast = toasts.find((item) => item.id === id);
  if (!toast || toast.leaving) return;

  setToasts(toasts.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
  schedule(id, TOAST_EXIT_MS, () => {
    timers.delete(id);
    setToasts(toasts.filter((item) => item.id !== id));
  });
}

/**
 * Shows a toast. Repeating a message that is already on screen restarts its
 * timer instead of stacking a copy, so a recurring failure shows once.
 */
export function showToast(type: ToastType, message: string): number {
  const duplicate = toasts.find((item) => !item.leaving && item.type === type && item.message === message);
  const id = duplicate?.id ?? nextId++;

  if (!duplicate) {
    setToasts([...toasts, { id, type, message, leaving: false }]);
    toasts.filter((item) => !item.leaving).slice(0, -MAX_TOASTS).forEach((item) => dismissToast(item.id));
  }

  schedule(id, TOAST_DURATIONS[type], () => dismissToast(id));

  return id;
}

/** Removes every toast and cancels every pending timer. */
export function clearToasts(): void {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  setToasts([]);
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function useToasts(): readonly Toast[] {
  return useSyncExternalStore(subscribe, () => toasts);
}
