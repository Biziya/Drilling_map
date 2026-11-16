import { MAP_SETTINGS } from '../config/technoMapConfig';
import { useEffect } from 'react';
import HexagonUploadPanel from './HexagonUploadPanel';
import { usePopover } from '../../../components/SelectionTable/usePopover';
import type { HexagonSource } from '../utils/hexagons';
import { BoxSelectIcon, CameraIcon, RulerIcon, UploadIcon } from './icons';

export interface MapControlsProps {
  /** Current zoom level, for the disabled states. */
  zoom: number;
  /** Deepest zoom allowed now (the scale bar limit), for the + button. */
  maxZoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  /** A wellfield Excel file picked or dropped in the Upload window. */
  onUpload: (file: File) => void;
  isUploading: boolean;
  /** The uploaded hexagon file, shown in the Upload window, or null. */
  hexagons: HexagonSource | null;
  onClearHexagons: () => void;
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
  maxZoom,
  onZoomIn,
  onZoomOut,
  onReset,
  onUpload,
  isUploading,
  hexagons,
  onClearHexagons,
  isMeasuring,
  onToggleMeasure,
  isBoxSelecting,
  onToggleBoxSelect,
  isExporting,
  isSelecting,
  onToggleScreenshot,
}: MapControlsProps) {
  // The Upload window sits above the button row, outside it: the row clips its overflow.
  const upload = usePopover<HTMLButtonElement>();
  const { setIsOpen: setUploadOpen } = upload;
  useEffect(() => {
    if (isSelecting) setUploadOpen(false);
  }, [isSelecting, setUploadOpen]);

  return (
    <div className="map-toolbar">
      {upload.isOpen && (
        <HexagonUploadPanel hexagons={hexagons} isUploading={isUploading} onUpload={onUpload} onClear={onClearHexagons} panelRef={upload.panelRef} />
      )}
      <div className="map-controls" aria-label="Map controls">
        <button type="button" onClick={onZoomIn} disabled={isSelecting || zoom >= maxZoom} aria-label="Zoom in" title="Zoom in">+</button>
        <button type="button" onClick={onZoomOut} disabled={isSelecting || zoom <= MAP_SETTINGS.minZoom} aria-label="Zoom out" title="Zoom out">−</button>
        <button
          ref={(element) => {
            upload.wrapperRef.current = element;
            upload.buttonRef.current = element;
          }}
          className={`map-controls__icon${upload.isOpen ? ' is-active' : ''}`}
          type="button"
          disabled={isSelecting}
          onClick={() => upload.setIsOpen((open) => !open)}
          aria-haspopup="dialog"
          aria-expanded={upload.isOpen}
          aria-busy={isUploading}
          aria-label="Upload hexagons from Excel"
          title="Upload hexagons from Excel (.xlsx)"
        >
          <UploadIcon />
        </button>
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
