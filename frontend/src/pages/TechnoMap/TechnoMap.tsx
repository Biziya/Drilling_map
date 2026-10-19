import MapControls from './Controls/MapControls';
import RefreshButton from './Controls/RefreshButton';
import MapLegend from './Legends/MapLegend';
import DrillholeFeatures from './Map/DrillholeFeatures';
import MapCanvas from './Map/MapCanvas';
import MapScaleBar from './Map/MapScaleBar';
import MapStatus from './Map/MapStatus';
import { MAP_CONFIG, MAP_ID, MAP_SETTINGS } from './config/technoMapConfig';
import { useMapData } from './hooks/useMapData';
import { useMapViewport } from './hooks/useMapViewport';
import { buildCanvasTransformStyle, isViewZoomed, toPixels } from './utils/geometry';
import './TechnoMap.css';

/** Drags starting on these pan nothing: they are clicks on a control. */
const DRAG_IGNORE_SELECTOR = '.drillhole-marker, .map-controls';

/** Techno Map: PRODUCT/INJECT holes from /api/techno-map. */
function TechnoMap() {
  const { viewportRef, view, renderedMapSize, isDragging, viewportHandlers, image, controls } = useMapViewport({
    settings: MAP_SETTINGS,
    viewKey: MAP_ID,
    dragIgnoreSelector: DRAG_IGNORE_SELECTOR,
  });
  const { status, drillholes, isFetching, failure, refresh } = useMapData();

  const mapWidth = toPixels(renderedMapSize.width);
  const viewportState = `${isDragging ? ' is-dragging' : ''}${isViewZoomed(view, MAP_SETTINGS.minZoom) ? ' is-zoomed' : ''}`;

  return (
    <section className="techno-map-page">
      <header className="map-header">
        <h1>{MAP_CONFIG.title}</h1>
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
              <DrillholeFeatures
                drillholes={drillholes}
                deviationVisible={view.scale >= MAP_SETTINGS.deviationMinZoom}
                mapWidth={mapWidth}
                mapHeight={toPixels(renderedMapSize.height)}
              />
            )}
          </MapCanvas>

          <MapStatus status={status} imageFailed={image.hasFailed} failure={failure} />
          <MapControls zoom={view.scale} onZoomIn={controls.zoomIn} onZoomOut={controls.zoomOut} onReset={controls.reset} />
          <div className="north-arrow" aria-label="North"><span>N</span><i /></div>
          <MapScaleBar mapWidth={mapWidth} zoom={view.scale} />
        </div>

        {MAP_CONFIG.showLegends && <MapLegend />}
      </div>
    </section>
  );
}

export default TechnoMap;
