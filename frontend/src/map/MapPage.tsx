import MapControls from './Controls/MapControls';
import RefreshButton from './Controls/RefreshButton';
import MapLegend from './Legends/MapLegend';
import DrillholeFeatures from './Map/DrillholeFeatures';
import MapCanvas from './Map/MapCanvas';
import MapScaleBar from './Map/MapScaleBar';
import MapStatus from './Map/MapStatus';
import { MAP_CONFIG, MAP_SETTINGS } from './config/mapConfig';
import type { MapPageConfig } from './config/mapConfig';
import { useMapData } from './hooks/useMapData';
import { useMapViewport } from './hooks/useMapViewport';
import { buildCanvasTransformStyle, isViewZoomed, toPixels } from './utils/geometry';
import type { FetchDrillholeRecords } from '../services/api/mapData';
import './map.css';

/** Drags starting on these pan nothing: they are clicks on a control. */
const DRAG_IGNORE_SELECTOR = '.drillhole-marker, .map-controls, .map-refresh';

export interface MapPageProps {
  config: MapPageConfig;
  fetchRecords: FetchDrillholeRecords;
}

/** One map page: header, the pannable map with its controls, and the legend. */
function MapPage({ config, fetchRecords }: MapPageProps) {
  const { viewportRef, view, renderedMapSize, isDragging, viewportHandlers, image, controls } = useMapViewport({
    settings: MAP_SETTINGS,
    viewKey: config.id,
    dragIgnoreSelector: DRAG_IGNORE_SELECTOR,
  });
  const { status, drillholes, isFetching, refresh } = useMapData(config.id, fetchRecords);

  const mapWidth = toPixels(renderedMapSize.width);
  const viewportState = `${isDragging ? ' is-dragging' : ''}${isViewZoomed(view, MAP_SETTINGS.minZoom) ? ' is-zoomed' : ''}`;

  return (
    <section className="map-page">
      <header className="map-header">
        <h1>{config.title}</h1>
        <strong>{drillholes.length} drillholes</strong>
      </header>

      <div className="map-panel">
        <div ref={viewportRef} className={`map-viewport${viewportState}`} {...viewportHandlers}>
          <MapCanvas
            style={buildCanvasTransformStyle(view, renderedMapSize)}
            onImageLoad={image.onLoad}
            onImageError={image.onError}
          >
            {!image.hasFailed && (
              <DrillholeFeatures
                drillholes={drillholes}
                fallbackMarkerKind={config.fallbackMarkerKind}
                markerLabels={config.markerLabels}
                deviationVisible={view.scale >= MAP_SETTINGS.deviationMinZoom}
                mapWidth={mapWidth}
                mapHeight={toPixels(renderedMapSize.height)}
              />
            )}
          </MapCanvas>

          <MapStatus status={status} imageFailed={image.hasFailed} />
          <MapControls zoom={view.scale} onZoomIn={controls.zoomIn} onZoomOut={controls.zoomOut} onReset={controls.reset} />
          <RefreshButton isRefreshing={isFetching} onRefresh={refresh} />
          <div className="north-arrow" aria-label="North"><span>N</span><i /></div>
          <MapScaleBar mapWidth={mapWidth} zoom={view.scale} />
        </div>

        {MAP_CONFIG.showLegends && <MapLegend symbols={config.legendSymbols} />}
      </div>
    </section>
  );
}

export default MapPage;
