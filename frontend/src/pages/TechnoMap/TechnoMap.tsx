import { useCallback, useMemo, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import BaseMapSwitcher from './Controls/BaseMapSwitcher';
import LayerPanel from './Controls/LayerPanel';
import MapControls from './Controls/MapControls';
import RefreshButton from './Controls/RefreshButton';
import MapLegend from './Legends/MapLegend';
import CoordinateGrid from './Map/CoordinateGrid';
import DrillholeLayer from './Map/DrillholeLayer';
import MapCanvas from './Map/MapCanvas';
import MapScaleBar from './Map/MapScaleBar';
import MapStatus from './Map/MapStatus';
import MeasurementOverlay from './Map/MeasurementOverlay';
import TechnoCells from './Map/TechnoCells';
import MarkerHighlight from './Map/MarkerHighlight';
import MarkerTooltip from './Tooltips/MarkerTooltip';
import { MAP_CONFIG, MAP_ID, MAP_SETTINGS } from './config/technoMapConfig';
import { useBaseMap } from './hooks/useBaseMap';
import { useMapData } from './hooks/useMapData';
import { useMapFilters } from './hooks/useMapFilters';
import { useMapViewport } from './hooks/useMapViewport';
import { drillholeExtent, mapRatioToUtm } from './utils/coordinates';
import { exportMap } from './utils/exportMap';
import type { ExportFormat } from './utils/exportMap';
import { buildCanvasTransformStyle, isViewZoomed, measuredMapSize, toPixels } from './utils/geometry';
import { selectShownFeatures } from './utils/mapFilters';
import { buildMarkerFeatures, createHitIndex, findMarkerAt, screenTransform } from './utils/markerLayer';
import type { MarkerFeature } from './utils/markerLayer';
import { addMeasurementPoint } from './utils/measurement';
import { showToast } from '../../components/Toast/toastStore';
import type { Point, StyleWithCssVariables, UtmCoordinates } from '../../types/map';
import './TechnoMap.css';

/**
 * Floating panels that keep presses, the wheel and double-click for themselves;
 * a pinned tooltip among them, so its fields scroll instead of the map zooming.
 */
const OVERLAY_SELECTOR = '.map-toolbar, .map-layers, .map-legend, .marker-tooltip.is-pinned';

/** Feature colours from technoMap.yaml, for the stylesheet. */
const PAGE_STYLE: StyleWithCssVariables = {
  '--deviation-color': MAP_CONFIG.deviationLine.color,
  '--measure-color': MAP_CONFIG.measurement.color,
  '--hover-color': MAP_CONFIG.interaction.hoverColor,
  '--pinned-color': MAP_CONFIG.interaction.pinnedColor,
  '--cell-stroke': MAP_CONFIG.technologicalCells.stroke,
  '--cell-fill': MAP_CONFIG.technologicalCells.fill,
};

/** Techno Map: the demo dataset or /api/techno-map, with layer filters, measurement and export. */
function TechnoMap() {
  const { status, drillholes, cells, isFetching, failure, isDemo, refresh } = useMapData();
  const { filters, setFilter, setAll } = useMapFilters();
  const { baseMap, setBaseMap } = useBaseMap();
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurement, setMeasurement] = useState<UtmCoordinates[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  // The hole under the pointer, and the one a click pinned open, by feature
  // key (the record ID), so a pin survives a data refresh.
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);

  // Every drillhole, whatever the filters, so Reset always frames the whole dataset.
  const fitBox = useMemo(() => drillholeExtent(drillholes), [drillholes]);
  // Worked out once per dataset; a filter change only re-filters, and a pan
  // or zoom only redraws.
  const features = useMemo(() => buildMarkerFeatures(drillholes), [drillholes]);
  const shown = useMemo(() => selectShownFeatures(features, filters), [features, filters]);
  const hitIndex = useMemo(() => createHitIndex(shown), [shown]);
  const shownByKey = useMemo(() => new Map(shown.map((feature) => [feature.key, feature])), [shown]);
  // Neither applies to a hole that is filtered out, or while measuring.
  const hovered = (!isMeasuring && hoveredKey && shownByKey.get(hoveredKey)) || null;
  const pinned = (!isMeasuring && pinnedKey && shownByKey.get(pinnedKey)) || null;

  const { viewportRef, view, renderedMapSize, mapOrigin, viewportSize, isDragging, viewportHandlers, image, controls } = useMapViewport({
    settings: MAP_SETTINGS,
    viewKey: MAP_ID,
    dragIgnoreSelector: OVERLAY_SELECTOR,
    overlaySelector: OVERLAY_SELECTOR,
    fitBox,
    // While measuring, a press on a marker is a press on the map: it places a
    // point where it lands and opens no tooltip.
    onMapClick: isMeasuring
      ? (ratio) => setMeasurement((points) => addMeasurementPoint(points, mapRatioToUtm(ratio)))
      : undefined,
    // A click pins the hole's popup (one at a time); a click on the pinned
    // hole, or on empty map, unpins it.
    onMapTap: (point) => {
      if (isMeasuring || !transform) return;
      const key = findMarkerAt(hitIndex, point, transform)?.key ?? null;
      setPinnedKey((current) => (key === current ? null : key));
    },
  });

  const mapWidth = toPixels(renderedMapSize.width);
  const mapHeight = toPixels(renderedMapSize.height);
  const mapSize = useMemo(() => measuredMapSize(renderedMapSize), [renderedMapSize]);
  const transform = useMemo(() => (mapSize ? screenTransform(view, mapOrigin, mapSize) : null), [view, mapOrigin, mapSize]);
  const viewportState = `${isDragging ? ' is-dragging' : ''}${isViewZoomed(view, MAP_SETTINGS.minZoom) ? ' is-zoomed' : ''}`
    + `${isMeasuring ? ' is-measuring' : ''}${hovered && !isMeasuring ? ' is-over-marker' : ''}`;

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const overOverlay = event.target instanceof Element && event.target.closest(OVERLAY_SELECTOR);
    let hit: MarkerFeature | null = null;
    if (!isMeasuring && event.buttons === 0 && !overOverlay && transform) {
      const rect = event.currentTarget.getBoundingClientRect();
      const point: Point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      hit = findMarkerAt(hitIndex, point, transform);
    }
    // A key, so the page re-renders only when the hole under the pointer changes.
    const key = hit?.key ?? null;
    setHoveredKey((current) => (current === key ? current : key));
  }, [hitIndex, isMeasuring, transform]);

  // The popup shows the hovered hole, else the pinned one.
  const tooltipFeature = hovered ?? pinned;

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
        baseMap,
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
          <BaseMapSwitcher value={baseMap} onChange={setBaseMap} />
          <strong>{drillholes.length} drillholes</strong>
        </div>
      </header>

      <div className="map-panel">
        <div
          ref={viewportRef}
          className={`map-viewport${viewportState}`}
          {...viewportHandlers}
          onPointerMove={(event) => {
            viewportHandlers.onPointerMove(event);
            handlePointerMove(event);
          }}
          onPointerLeave={() => setHoveredKey(null)}
        >
          {/* Only the background changes with the base map; the view and every feature stay put. */}
          {baseMap === 'white-grid' && !image.hasFailed && (
            <CoordinateGrid viewport={viewportSize} view={view} mapOrigin={mapOrigin} mapSize={mapSize} />
          )}
          <MapCanvas
            style={buildCanvasTransformStyle(view, renderedMapSize)}
            onImageLoad={image.onLoad}
            onImageError={image.onError}
            showImage={baseMap === 'geological'}
          >
            {!image.hasFailed && filters['technological-cells'] && (
              <TechnoCells cells={cells} mapWidth={mapWidth} mapHeight={mapHeight} />
            )}
          </MapCanvas>

          {!image.hasFailed && (
            <DrillholeLayer
              features={shown}
              transform={transform}
              viewport={viewportSize}
              deviationVisible={filters['deviation-line'] && view.scale >= MAP_SETTINGS.deviationMinZoom}
            />
          )}
          {/* Rings: green on the pinned marker, blue on a different hovered one. */}
          {pinned && transform && <MarkerHighlight feature={pinned} transform={transform} state="pinned" />}
          {hovered && hovered !== pinned && transform && <MarkerHighlight feature={hovered} transform={transform} state="hovered" />}
          {tooltipFeature && transform && !isDragging && (
            <MarkerTooltip
              feature={tooltipFeature}
              transform={transform}
              viewport={viewportSize}
              isPinned={tooltipFeature === pinned && tooltipFeature !== hovered}
            />
          )}

          <MeasurementOverlay points={measurement} view={view} mapOrigin={mapOrigin} mapSize={mapSize} />
          <MapStatus status={status} imageFailed={image.hasFailed} failure={failure} />
          {MAP_CONFIG.showLegends && <MapLegend filters={filters} />}
          <LayerPanel filters={filters} onChange={setFilter} onSetAll={setAll} />
          <MapControls
            zoom={view.scale}
            onZoomIn={controls.zoomIn}
            onZoomOut={controls.zoomOut}
            onReset={controls.reset}
            isMeasuring={isMeasuring}
            onToggleMeasure={() => {
              setIsMeasuring((current) => !current);
              setMeasurement([]);
              setPinnedKey(null);
            }}
            isExporting={isExporting}
            onExport={(format) => void handleExport(format)}
          />
          <MapScaleBar mapWidth={mapWidth} zoom={view.scale} />
        </div>
      </div>
    </section>
  );
}

export default TechnoMap;
