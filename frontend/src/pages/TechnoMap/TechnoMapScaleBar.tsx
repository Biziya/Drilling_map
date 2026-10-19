import { memo, useMemo } from 'react';
import { computeScaleBar } from '../../map/scaleBar';
import { TECHNO_MAP_UTM_BOUNDS } from './technoMapConfig';

export interface TechnoMapScaleBarProps {
  /** Rendered width of the base map in CSS pixels, before zoom. */
  mapWidth: number;
  zoom: number;
}

function TechnoMapScaleBar({ mapWidth, zoom }: TechnoMapScaleBarProps) {
  const scaleBar = useMemo(
    () => computeScaleBar({ mapWidth, zoom, bounds: TECHNO_MAP_UTM_BOUNDS }),
    [mapWidth, zoom],
  );

  if (!scaleBar) return null;

  return (
    <div className="techno-map-scale-bar" aria-label={`Map scale: ${scaleBar.label}`}>
      <div
        className="techno-map-scale-bar__line"
        style={{ width: `${scaleBar.width}px` }}
        aria-hidden="true"
      />
      <span>{scaleBar.label}</span>
    </div>
  );
}

export default memo(TechnoMapScaleBar);
