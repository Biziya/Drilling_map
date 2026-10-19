import { TECHNO_MAP_SETTINGS } from './technoMapConfig';

export interface TechnoMapControlsProps {
  /** Current zoom level, used for the readout and the disabled states. */
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

function TechnoMapControls({ zoom, onZoomIn, onZoomOut, onReset }: TechnoMapControlsProps) {
  return (
    <div className="techno-map-controls" aria-label="Map controls">
      <button type="button" onClick={onZoomIn} disabled={zoom >= TECHNO_MAP_SETTINGS.maxZoom} aria-label="Zoom in">+</button>
      <button type="button" onClick={onZoomOut} disabled={zoom <= TECHNO_MAP_SETTINGS.minZoom} aria-label="Zoom out">−</button>
      <button className="techno-map-controls__reset" type="button" onClick={onReset}>Reset</button>
      <span className="techno-map-controls__level" aria-live="polite">{Math.round(zoom * 100)}%</span>
    </div>
  );
}

export default TechnoMapControls;
