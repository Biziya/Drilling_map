import MapScreenshot from '../../components/MapScreenshot/MapScreenshot';
import HelpButton from '../../components/HelpDialog/HelpDialog';
import BoxSelectOverlay from '../../components/BoxSelect/BoxSelectOverlay';
import { DrillholeFields, MapTooltip } from '../../components/MapTooltip/MapTooltip';
import SelectionTable from '../../components/SelectionTable/SelectionTable';
import SiteFeatureOverlay from '../../components/SiteFeatureOverlay/SiteFeatureOverlay';
import { SITE_ICON_CLASS, siteOutlinesVisible } from '../../components/SiteFeatureOverlay/siteFeatureLayout';
import { useSiteFeatures } from '../../services/siteFeatures/useSiteFeatures';
import type { CaptureRect } from '../../components/MapScreenshot/MapScreenshot';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import BaseMapSwitcher from './Controls/BaseMapSwitcher';
import LayerPanel from './Controls/LayerPanel';
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
import { useMapFilters } from './hooks/useMapFilters';
import { projectRecords, useMapData } from './hooks/useMapData';
import { useMapViewport } from './hooks/useMapViewport';
import { mapRatioToUtm, utmToMapRatio } from './utils/coordinates';
import { EXPLORATION_FIELDS, TABLE_COLUMNS_STORAGE_KEY, TABLE_EXPORT_PREFIX } from './utils/explorationFields';
import { buildFeatures, featureScreenPoint, featuresInRect, markerHalfSize, shownFeatures } from './utils/features';
import { exportMap } from './utils/exportMap';
import type { ExportFormat } from './utils/exportMap';
import { buildCanvasTransformStyle, isViewZoomed, mapRatioToViewport, measuredMapSize, toPixels } from './utils/geometry';
import { addMeasurementPoint } from './utils/measurement';
import { showToast } from '../../components/Toast/toastStore';
import { readDrillholeText } from '../../utils/drillholeFields';
import type { StyleWithCssVariables, UtmCoordinates } from '../../types/map';
import './DrillMap.css';

/**
 * Floating panels that keep presses, the wheel and double-click for
 * themselves; a pinned tooltip among them, so its fields scroll instead of the
 * map zooming.
 */
const OVERLAY_SELECTOR = '.map-toolbar, .map-layers, .map-legend, .marker-tooltip.is-pinned';
/** Drags starting on these pan nothing: they are clicks on a marker or a control. */
const DRAG_IGNORE_SELECTOR = `.drillhole-marker, .${SITE_ICON_CLASS}, ${OVERLAY_SELECTOR}`;

const NO_SELECTION: ReadonlySet<string> = new Set();

/** A copy of `keys` with `key` added, or removed when already there. */
function toggleKey(keys: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(keys);
  if (next.has(key)) next.delete(key); else next.add(key);

  return next;
}

const PAGE_STYLE: StyleWithCssVariables = { '--measure-color': MAP_CONFIG.measurement.color };

