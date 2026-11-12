import MapScreenshot from '../../components/MapScreenshot/MapScreenshot';
import HelpButton from '../../components/HelpDialog/HelpDialog';
import type { CaptureRect } from '../../components/MapScreenshot/MapScreenshot';
import { useMemo, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import BaseMapSwitcher from './Controls/BaseMapSwitcher';
import MapControls from './Controls/MapControls';
import RefreshButton from './Controls/RefreshButton';
import MapLegend from './Legends/MapLegend';
import CoordinateGrid from './Map/CoordinateGrid';
import DrillholeFeatures from './Map/DrillholeFeatures';
import MapCanvas from './Map/MapCanvas';
import MapScaleBar from './Map/MapScaleBar';
import MapStatus from './Map/MapStatus';
import MeasurementOverlay from './Map/MeasurementOverlay';
import { MAP_CONFIG, MAP_ID, MAP_SETTINGS, baseMapLayout } from './config/drillMapConfig';
import type { BaseMapId } from './config/drillMapConfig';
import { HELP_SECTIONS } from './config/helpContent';
import { useBaseMap } from './hooks/useBaseMap';
import { projectRecords, useMapData } from './hooks/useMapData';
import { useMapViewport } from './hooks/useMapViewport';
import { mapRatioToUtm } from './utils/coordinates';
import { exportMap } from './utils/exportMap';
import type { ExportFormat } from './utils/exportMap';
import { buildCanvasTransformStyle, isViewZoomed, measuredMapSize, toPixels } from './utils/geometry';
import { addMeasurementPoint } from './utils/measurement';
import { showToast } from '../../components/Toast/toastStore';
import type { StyleWithCssVariables, UtmCoordinates } from '../../types/map';
import './DrillMap.css';

/** Floating controls that keep presses, the wheel and double-click for themselves. */
const OVERLAY_SELECTOR = '.map-toolbar';
/** Drags starting on these pan nothing: they are clicks on a marker or a control. */
const DRAG_IGNORE_SELECTOR = `.drillhole-marker, ${OVERLAY_SELECTOR}`;

const PAGE_STYLE: StyleWithCssVariables = { '--measure-color': MAP_CONFIG.measurement.color };

/** Exploration Map: SEDIMENT/DEVELOP holes from /api/exploration-map. */
function DrillMap() {
  const { status, records, isFetching, failure, refresh } = useMapData();
  const { baseMap, setBaseMap } = useBaseMap();
  const layout = baseMapLayout(baseMap);
  const { bounds } = layout;
  const drillholes = useMemo(() => projectRecords(records, bounds), [records, bounds]);
  /** Set when another image was chosen: the view is reset once it has loaded. */
  const resetOnLoadRef = useRef(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurement, setMeasurement] = useState<UtmCoordinates[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { viewportRef, view, renderedMapSize, mapOrigin, viewportSize, isDragging, viewportHandlers, image, controls } = useMapViewport({
    settings: MAP_SETTINGS,
    viewKey: MAP_ID,
    // While measuring, a press on a marker is a press on the map: measurement
    // wins over the marker (which also stops catching the pointer, see CSS).
    dragIgnoreSelector: isMeasuring ? OVERLAY_SELECTOR : DRAG_IGNORE_SELECTOR,
    overlaySelector: OVERLAY_SELECTOR,
    onMapClick: isMeasuring
      ? (ratio) => setMeasurement((points) => addMeasurementPoint(points, mapRatioToUtm(ratio, bounds)))
      : undefined,
  });

  const mapWidth = toPixels(renderedMapSize.width);
  const mapSize = measuredMapSize(renderedMapSize);
  const viewportState = `${isDragging ? ' is-dragging' : ''}${isViewZoomed(view, MAP_SETTINGS.minZoom) ? ' is-zoomed' : ''}${isMeasuring ? ' is-measuring' : ''}`;

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    image.onLoad(event);
    if (!resetOnLoadRef.current) return;
    resetOnLoadRef.current = false;
    controls.reset();
  };

  // Another image covers another rectangle at another size, so the old view
  // and measurement no longer fit it. Geological and White Grid share one
  // layout, so switching between them keeps both, as before.
  const handleBaseMapChange = (next: BaseMapId) => {
    const nextLayout = baseMapLayout(next);
    if (nextLayout.imageSrc !== layout.imageSrc || nextLayout.bounds !== bounds) {
      setMeasurement([]);
      // Same image, other corners: no load event follows, so reset now.
      if (nextLayout.imageSrc === layout.imageSrc) controls.reset();
      else resetOnLoadRef.current = true;
    }
    setBaseMap(next);
  };

  const handleExport = async (format: ExportFormat, capture: CaptureRect) => {
    // An export without its base map would misrepresent the map, so none is made.
    if (!mapSize || image.hasFailed) {
      showToast('error', 'Map export failed: the base map is not loaded.');
      return;
    }

    setIsExporting(true);
    try {
      await exportMap(format, { capture, viewport: viewportSize, view, mapOrigin, mapSize, drillholes, measurement, title: MAP_CONFIG.title, src: layout.src, bounds });
      showToast('success', 'Map exported successfully');
    } catch {
      showToast('error', 'Map export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="drill-map-page" style={PAGE_STYLE}>
      <header className="map-header">
        <h1>{MAP_CONFIG.title}</h1>
        <div className="mb-[3px] flex shrink-0 items-center gap-2">
          <RefreshButton isRefreshing={isFetching} onRefresh={refresh} />
          <BaseMapSwitcher value={baseMap} onChange={handleBaseMapChange} />
          <strong>{drillholes.length} drillholes</strong>
          <HelpButton title={MAP_CONFIG.title} sections={HELP_SECTIONS} />
        </div>
      </header>

      <div className="map-panel">
        <div ref={viewportRef} className={`map-viewport${viewportState}${isSelecting ? ' is-selecting' : ''}`} {...viewportHandlers}>
          {/* Only the background changes with the base map; the view and every feature stay put. */}
          {layout.src === null && !image.hasFailed && (
            <CoordinateGrid viewport={viewportSize} view={view} mapOrigin={mapOrigin} mapSize={mapSize} bounds={bounds} />
          )}
          <MapCanvas
            style={buildCanvasTransformStyle(view, renderedMapSize)}
            src={layout.imageSrc}
            onImageLoad={handleImageLoad}
            onImageError={image.onError}
            showImage={layout.src !== null}
          >
            {!image.hasFailed && (
              <DrillholeFeatures
                drillholes={drillholes}
                bounds={bounds}
                deviationVisible={view.scale >= MAP_SETTINGS.deviationMinZoom}
                mapWidth={mapWidth}
                mapHeight={toPixels(renderedMapSize.height)}
              />
            )}
          </MapCanvas>

          <MeasurementOverlay points={measurement} view={view} mapOrigin={mapOrigin} mapSize={mapSize} bounds={bounds} />
          <MapStatus status={status} imageFailed={image.hasFailed} src={layout.imageSrc} failure={failure} />
          <MapControls
            zoom={view.scale}
            onZoomIn={controls.zoomIn}
            onZoomOut={controls.zoomOut}
            onReset={controls.reset}
            isMeasuring={isMeasuring}
            onToggleMeasure={() => {
              setIsMeasuring((current) => !current);
              setMeasurement([]);
            }}
            isSelecting={isSelecting}
            onToggleScreenshot={() => {
              setIsSelecting((current) => !current);
              setIsMeasuring(false);
            }}
            isExporting={isExporting}
          />
          <div className="north-arrow" aria-label="North"><span>N</span><i /></div>
          {isSelecting && <MapScreenshot viewportRef={viewportRef}
            onCancel={() => setIsSelecting(false)}
            onCapture={(rect, format) => { setIsSelecting(false); void handleExport(format, rect); }} />}
          <MapScaleBar mapWidth={mapWidth} zoom={view.scale} bounds={bounds} />
        </div>

        {MAP_CONFIG.showLegends && <MapLegend />}
      </div>
    </section>
  );
}

export default DrillMap;
