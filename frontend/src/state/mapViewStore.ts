// Switching pages in App unmounts the map that was on screen, which would
// normally throw away its zoom and pan. Each map writes its latest view here
// under its own key, so returning to a map restores exactly where it was left.
//
// The store lives at module scope: it survives unmount/remount for the whole
// session without turning the view into shared React state that both maps
// would re-render on.

import type { MapTransform } from '../types/map';

/** Identifies one map's stored view. Each page owns exactly one key. */
export type MapViewKey = 'exploration-map' | 'techno-map';

const views = new Map<MapViewKey, MapTransform>();

/**
 * Reads a stored view, or `fallbackView` when this map has not stored one.
 *
 * The fallback is generic so a caller can ask for `null` and distinguish
 * "never stored" from a real view, which is what the callers that only want
 * to know whether a view exists rely on.
 */
export function readMapView<TFallback>(
  key: MapViewKey | null | undefined,
  fallbackView: TFallback,
): MapTransform | TFallback {
  if (!key) return fallbackView;

  return views.get(key) ?? fallbackView;
}

export function writeMapView(
  key: MapViewKey | null | undefined,
  view: MapTransform | null | undefined,
): void {
  if (!key || !view) return;

  views.set(key, view);
}

// clearMapView and clearAllMapViews have no caller in src/. They exist for
// tests, which reset the module-scope store between cases, and as the
// obvious hook for a future "reset all views" action. Not dead code.
export function clearMapView(key: MapViewKey | null | undefined): void {
  if (!key) return;

  views.delete(key);
}

export function clearAllMapViews(): void {
  views.clear();
}
