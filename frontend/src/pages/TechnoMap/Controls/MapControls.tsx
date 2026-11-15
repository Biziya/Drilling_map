import { MAP_SETTINGS } from '../config/technoMapConfig';
import { useRef } from 'react';
import { BoxSelectIcon, CameraIcon, RulerIcon, UploadIcon } from './icons';

export interface MapControlsProps {
  /** Current zoom level, for the disabled states. */
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  /** A wellfield Excel file picked with the Upload button. */
  onUpload: (file: File) => void;
  isUploading: boolean;
  isMeasuring: boolean;
  onToggleMeasure: () => void;
  /** The rectangle select tool. */
  isBoxSelecting: boolean;
  onToggleBoxSelect: () => void;
  /** True while a screenshot export runs; the camera is disabled meanwhile. */
  isExporting: boolean;
  isSelecting: boolean;
  onToggleScreenshot: () => void;
}

/** Floating toolbar: zoom in/out, upload hexagons, reset, measure, area select, screenshot. */
function MapControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  onUpload,
  isUploading,
  isMeasuring,
  onToggleMeasure,
  isBoxSelecting,
  onToggleBoxSelect,
  isExporting,
  isSelecting,
  onToggleScreenshot,
}: MapControlsProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="map-toolbar">
      <div className="map-controls" aria-label="Map controls">
        <button type="button" onClick={onZoomIn} disabled={isSelecting || zoom >= MAP_SETTINGS.maxZoom} aria-label="Zoom in" title="Zoom in">+</button>
        <button type="button" onClick={onZoomOut} disabled={isSelecting || zoom <= MAP_SETTINGS.minZoom} aria-label="Zoom out" title="Zoom out">−</button>
        <button
          className="map-controls__icon"
          type="button"
          disabled={isSelecting || isUploading}
          onClick={() => fileRef.current?.click()}
          aria-busy={isUploading}
          aria-label="Upload hexagons from Excel"
          title="Upload hexagons from Excel (.xlsx)"
        >
          <UploadIcon />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          data-testid="hexagon-file-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared, so picking the same file again uploads it again.
            event.target.value = '';
            if (file) onUpload(file);
          }}
        />
        <button className="map-controls__reset" type="button" disabled={isSelecting} onClick={onReset} title="Fit all drillholes">Reset</button>
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
          className={`map-controls__icon${isBoxSelecting ? ' is-active' : ''}`}
          type="button"
          disabled={isSelecting} onClick={onToggleBoxSelect}
          aria-pressed={isBoxSelecting}
          aria-label="Select drillholes by area"
          title="Select drillholes by area"
        >
          <BoxSelectIcon />
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
