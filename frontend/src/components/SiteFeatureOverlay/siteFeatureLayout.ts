import type { MapBounds } from '../../types/map';

/** On-screen icon size (px); it stays the same at every zoom. */
export const SITE_ICON_SIZE = 32;
/** The class every icon button carries, for the page's drag-ignore selector. */
export const SITE_ICON_CLASS = 'site-feature-icon';

/**
 * True when the map is zoomed in far enough for the footprints: 100 px on
 * screen covers at most `maxMetersPer100Px` metres (the raw scale, not the
 * scale bar's rounded label). False until the base map has a size.
 */
export function siteOutlinesVisible(bounds: MapBounds, mapWidth: number, zoom: number, maxMetersPer100Px: number): boolean {
  const pixels = mapWidth * zoom;
  if (!(pixels > 0)) return false;

  return (100 * (bounds.maxX - bounds.minX)) / pixels <= maxMetersPer100Px;
}
