import { useMemo, useState } from 'react';
import LayerPanel from './Controls/LayerPanel';
import MapControls from './Controls/MapControls';
import RefreshButton from './Controls/RefreshButton';
import MapLegend from './Legends/MapLegend';
import DrillholeFeatures from './Map/DrillholeFeatures';
import MapCanvas from './Map/MapCanvas';
import MapScaleBar from './Map/MapScaleBar';
import MapStatus from './Map/MapStatus';
import MeasurementOverlay from './Map/MeasurementOverlay';
import TechnoCells from './Map/TechnoCells';
import { MAP_CONFIG, MAP_ID, MAP_SETTINGS } from './config/technoMapConfig';
import { useMapData } from './hooks/useMapData';
import { useMapFilters } from './hooks/useMapFilters';
import { useMapViewport } from './hooks/useMapViewport';
import { drillholeExtent, mapRatioToUtm } from './utils/coordinates';
import { exportMap } from './utils/exportMap';
import type { ExportFormat } from './utils/exportMap';
import { buildCanvasTransformStyle, isViewZoomed, measuredMapSize, toPixels } from './utils/geometry';
import { addMeasurementPoint } from './utils/measurement';
import { showToast } from '../../components/Toast/toastStore';
import type { StyleWithCssVariables, UtmCoordinates } from '../../types/map';
import './TechnoMap.css';

/** Floating panels that keep presses, the wheel and double-click for themselves. */
const OVERLAY_SELECTOR = '.map-toolbar, .map-layers';
/** Drags starting on these pan nothing: they are clicks on a marker or a control. */
const DRAG_IGNORE_SELECTOR = `.drillhole-marker, ${OVERLAY_SELECTOR}`;

/** Feature colours from technoMap.yaml, for the stylesheet. */
const PAGE_STYLE: StyleWithCssVariables = {
  '--deviation-color': MAP_CONFIG.deviationLine.color,
  '--measure-color': MAP_CONFIG.measurement.color,
  '--cell-stroke': MAP_CONFIG.technologicalCells.stroke,
  '--cell-fill': MAP_CONFIG.technologicalCells.fill,
};

/** Techno Map: the demo dataset or /api/techno-map, with layer filters, measurement and export. */
function TechnoMap() {
  const { status, drillholes, cells, isFetching, failure, isDemo, refresh } = useMapData();
  const { filters, setFilter, setAll } = useMapFilters();
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurement, setMeasurement] = useState<UtmCoordinates[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  // Every drillhole, whatever the filters, so Reset always frames the whole dataset.
  const fitBox = useMemo(() => drillholeExtent(drillholes), [drillholes]);

  const { viewportRef, view, renderedMapSize, mapOrigin, viewportSize, isDragging, viewportHandlers, image, controls } = useMapViewport({
    settings: MAP_SETTINGS,
    viewKey: MAP_ID,
    // While measuring, a press on a marker is a press on the map: measurement
    // wins over the marker (which also stops catching the pointer, see CSS).
    dragIgnoreSelector: isMeasuring ? OVERLAY_SELECTOR : DRAG_IGNORE_SELECTOR,
    overlaySelector: OVERLAY_SELECTOR,
    fitBox,
    onMapClick: isMeasuring
      ? (ratio) => setMeasurement((points) => addMeasurementPoint(points, mapRatioToUtm(ratio)))
      : undefined,
  });

  const mapWidth = toPixels(renderedMapSize.width);
  const mapHeight = toPixels(renderedMapSize.height);
  const mapSize = measuredMapSize(renderedMapSize);
  const viewportState = `${isDragging ? ' is-dragging' : ''}${isViewZoomed(view, MAP_SETTINGS.minZoom) ? ' is-zoomed' : ''}${isMeasuring ? ' is-measuring' : ''}`;

  const handleExport = async (format: ExportFormat) => {
    // An export without its base map would misrepresent the map, so none is made.
    if (!mapSize || image.hasFailed) {
      showToast('error', 'Map export failed: the base map is not loaded.');
      return;
    }

    setIsExporting(true);
    try {
      await exportMap(format, {
        viewport: viewportSize,
        view,
        mapOrigin,
        mapSize,
        drillholes,
        cells,
        filters,
        measurement,
        title: isDemo ? `${MAP_CONFIG.title} (Demo data)` : MAP_CONFIG.title,
      });
      showToast('success', 'Map exported successfully');
    } catch {
      showToast('error', 'Map export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="techno-map-page" style={PAGE_STYLE}>
      <header className="map-header">
        <div className="map-header__title">
          <h1>{MAP_CONFIG.title}</h1>
          {isDemo && <span className="map-demo-badge" title="Showing the fixed demo dataset, not backend data">Demo</span>}
        </div>
        <div className="mb-[3px] flex shrink-0 items-center gap-2">
          <RefreshButton isRefreshing={isFetching} onRefresh={refresh} />
          <strong>{drillholes.length} drillholes</strong>
        </div>
      </header>

      <div className="map-panel">
        <div ref={viewportRef} className={`map-viewport${viewportState}`} {...viewportHandlers}>
          <MapCanvas
            style={buildCanvasTransformStyle(view, renderedMapSize)}
            onImageLoad={image.onLoad}
            onImageError={image.onError}
          >
            {!image.hasFailed && (
              <>
                {filters['technological-cells'] && <TechnoCells cells={cells} mapWidth={mapWidth} mapHeight={mapHeight} />}
                <DrillholeFeatures
                  drillholes={drillholes}
                  deviationVisible={filters['deviation-line'] && view.scale >= MAP_SETTINGS.deviationMinZoom}
                  mapWidth={mapWidth}
                  mapHeight={mapHeight}
                  filters={filters}
                />
              </>
            )}
          </MapCanvas>

          <MeasurementOverlay points={measurement} view={view} mapOrigin={mapOrigin} mapSize={mapSize} />
          <MapStatus status={status} imageFailed={image.hasFailed} failure={failure} />
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
            isExporting={isExporting}
            onExport={(format) => void handleExport(format)}
          />
          <LayerPanel filters={filters} onChange={setFilter} onSetAll={setAll} />
          <div className="north-arrow" aria-label="North"><span>N</span><i /></div>
          <MapScaleBar mapWidth={mapWidth} zoom={view.scale} />
        </div>

        {MAP_CONFIG.showLegends && <MapLegend filters={filters} />}
      </div>
    </section>
  );
}

export default TechnoMap;
