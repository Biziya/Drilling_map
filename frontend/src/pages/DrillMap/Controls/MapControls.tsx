import { MAP_SETTINGS } from '../config/drillMapConfig';

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

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

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
          {/* A ruler laid diagonally, with tick marks. */}
          <svg {...ICON_PROPS}>
            <path d="M3 17 17 3l4 4L7 21z" />
            <path d="m7 13 2 2M10 10l2 2M13 7l2 2" />
          </svg>
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
          <svg {...ICON_PROPS}>
            <path d="M14.5 4h-5L7 7H4v13h16V7h-3z" /><circle cx="12" cy="13" r="3.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default MapControls;
