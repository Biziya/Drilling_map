import { MAP_SETTINGS } from '../config/drillMapConfig';
import { CameraIcon, RulerIcon } from './icons';

export interface MapControlsProps {
  /** Current zoom level, for the disabled states. */
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  isMeasuring: boolean;
  onToggleMeasure: () => void;
  /** True while a screenshot export runs; the camera is disabled meanwhile. */
  isExporting: boolean;
  isSelecting: boolean;
  onToggleScreenshot: () => void;
}

/** Floating toolbar: zoom in/out, reset, measure, screenshot. */
function MapControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  isMeasuring,
  onToggleMeasure,
  isExporting,
  isSelecting,
  onToggleScreenshot,
}: MapControlsProps) {
  return (
    <div className="map-toolbar">
      <div className="map-controls" aria-label="Map controls">
        <button type="button" onClick={onZoomIn} disabled={isSelecting || zoom >= MAP_SETTINGS.maxZoom} aria-label="Zoom in" title="Zoom in">+</button>
        <button type="button" onClick={onZoomOut} disabled={isSelecting || zoom <= MAP_SETTINGS.minZoom} aria-label="Zoom out" title="Zoom out">−</button>
        <button className="map-controls__reset" type="button" disabled={isSelecting} onClick={onReset} title="Reset view">Reset</button>
        <button
          className={`map-controls__icon${isMeasuring ? ' is-active' : ''}`}
          type="button"
          disabled={isSelecting} onClick={onToggleMeasure}
          aria-pressed={isMeasuring}
          aria-label="Measure distance"
          title="Measure distance"
        >
          <RulerIcon />
        </button>
        <button
          className="map-controls__icon"
          type="button"
          onClick={onToggleScreenshot}
          disabled={isExporting}
          aria-busy={isExporting}
          aria-pressed={isSelecting}
          aria-label="Screenshot map"
          title="Screenshot map"
        >
          <CameraIcon />
        </button>
      </div>
    </div>
  );
}

export default MapControls;
