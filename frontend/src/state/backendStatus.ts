// Backend availability, shared by every component that shows it.
//
// One module-level store owns the polling: however many components subscribe,
// there is a single timer and at most one health request in flight. Polling
// starts with the first subscriber and stops when the last one unmounts.

import { useSyncExternalStore } from 'react';
import { APP_CONFIG } from '../config/app';
import { checkBackendHealth } from '../services/api/health';

/** `checking` until the first health check has answered. */
export type BackendStatus = 'checking' | 'online' | 'offline';

export interface BackendStatusOptions {
  checkIntervalMs: number;
  timeoutMs: number;
  /** Resolves whether the backend is healthy. Injected by tests. */
  check?: (timeoutMs: number) => Promise<boolean>;
}

export interface BackendStatusStore {
  subscribe: (listener: () => void) => () => void;
  getStatus: () => BackendStatus;
  /** Runs one check now, unless one is already in flight. */
  poll: () => Promise<void>;
}

export function createBackendStatusStore({
  checkIntervalMs,
  timeoutMs,
  check = checkBackendHealth,
}: BackendStatusOptions): BackendStatusStore {
  const listeners = new Set<() => void>();
  let status: BackendStatus = 'checking';
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight: Promise<void> | null = null;

  function setStatus(next: BackendStatus) {
    if (next === status) return;
    status = next;
    listeners.forEach((listener) => listener());
  }

  function poll(): Promise<void> {
    inFlight ??= check(timeoutMs)
      .catch(() => false)
      .then((isHealthy) => setStatus(isHealthy ? 'online' : 'offline'))
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);

    if (timer === null) {
      void poll();
      timer = setInterval(() => void poll(), checkIntervalMs);
    }

    return () => {
      listeners.delete(listener);
      if (listeners.size > 0 || timer === null) return;

      clearInterval(timer);
      timer = null;
    };
  }

  return { subscribe, getStatus: () => status, poll };
}

export const backendStatusStore = createBackendStatusStore(APP_CONFIG.connection);

export function useBackendStatus(store: BackendStatusStore = backendStatusStore): BackendStatus {
  return useSyncExternalStore(store.subscribe, store.getStatus);
}
