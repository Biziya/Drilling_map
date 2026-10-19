import TechnoMapFeatures from './TechnoMapFeatures';
import TechnoMapControls from './TechnoMapControls';
import TechnoMapLegend from './TechnoMapLegend';
import TechnoMapScaleBar from './TechnoMapScaleBar';
import MapCanvas from './MapCanvas';
import MapMissingNotice from './MapMissingNotice';
import MapStatusOverlay from './MapStatusOverlay';
import { classNames } from './classNames';
import { buildCanvasTransformStyle, toPixels } from './mapGeometry';
import { isViewZoomed } from './zoomMath';
import { useMapData } from './useMapData';
import { useMapViewport } from './useMapViewport';
import { fetchTechnoMap } from '../../services/api/mapData';
import { DATASET_IDS } from '../../services/cache/drillholeCache';
import { TECHNO_MAP_SETTINGS } from './technoMapConfig';
import { convertUtmToTechnoMapPosition } from './technoMapCoordinates';
import type { CssVariableName, MapId, MapTransform } from '../../types/map';
import './TechnoMap.css';

const INITIAL_VIEW: Readonly<MapTransform> = Object.freeze<MapTransform>({
  scale: TECHNO_MAP_SETTINGS.minZoom,
  translateX: 0,
  translateY: 0,
});

const DRAG_IGNORE_SELECTOR = '.techno-drillhole-marker, .techno-map-controls';

/** Custom property the stylesheet reads to keep marker size constant. */
const SCALE_VARIABLE: CssVariableName = '--techno-inverse-map-scale';

// Keyed separately from the Exploration Map so the two views never overwrite
// each other.
const VIEW_STATE_KEY: MapId = 'techno-map';

function TechnoMap() {
  const { viewportRef, view, renderedMapSize, image, controls, drag } = useMapViewport({
    settings: TECHNO_MAP_SETTINGS,
    initialView: INITIAL_VIEW,
    dragIgnoreSelector: DRAG_IGNORE_SELECTOR,
    viewStateKey: VIEW_STATE_KEY,
  });

  const {
    status, drillholes, message, isRefreshing, refreshMessage, reload,
  } = useMapData({
    fetchRecords: fetchTechnoMap,
    project: convertUtmToTechnoMapPosition,
    cacheKey: DATASET_IDS.technoMap,
  });

  const mapWidth = toPixels(renderedMapSize.width);
  const mapHeight = toPixels(renderedMapSize.height);

  return (
    <section className="techno-map-page">
      <header className="techno-map-header">
        <h1>Techno Map</h1>
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
          <p className="techno-map-header__stale" role="status">
            <span>Showing cached drillholes — {refreshMessage}</span>
            <button type="button" onClick={reload}>Retry</button>
          </p>
        )}
      </header>

      <div className="techno-map-panel">
        <div
          ref={viewportRef}
          className={classNames(
            'techno-map-viewport',
            drag.isDragging && 'is-dragging',
            isViewZoomed(view, TECHNO_MAP_SETTINGS) && 'is-zoomed',
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
              <TechnoMapFeatures
                drillholes={drillholes}
                deviationVisible={view.scale >= TECHNO_MAP_SETTINGS.deviationMinZoom}
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

          <TechnoMapControls
            zoom={view.scale}
            onZoomIn={controls.zoomIn}
            onZoomOut={controls.zoomOut}
            onReset={controls.reset}
          />

          <div className="techno-north-arrow" aria-label="North"><span>N</span><i /></div>
          <TechnoMapScaleBar mapWidth={mapWidth} zoom={view.scale} />
        </div>

        {TECHNO_MAP_SETTINGS.showLegends && <TechnoMapLegend />}
      </div>
    </section>
  );
}

export default TechnoMap;
