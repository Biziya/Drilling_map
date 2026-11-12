import MapScreenshot from '../../components/MapScreenshot/MapScreenshot';
import HelpButton from '../../components/HelpDialog/HelpDialog';
import type { CaptureRect } from '../../components/MapScreenshot/MapScreenshot';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, SyntheticEvent } from 'react';
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
import BoxSelectOverlay from './Map/BoxSelectOverlay';
import SelectionTable from './Table/SelectionTable';
import MarkerTooltip from './Tooltips/MarkerTooltip';
import { MAP_CONFIG, MAP_ID, MAP_SETTINGS, baseMapLayout } from './config/technoMapConfig';
import type { BaseMapId } from './config/technoMapConfig';
import { HELP_SECTIONS } from './config/helpContent';
import { useBaseMap } from './hooks/useBaseMap';
import { useMapData } from './hooks/useMapData';
import { useMapFilters } from './hooks/useMapFilters';
import { useMapViewport } from './hooks/useMapViewport';
import { drillholeExtent, mapRatioToUtm } from './utils/coordinates';
import { exportMap } from './utils/exportMap';
import type { ExportFormat } from './utils/exportMap';
import { buildCanvasTransformStyle, isViewZoomed, measuredMapSize, toPixels } from './utils/geometry';
import { selectShownFeatures } from './utils/mapFilters';
import { buildMarkerFeatures, createHitIndex, findMarkerAt, findMarkersInRect, screenTransform } from './utils/markerLayer';
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

const NO_SELECTION: ReadonlySet<string> = new Set();

