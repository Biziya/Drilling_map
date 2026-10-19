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

/** Reads a numeric variable, rejecting anything that is not a finite number. */
export function readEnvNumber(value: string | undefined, fallback: number): number {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Origin of the backend API. Empty means same-origin (`/api/...`). */
export const API_BASE_URL = readEnvText(import.meta.env.VITE_API_BASE_URL, '');

/** Public path of the base map image. */
export const MAP_IMAGE_PATH = readEnvText(import.meta.env.VITE_MAP_IMAGE_PATH, '/base-map.svg');

/** UTM rectangle covered by the base map image (surveyed bounds by default). */
export const MAP_UTM_BOUNDS: Readonly<MapBounds> = Object.freeze({
  minX: readEnvNumber(import.meta.env.VITE_MAP_MIN_X, 412499.97),
  maxX: readEnvNumber(import.meta.env.VITE_MAP_MAX_X, 423375.13),
  minY: readEnvNumber(import.meta.env.VITE_MAP_MIN_Y, 4890500),
  maxY: readEnvNumber(import.meta.env.VITE_MAP_MAX_Y, 4898190.29),
});
