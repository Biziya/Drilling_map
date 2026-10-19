import DrillholeMapFeatures from './DrillholeMapFeatures';
import MapControls from './MapControls';
import MapLegend from './MapLegend';
import MapScaleBar from './MapScaleBar';
import MapCanvas from './MapCanvas';
import MapMissingNotice from './MapMissingNotice';
import MapStatusOverlay from './MapStatusOverlay';
import { classNames } from './classNames';
import { buildCanvasTransformStyle, toPixels } from './mapGeometry';
import { isViewZoomed } from './zoomMath';
import { useMapData } from './useMapData';
import { useMapViewport } from './useMapViewport';
import { fetchDrillholeMap } from '../../services/Api/drillholeMap';
import { DATASET_IDS } from '../../services/cache/drillholeCache';
import { MAP_SETTINGS } from './drillMapConfig';
import { convertUtmToMapPosition } from './utmCoordinates';
import type { MapViewKey } from '../../state/mapViewStore';
import type { CssVariableName, MapTransform } from '../../types/map';
import './DrillMap.css';

const INITIAL_VIEW: Readonly<MapTransform> = Object.freeze<MapTransform>({
  scale: MAP_SETTINGS.minZoom,
  translateX: 0,
  translateY: 0,
});

const DRAG_IGNORE_SELECTOR = '.drillhole-marker, .map-controls';

/** Custom property the stylesheet reads to keep marker size constant. */
const SCALE_VARIABLE: CssVariableName = '--inverse-map-scale';

// Keyed separately from the Techno Map so the two views never overwrite
// each other.
const VIEW_STATE_KEY: MapViewKey = 'exploration-map';

function DrillMap() {
  const { viewportRef, view, renderedMapSize, image, controls, drag } = useMapViewport({
    settings: MAP_SETTINGS,
    initialView: INITIAL_VIEW,
    dragIgnoreSelector: DRAG_IGNORE_SELECTOR,
    viewStateKey: VIEW_STATE_KEY,
  });

  const {
    status, drillholes, message, isRefreshing, refreshMessage, reload,
  } = useMapData({
    fetchRecords: fetchDrillholeMap,
    project: convertUtmToMapPosition,
    cacheKey: DATASET_IDS.explorationMap,
  });

  const mapWidth = toPixels(renderedMapSize.width);
  const mapHeight = toPixels(renderedMapSize.height);

  return (
    <section className="drill-map-page">
      <header className="drill-map-header">
        <h1>Exploration Map</h1>
        <strong>
          {drillholes.length} drillholes
          {/* Cached drillholes are already on screen while the API catches
              up, so the staleness is stated rather than hidden. */}
          {isRefreshing && <em> · updating</em>}
        </strong>

        {/* A background refresh that fails leaves stale drillholes on screen.
            resolveRefreshFailure computes this message precisely so the
            staleness can be stated instead of the "updating" note simply
            vanishing. */}
        {refreshMessage && (
          <p className="drill-map-header__stale" role="status">
            <span>Showing cached drillholes — {refreshMessage}</span>
            <button type="button" onClick={reload}>Retry</button>
          </p>
        )}
      </header>

      <div className="drill-map-panel">
        <div
          ref={viewportRef}
          className={classNames(
            'map-viewport',
            drag.isDragging && 'is-dragging',
            isViewZoomed(view, MAP_SETTINGS) && 'is-zoomed',
          )}
          onPointerDown={drag.startDrag}
          onPointerMove={drag.moveDrag}
          onPointerUp={drag.stopDrag}
          onPointerCancel={drag.stopDrag}
          onDoubleClick={controls.zoomInAtPointer}
        >
          <MapCanvas
            style={buildCanvasTransformStyle({
              view,
              renderedMapSize,
              scaleVariable: SCALE_VARIABLE,
            })}
            onImageLoad={image.handleLoad}
            onImageError={image.handleError}
          >
            {!image.hasFailed && status === 'ready' && (
              <DrillholeMapFeatures
                drillholes={drillholes}
                deviationVisible={view.scale >= MAP_SETTINGS.deviationMinZoom}
                mapWidth={mapWidth}
                mapHeight={mapHeight}
              />
            )}
          </MapCanvas>

          {image.hasFailed && (
            <MapMissingNotice />
          )}

          {!image.hasFailed && (
            <MapStatusOverlay
              status={status}
              message={message}
              onRetry={reload}
            />
          )}

          <MapControls
            zoom={view.scale}
            onZoomIn={controls.zoomIn}
            onZoomOut={controls.zoomOut}
            onReset={controls.reset}
          />

          <div className="north-arrow" aria-label="North"><span>N</span><i /></div>
          <MapScaleBar mapWidth={mapWidth} zoom={view.scale} />
        </div>

        {MAP_SETTINGS.showLegends && <MapLegend />}
      </div>
    </section>
  );
}

export default DrillMap;
