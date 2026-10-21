import { useState } from 'react';
import { MAP_SETTINGS } from '../config/technoMapConfig';
import type { ExportFormat } from '../utils/exportMap';

export interface MapControlsProps {
  /** Current zoom level, for the readout and the disabled states. */
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  isMeasuring: boolean;
  onToggleMeasure: () => void;
  /** True while an export runs; the export button is disabled meanwhile. */
  isExporting: boolean;
  onExport: (format: ExportFormat) => void;
}

const EXPORT_OPTIONS: readonly { format: ExportFormat; label: string }[] = [
  { format: 'png', label: 'Export as PNG' },
  { format: 'svg', label: 'Export as SVG' },
];

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

/** Floating toolbar: zoom in/out, reset, measure, export, and the zoom readout. */
function MapControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  isMeasuring,
  onToggleMeasure,
  isExporting,
  onExport,
}: MapControlsProps) {
  const [isExportOpen, setIsExportOpen] = useState(false);

  return (
    <div
      className="map-toolbar"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsExportOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setIsExportOpen(false);
      }}
    >
      <div className="map-controls" aria-label="Map controls">
        <button type="button" onClick={onZoomIn} disabled={zoom >= MAP_SETTINGS.maxZoom} aria-label="Zoom in" title="Zoom in">+</button>
        <button type="button" onClick={onZoomOut} disabled={zoom <= MAP_SETTINGS.minZoom} aria-label="Zoom out" title="Zoom out">−</button>
        <button className="map-controls__reset" type="button" onClick={onReset} title="Fit all drillholes">Reset</button>
        <button
          className={`map-controls__icon${isMeasuring ? ' is-active' : ''}`}
          type="button"
          onClick={onToggleMeasure}
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
          onClick={() => setIsExportOpen((current) => !current)}
          disabled={isExporting}
          aria-busy={isExporting}
          aria-haspopup="menu"
          aria-expanded={isExportOpen}
          aria-label="Export map"
          title="Export map"
        >
          <svg {...ICON_PROPS}>
            <path d="M12 3v12M7 10l5 5 5-5" />
            <path d="M4 17v3h16v-3" />
          </svg>
        </button>
        <span className="map-controls__level" aria-live="polite">{Math.round(zoom * 100)}%</span>
      </div>

      {isExportOpen && (
        <div className="map-export-menu" role="menu" aria-label="Export map">
          {EXPORT_OPTIONS.map(({ format, label }) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              onClick={() => {
                setIsExportOpen(false);
                onExport(format);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default MapControls;
