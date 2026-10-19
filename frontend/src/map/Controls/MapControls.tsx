import { MAP_SETTINGS } from '../config/mapConfig';

export interface MapControlsProps {
  /** Current zoom level, for the readout and the disabled states. */
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

function MapControls({ zoom, onZoomIn, onZoomOut, onReset }: MapControlsProps) {
  return (
    <div className="map-controls" aria-label="Map controls">
      <button type="button" onClick={onZoomIn} disabled={zoom >= MAP_SETTINGS.maxZoom} aria-label="Zoom in">+</button>
      <button type="button" onClick={onZoomOut} disabled={zoom <= MAP_SETTINGS.minZoom} aria-label="Zoom out">−</button>
      <button className="map-controls__reset" type="button" onClick={onReset}>Reset</button>
      <span className="map-controls__level" aria-live="polite">{Math.round(zoom * 100)}%</span>
    </div>
  );
}

export default MapControls;