/** A copy of `keys` with `key` added, or removed when already there. */
function toggleKey(keys: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(keys);
  if (next.has(key)) next.delete(key); else next.add(key);

  return next;
}

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
  const { baseMap, setBaseMap } = useBaseMap();
  // The background's image and the UTM rectangle it covers: holes, cells,
  // grid, scale bar and measurement are all placed against these.
  const layout = baseMapLayout(baseMap);
  const { bounds } = layout;
  const { status, drillholes, cells, isFetching, failure, isDemo, refresh } = useMapData(bounds);
  const { filters, setFilter, setAll } = useMapFilters();
  /** Set when another image was chosen: the view is reset once it has loaded. */
  const resetOnLoadRef = useRef(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurement, setMeasurement] = useState<UtmCoordinates[]>([]);
  // Screenshot mode (the name predates area selection).
  const [isSelecting, setIsSelecting] = useState(false);
  // The rectangle select tool.
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // The hole under the pointer, and the one a click pinned open, by feature
  // key (the record ID), so a pin survives a data refresh.
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  // The multi-selection (Ctrl+click and the rectangle tool), by feature key,
  // in the order holes were added.
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(NO_SELECTION);

  // Every drillhole, whatever the filters, so Reset always frames the whole dataset.
  const fitBox = useMemo(() => drillholeExtent(drillholes), [drillholes]);
  // Worked out once per dataset; a filter change only re-filters, and a pan
  // or zoom only redraws.
  const features = useMemo(() => buildMarkerFeatures(drillholes, bounds), [drillholes, bounds]);
  const shown = useMemo(() => selectShownFeatures(features, filters), [features, filters]);
  const hitIndex = useMemo(() => createHitIndex(shown), [shown]);
  const shownByKey = useMemo(() => new Map(shown.map((feature) => [feature.key, feature])), [shown]);
  // Neither applies to a hole that is filtered out, or while measuring or area-selecting.
  const isPointerBusy = isSelecting || isMeasuring || isBoxSelecting;
  const hovered = (!isPointerBusy && hoveredKey && shownByKey.get(hoveredKey)) || null;
  const pinned = (!isPointerBusy && pinnedKey && shownByKey.get(pinnedKey)) || null;
  // The table lists every selected hole, whatever the layer filters; only
  // shown ones get a ring (none while measuring or taking a screenshot).
  const featuresByKey = useMemo(() => new Map(features.map((feature) => [feature.key, feature])), [features]);
  const selectedFeatures = useMemo(
    () => [...selectedKeys].flatMap((key) => featuresByKey.get(key) ?? []),
    [selectedKeys, featuresByKey],
  );
  // Rings are drawn on the marker canvas (thousands of DOM rings made every
  // pan frame slow); the canvas skips keys that are not shown.
  const ringKeys = isSelecting || isMeasuring ? NO_SELECTION : selectedKeys;

  const { viewportRef, view, renderedMapSize, mapOrigin, viewportSize, isDragging, viewportHandlers, image, controls } = useMapViewport({
    settings: MAP_SETTINGS,
    viewKey: MAP_ID,
    dragIgnoreSelector: OVERLAY_SELECTOR,
    overlaySelector: OVERLAY_SELECTOR,
    fitBox,
    // While measuring, a press on a marker is a press on the map: it places a
    // point where it lands and opens no tooltip.
    onMapClick: isMeasuring
      ? (ratio) => setMeasurement((points) => addMeasurementPoint(points, mapRatioToUtm(ratio, bounds)))
      : undefined,
    // A click pins the hole's popup (one at a time); a click on the pinned
    // hole, or on empty map, unpins it. Ctrl+click adds the hole to the
    // selection, or takes it out; Ctrl+click on empty map does nothing.
    onMapTap: (point, { additive }) => {
      if (isMeasuring || !transform) return;
      const key = findMarkerAt(hitIndex, point, transform)?.key ?? null;
      if (additive) {
        if (key) setSelectedKeys((current) => toggleKey(current, key));
        return;
      }
      setPinnedKey((current) => (key === current ? null : key));
    },
  });

  const mapWidth = toPixels(renderedMapSize.width);
  const mapHeight = toPixels(renderedMapSize.height);
  const mapSize = useMemo(() => measuredMapSize(renderedMapSize), [renderedMapSize]);
  const transform = useMemo(() => (mapSize ? screenTransform(view, mapOrigin, mapSize) : null), [view, mapOrigin, mapSize]);
  const viewportState = `${isDragging ? ' is-dragging' : ''}${isViewZoomed(view, MAP_SETTINGS.minZoom) ? ' is-zoomed' : ''}`
    + `${isMeasuring ? ' is-measuring' : ''}${hovered && !isMeasuring ? ' is-over-marker' : ''}${isBoxSelecting ? ' is-box-selecting' : ''}`;

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const overOverlay = event.target instanceof Element && event.target.closest(OVERLAY_SELECTOR);
    let hit: MarkerFeature | null = null;
    if (!isPointerBusy && event.buttons === 0 && !overOverlay && transform) {
      const rect = event.currentTarget.getBoundingClientRect();
      const point: Point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      hit = findMarkerAt(hitIndex, point, transform);
    }
    // A key, so the page re-renders only when the hole under the pointer changes.
    const key = hit?.key ?? null;
    setHoveredKey((current) => (current === key ? current : key));
  }, [hitIndex, isPointerBusy, transform]);

  const exitBoxSelect = useCallback(() => setIsBoxSelecting(false), []);
  const handleBoxSelect = useCallback((rect: CaptureRect) => {
    if (!transform) return;
    const inside = findMarkersInRect(shown, rect, transform);
    if (!inside.length) return;
    setSelectedKeys((current) => {
      const next = new Set(current);
      for (const feature of inside) next.add(feature.key);

      return next.size === current.size ? current : next;
    });
  }, [shown, transform]);
  const togglePinned = useCallback((key: string) => setPinnedKey((current) => (current === key ? null : key)), []);
  const removeSelected = useCallback((key: string) => setSelectedKeys((current) => toggleKey(current, key)), []);
  const clearSelection = useCallback(() => setSelectedKeys(NO_SELECTION), []);

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    image.onLoad(event);
    if (!resetOnLoadRef.current) return;
    resetOnLoadRef.current = false;
    controls.reset();
  };

  // Another image covers another rectangle at another size, so the old view
  // and measurement no longer fit it. Geological and White Grid share one
  // layout, so switching between them keeps both. The selection is by hole,
  // so it survives the switch.
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

  // The popup shows the hovered hole, else the pinned one.
  const tooltipFeature = hovered ?? pinned;

  const handleExport = async (format: ExportFormat, capture: CaptureRect) => {
    // An export without its base map would misrepresent the map, so none is made.
    if (!mapSize || image.hasFailed) {
      showToast('error', 'Map export failed: the base map is not loaded.');
      return;
    }

    setIsExporting(true);
    try {
      await exportMap(format, {
        capture,
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
          <BaseMapSwitcher value={baseMap} onChange={handleBaseMapChange} />
          <strong>{drillholes.length} drillholes</strong>
          <HelpButton title={MAP_CONFIG.title} sections={HELP_SECTIONS} />
        </div>
      </header>

      <div className={`map-panel${selectedFeatures.length > 0 ? ' has-selection' : ''}`}>
        <div
          ref={viewportRef}
          className={`map-viewport${viewportState}${isSelecting ? ' is-selecting' : ''}`}
          {...viewportHandlers}
          onPointerMove={(event) => {
            viewportHandlers.onPointerMove(event);
            handlePointerMove(event);
          }}
          onPointerLeave={() => setHoveredKey(null)}
        >
          {/* Only the background changes with the base map; the view and every feature stay put. */}
          {layout.src === null && !image.hasFailed && (
            <CoordinateGrid viewport={viewportSize} view={view} mapOrigin={mapOrigin} mapSize={mapSize} bounds={bounds} />
          )}
          <MapCanvas
            style={buildCanvasTransformStyle(view, renderedMapSize)}
            onImageLoad={handleImageLoad}
            onImageError={image.onError}
            src={layout.imageSrc}
            showImage={layout.src !== null}
          >
            {!image.hasFailed && filters['technological-cells'] && (
              <TechnoCells cells={cells} mapWidth={mapWidth} mapHeight={mapHeight} bounds={bounds} />
            )}
          </MapCanvas>

          {!image.hasFailed && (
            <DrillholeLayer
              features={shown}
              transform={transform}
              viewport={viewportSize}
              deviationVisible={filters['deviation-line'] && view.scale >= MAP_SETTINGS.deviationMinZoom}
              selected={ringKeys}
            />
          )}
          {/* Rings: green on the pinned marker, blue on a different hovered one (selected rings are on the canvas). */}
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

          <MeasurementOverlay points={measurement} view={view} mapOrigin={mapOrigin} mapSize={mapSize} bounds={bounds} />
          <MapStatus status={status} imageFailed={image.hasFailed} failure={failure} src={layout.imageSrc} />
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
              setIsBoxSelecting(false);
            }}
            isBoxSelecting={isBoxSelecting}
            onToggleBoxSelect={() => {
              setIsBoxSelecting((current) => !current);
              setIsMeasuring(false);
              setMeasurement([]);
              setPinnedKey(null);
            }}
            isSelecting={isSelecting}
            onToggleScreenshot={() => {
              setIsSelecting((current) => !current);
              setIsMeasuring(false);
              setIsBoxSelecting(false);
            }}
            isExporting={isExporting}
          />
          {isBoxSelecting && !isSelecting && <BoxSelectOverlay onSelect={handleBoxSelect} onExit={exitBoxSelect} />}
          {isSelecting && <MapScreenshot viewportRef={viewportRef}
            onCancel={() => setIsSelecting(false)}
            onCapture={(rect, format) => { setIsSelecting(false); void handleExport(format, rect); }} />}
          <MapScaleBar mapWidth={mapWidth} zoom={view.scale} bounds={bounds} />
        </div>
        {selectedFeatures.length > 0 && (
          <SelectionTable
            features={selectedFeatures}
            pinnedKey={pinnedKey}
            onRowClick={togglePinned}
            onRemove={removeSelected}
            onClear={clearSelection}
          />
        )}
      </div>
    </section>
  );
}

export default TechnoMap;
