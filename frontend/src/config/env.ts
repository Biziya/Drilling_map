import type { MapBounds } from '../types/map';

/**
 * Environment variables arrive as strings or not at all, so every read states
 * what happens when the value is missing or unusable. `Number('')` is 0, and a
 * map bound silently defaulting to 0 would misplace every drillhole.
 *
 * Only non-secret values belong here: every `VITE_` variable is inlined into
 * the client bundle.
 */

/** Reads a text variable, treating blank and absent as the same thing. */
export function readEnvText(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();

  return trimmed ? trimmed : fallback;
}

/**
 * Reads a flag. Only the exact words `true` and `false` count, so a typo
 * falls back rather than quietly reading as false and pointing a dashboard
 * at a backend that is not there.
 */
export function readEnvBoolean(value: string | undefined, fallback: boolean): boolean {
  const trimmed = value?.trim().toLowerCase();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  return fallback;
}

/** Reads a numeric variable, rejecting anything that is not a finite number. */
export function readEnvNumber(value: string | undefined, fallback: number): number {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Origin of the map backend. Empty means same-origin (`/api/...`). */
export const API_BASE_URL = readEnvText(import.meta.env.VITE_API_BASE_URL, '');

/**
 * Base path of the Weekly Geos dashboard API.
 *
 * This is a second, separate service: the map pages talk to the drilling
 * API, the dashboard to the reporting API, and the two do not share a port.
 * So the dashboard cannot reuse `/api`, which the dev server already
 * forwards to the map backend — it gets its own prefix, forwarded in
 * vite.config.ts to VITE_WEEKLY_PROXY_TARGET.
 *
 * Point this at an absolute URL to bypass the proxy and call the reporting
 * API directly; it must then send CORS headers for this origin.
 */
export const WEEKLY_API_BASE_URL = readEnvText(import.meta.env.VITE_WEEKLY_API_BASE_URL, '/weekly-api');

/** Runs the dashboard on generated data, with no reporting backend at all. */
export const WEEKLY_USE_MOCK = readEnvBoolean(import.meta.env.VITE_WEEKLY_USE_MOCK, false);

/** Public path of the base map image. */
export const MAP_IMAGE_PATH = readEnvText(import.meta.env.VITE_MAP_IMAGE_PATH, '/base-map.svg');

/** UTM rectangle covered by the base map image (surveyed bounds by default). */
export const MAP_UTM_BOUNDS: Readonly<MapBounds> = Object.freeze({
  minX: readEnvNumber(import.meta.env.VITE_MAP_MIN_X, 335469.35),
  maxX: readEnvNumber(import.meta.env.VITE_MAP_MAX_X, 483969.35),
  minY: readEnvNumber(import.meta.env.VITE_MAP_MIN_Y, 4843775.24),
  maxY: readEnvNumber(import.meta.env.VITE_MAP_MAX_Y, 4948775.24),
});
