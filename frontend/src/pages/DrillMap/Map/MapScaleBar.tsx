import { memo } from 'react';
import { MAP_UTM_BOUNDS } from '../config/drillMapConfig';
import { computeScaleBar } from '../utils/scaleBar';

export interface MapScaleBarProps {
  /** Rendered width of the base map in CSS pixels, before zoom. */
  mapWidth: number;
  zoom: number;
}

function MapScaleBar({ mapWidth, zoom }: MapScaleBarProps) {
  const scaleBar = computeScaleBar({ mapWidth, zoom, bounds: MAP_UTM_BOUNDS });
  if (!scaleBar) return null;

  return (
    <div className="map-scale-bar" aria-label={`Map scale: ${scaleBar.label}`}>
      <div className="map-scale-bar__line" style={{ width: `${scaleBar.width}px` }} aria-hidden="true" />
      <span>{scaleBar.label}</span>
    </div>
  );
}

export default memo(MapScaleBar);
