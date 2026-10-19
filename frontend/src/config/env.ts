import type { MapBounds } from '../types/map';

/**
 * Environment variables arrive as strings or not at all, so every read goes
 * through a converter that states what happens when the value is missing or
 * unusable. Nothing here falls back on implicit JavaScript coercion: `Number('')`
 * is 0, and a map bound silently defaulting to 0 would place every drillhole
 * in the wrong place instead of failing visibly.
 *
 * Only non-secret values belong here. Everything Vite inlines under a `VITE_`
 * prefix ships inside the client bundle and is readable by anyone.
 */

/** Reads a text variable, treating blank and absent as the same thing. */
export function readEnvText(value: string | undefined, fallback: string): string {
  if (typeof value !== 'string') return fallback;

  const trimmed = value.trim();

  return trimmed === '' ? fallback : trimmed;
}

/** Reads a numeric variable, rejecting anything that is not a finite number. */
export function readEnvNumber(value: string | undefined, fallback: number): number {
  if (typeof value !== 'string') return fallback;

  const trimmed = value.trim();
  if (trimmed === '') return fallback;

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Base URL of the drillhole API.
 *
 * Defaults to the empty string rather than to `undefined`, so a missing
 * variable produces the same-origin path `/api/exploration-map` instead of
 * the string `undefined/api/exploration-map`.
 */
export const API_BASE_URL: string = readEnvText(import.meta.env.VITE_API_BASE_URL, '');

/** Public path of the base map image. */
export const MAP_IMAGE_PATH: string = readEnvText(
  import.meta.env.VITE_MAP_IMAGE_PATH,
  '/base-map.svg',
);

/**
 * UTM rectangle covered by the base map image.
 *
 * The defaults are the surveyed bounds of the current base map and are what
 * the application used before these overrides existed, so an unset
 * environment leaves the projection exactly as it was.
 */
export const MAP_UTM_BOUNDS_FROM_ENV: Readonly<MapBounds> = Object.freeze({
  minX: readEnvNumber(import.meta.env.VITE_MAP_MIN_X, 412499.97),
  maxX: readEnvNumber(import.meta.env.VITE_MAP_MAX_X, 423375.13),
  minY: readEnvNumber(import.meta.env.VITE_MAP_MIN_Y, 4890500),
  maxY: readEnvNumber(import.meta.env.VITE_MAP_MAX_Y, 4898190.29),
});
