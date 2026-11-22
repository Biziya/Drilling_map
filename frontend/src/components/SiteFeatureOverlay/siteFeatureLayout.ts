import type { SiteFeature } from '../../services/siteFeatures/siteFeatures';
import type { SnapTarget } from '../../utils/snapPoint';
import type { MapBounds, Point, UtmCoordinates } from '../../types/map';

/** On-screen icon size (px); it stays the same at every zoom. */
export const SITE_ICON_SIZE = 32;
/** The class every icon button carries, for the page's drag-ignore selector. */
export const SITE_ICON_CLASS = 'site-feature-icon';
/** Extra px around a symbol that still counts as on it. */
export const SNAP_SLOP = 2;

/** Each site icon as a measurement snap target: a press on the icon measures from the feature's own point. */
export function siteFeatureSnapTargets(features: readonly SiteFeature[], toViewport: (point: UtmCoordinates) => Point): SnapTarget[] {
  return features.map((feature) => ({ at: toViewport(feature.utm), radius: SITE_ICON_SIZE / 2 + SNAP_SLOP, utm: feature.utm }));
}

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
