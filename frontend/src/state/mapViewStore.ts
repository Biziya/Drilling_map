// Switching pages unmounts the map on screen, which would throw away its zoom
// and pan. Each map writes its latest view here under its own key, so going
// back to a map restores exactly where it was left. Module scope keeps it for
// the session without making it shared React state.

import type { MapId, MapTransform } from '../types/map';

const views = new Map<MapId, MapTransform>();

/** Reads a stored view, or `fallbackView` when this map has not stored one. */
export function readMapView<TFallback>(
  key: MapId | null | undefined,
  fallbackView: TFallback,
): MapTransform | TFallback {
  return (key && views.get(key)) || fallbackView;
}

export function writeMapView(key: MapId | null | undefined, view: MapTransform | null | undefined): void {
  if (key && view) views.set(key, view);
}

export function clearMapView(key: MapId | null | undefined): void {
  if (key) views.delete(key);
}

export function clearAllMapViews(): void {
  views.clear();
}
