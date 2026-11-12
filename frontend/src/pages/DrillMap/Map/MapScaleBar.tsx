import { memo } from 'react';
import { computeScaleBar } from '../utils/scaleBar';
import type { MapBounds } from '../../../types/map';

export interface MapScaleBarProps {
  /** Rendered width of the base map in CSS pixels, before zoom. */
  mapWidth: number;
  zoom: number;
  /** UTM corners of the selected base map. */
  bounds: MapBounds;
}

function MapScaleBar({ mapWidth, zoom, bounds }: MapScaleBarProps) {
  const scaleBar = computeScaleBar({ mapWidth, zoom, bounds });
  if (!scaleBar) return null;

  return (
    <div className="map-scale-bar" aria-label={`Map scale: ${scaleBar.label}`}>
      <div className="map-scale-bar__line" style={{ width: `${scaleBar.width}px` }} aria-hidden="true" />
      <span>{scaleBar.label}</span>
    </div>
  );
}

export default memo(MapScaleBar);