/** Exploration Map: SEDIMENT/DEVELOP holes from /api/exploration-map. */
function DrillMap() {
  const { status, records, isFetching, failure, refresh } = useMapData();
  const { baseMap, setBaseMap } = useBaseMap();
  const layout = baseMapLayout(baseMap);
  const { bounds } = layout;
  const drillholes = useMemo(() => projectRecords(records, bounds), [records, bounds]);
  const { filters, setFilter, setAll } = useMapFilters();
  /** Set when another image was chosen: the view is reset once it has loaded. */
  const resetOnLoadRef = useRef(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measurement, setMeasurement] = useState<UtmCoordinates[]>([]);
  // Screenshot mode.
  const [isSelecting, setIsSelecting] = useState(false);
  // The rectangle select tool.
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // The hole under the pointer, the one a click pinned open, and the
  // multi-selection (area select and Ctrl+click), by feature key.
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(NO_SELECTION);
  // Site features (pilot factory, mud pit, …) and the one whose popup is open.
  const siteFeatures = useSiteFeatures();
  const [pinnedSiteId, setPinnedSiteId] = useState<string | null>(null);

  const features = useMemo(() => buildFeatures(drillholes, bounds), [drillholes, bounds]);
  const shown = useMemo(() => shownFeatures(features, filters), [features, filters]);
  const shownByKey = useMemo(() => new Map(shown.map((feature) => [feature.key, feature])), [shown]);
  const featuresByKey = useMemo(() => new Map(features.map((feature) => [feature.key, feature])), [features]);
  // The table lists every selected hole, whatever the layer filters.
  const selectedFeatures = useMemo(() => [...selectedKeys].flatMap((key) => featuresByKey.get(key) ?? []), [selectedKeys, featuresByKey]);
  // No tooltip or rings while measuring, area-selecting or taking a screenshot.
  const isPointerBusy = isSelecting || isMeasuring || isBoxSelecting;
  const hovered = (!isPointerBusy && hoveredKey && shownByKey.get(hoveredKey)) || null;
  const pinned = (!isPointerBusy && pinnedKey && shownByKey.get(pinnedKey)) || null;

  const { viewportRef, view, renderedMapSize, mapOrigin, viewportSize, maxZoom, isDragging, viewportHandlers, image, controls } = useMapViewport({
    settings: MAP_SETTINGS,
    viewKey: MAP_ID,
    bounds,
    // While measuring, a press on a marker is a press on the map: measurement
    // wins over the marker (which also stops catching the pointer, see CSS).
    dragIgnoreSelector: isMeasuring ? OVERLAY_SELECTOR : DRAG_IGNORE_SELECTOR,
    overlaySelector: OVERLAY_SELECTOR,
    onMapClick: isMeasuring
      ? (ratio) => setMeasurement((points) => addMeasurementPoint(points, mapRatioToUtm(ratio, bounds)))
      : undefined,
    // A click on empty map unpins the tooltip.
    onBackgroundTap: () => {
      setPinnedKey(null);
      setPinnedSiteId(null);
    },
  });

  const mapWidth = toPixels(renderedMapSize.width);
  const mapSize = useMemo(() => measuredMapSize(renderedMapSize), [renderedMapSize]);
  const viewportState = `${isDragging ? ' is-dragging' : ''}${isViewZoomed(view, MAP_SETTINGS.minZoom) ? ' is-zoomed' : ''}`
    + `${isMeasuring ? ' is-measuring' : ''}${isBoxSelecting ? ' is-box-selecting' : ''}`;

  // Esc unpins the tooltip.
  useEffect(() => {
    if (!pinnedKey && !pinnedSiteId) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPinnedKey(null);
      setPinnedSiteId(null);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pinnedKey, pinnedSiteId]);

  // One popup at a time: a site popup closes the hole's, and the other way round.
  const toggleSite = useCallback((id: string) => {
    setPinnedKey(null);
    setPinnedSiteId((current) => (current === id ? null : id));
  }, []);
  const siteToViewport = useCallback(
    (point: UtmCoordinates) => (mapSize ? mapRatioToViewport(utmToMapRatio(point, bounds), view, mapOrigin, mapSize) : { x: -9999, y: -9999 }),
    [bounds, view, mapOrigin, mapSize],
  );

  const handleHover = useCallback((key: string | null) => setHoveredKey((current) => (current === key ? current : key)), []);
  // A click pins the hole's tooltip (one at a time), a second click unpins it;
  // Ctrl+click adds the hole to the selection, or takes it out.
  const handleActivate = useCallback((key: string, additive: boolean) => {
    if (additive) {
      setSelectedKeys((current) => toggleKey(current, key));
    } else {
      setPinnedSiteId(null);
      setPinnedKey((current) => (current === key ? null : key));
    }
  }, []);

  const exitBoxSelect = useCallback(() => setIsBoxSelecting(false), []);
  const handleBoxSelect = useCallback((rect: CaptureRect) => {
    if (!mapSize) return;
    const inside = featuresInRect(shown, rect, view, mapOrigin, mapSize);
    if (!inside.length) return;
    setSelectedKeys((current) => {
      const next = new Set(current);
      for (const feature of inside) next.add(feature.key);

      return next.size === current.size ? current : next;
    });
  }, [shown, view, mapOrigin, mapSize]);
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

  // The tooltip shows the hovered hole, else the pinned one.
  const tooltipFeature = hovered ?? pinned;
  const tooltipHoleId = tooltipFeature ? readDrillholeText(tooltipFeature.drillhole, 'holeId') ?? 'unidentified hole' : '';

  return (
    <section className="drill-map-page" style={PAGE_STYLE}>
      <header className="map-header">
        <h1>{MAP_CONFIG.title}</h1>
        <div className="mb-[3px] flex shrink-0 items-center gap-2">
          <RefreshButton isRefreshing={isFetching} onRefresh={refresh} />
          <BaseMapSwitcher value={baseMap} onChange={handleBaseMapChange} />
          {/* Unique holes (duplicates merged): the same set the selection table draws from. */}
          <strong>{featuresByKey.size} drillholes</strong>
          <HelpButton title={MAP_CONFIG.title} sections={HELP_SECTIONS} />
        </div>
      </header>

      <div className={`map-panel${selectedFeatures.length > 0 ? ' has-selection' : ''}`}>
        <div
          ref={viewportRef}
          className={`map-viewport${viewportState}${isSelecting ? ' is-selecting' : ''}`}
          {...viewportHandlers}
          onPointerLeave={() => setHoveredKey(null)}
        >
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
                features={shown}
                deviationVisible={filters['deviation-line'] && view.scale >= MAP_SETTINGS.deviationMinZoom}
                mapWidth={mapWidth}
                mapHeight={toPixels(renderedMapSize.height)}
                selectedKeys={isSelecting || isMeasuring ? NO_SELECTION : selectedKeys}
                pinnedKey={pinned?.key ?? null}
                onHover={handleHover}
                onActivate={handleActivate}
              />
            )}
          </MapCanvas>

          {tooltipFeature && mapSize && !isDragging && (
            <MapTooltip
              at={featureScreenPoint(tooltipFeature, view, mapOrigin, mapSize)}
              markerHalf={markerHalfSize(tooltipFeature.kind)}
              viewport={viewportSize}
              isPinned={tooltipFeature === pinned && tooltipFeature !== hovered}
              className={`drillhole-marker--${tooltipFeature.kind}`}
              label={`${MAP_CONFIG.markerLabels[tooltipFeature.kind]} ${tooltipHoleId}`}
              holeId={tooltipHoleId}
            >
              <DrillholeFields title={tooltipHoleId} fields={EXPLORATION_FIELDS} drillhole={tooltipFeature.drillhole} />
            </MapTooltip>
          )}

          <MeasurementOverlay points={measurement} view={view} mapOrigin={mapOrigin} mapSize={mapSize} bounds={bounds} />
          {filters['site-features'] && mapSize && !image.hasFailed && (
            <SiteFeatureOverlay
              features={siteFeatures}
              toViewport={siteToViewport}
              showOutlines={siteOutlinesVisible(bounds, mapWidth, view.scale, MAP_CONFIG.siteFeatures.outlineMaxMetersPer100Px)}
              pinnedId={pinnedSiteId}
              onToggle={toggleSite}
              viewport={viewportSize}
              isInteractive={!isPointerBusy}
              hidePopup={isDragging}
            />
          )}
          <MapStatus status={status} imageFailed={image.hasFailed} src={layout.imageSrc} failure={failure} />
          {/* The legend card top-left, the Layers panel top-right, as on the Techno Map. */}
          {MAP_CONFIG.showLegends && <MapLegend filters={filters} />}
          <div className="map-side">
            <LayerPanel filters={filters} onChange={setFilter} onSetAll={setAll} />
          </div>
          <MapControls
            zoom={view.scale}
            maxZoom={maxZoom}
            onZoomIn={controls.zoomIn}
            onZoomOut={controls.zoomOut}
            onReset={controls.reset}
            isMeasuring={isMeasuring}
            onToggleMeasure={() => {
              setIsMeasuring((current) => !current);
              setMeasurement([]);
              setPinnedKey(null);
              setPinnedSiteId(null);
              setIsBoxSelecting(false);
            }}
            isBoxSelecting={isBoxSelecting}
            onToggleBoxSelect={() => {
              setIsBoxSelecting((current) => !current);
              setIsMeasuring(false);
              setMeasurement([]);
              setPinnedKey(null);
              setPinnedSiteId(null);
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
            items={selectedFeatures}
            columns={EXPLORATION_FIELDS}
            storageKey={TABLE_COLUMNS_STORAGE_KEY}
            exportPrefix={TABLE_EXPORT_PREFIX}
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

export default DrillMap;
