import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useMapViewport as useDrillViewport } from '../../src/pages/DrillMap/hooks/useMapViewport';
import { useMapViewport as useTechnoViewport } from '../../src/pages/TechnoMap/hooks/useMapViewport';
import { MAP_SETTINGS as drillSettings } from '../../src/pages/DrillMap/config/drillMapConfig';
import { MAP_SETTINGS as technoSettings } from '../../src/pages/TechnoMap/config/technoMapConfig';
import { clearAllMapViews, writeMapView } from '../../src/state/mapViewStore';
import { viewportToMapRatio } from '../../src/pages/DrillMap/utils/geometry';
import { SCALE_BAR_TARGET_PX, maxZoomForScaleBar, stepZoomDelta } from '../../src/utils/mapWheel';
import { computeScaleBar } from '../../src/pages/TechnoMap/utils/scaleBar';

// Exercise the native wheel listener and React frame batching, rather than
// only testing the pure wheel/geometry helpers. One frame is advanced explicitly
// so a rapid burst cannot hide stale-state updates or queued acceleration.
let frames;
beforeEach(() => {
  clearAllMapViews();
  localStorage.clear();
  frames = new Map();
  let frameId = 0;
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 20, top: 30, width: 1000, height: 700, right: 1020, bottom: 730,
  });
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => frames.delete(id));
});

afterEach(() => {
  cleanup();
  clearAllMapViews();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function flushFrame() {
  act(() => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback(0));
  });
}

// A 1000 px wide map spanning 10 km: the scale bar reads 5 m at
// (100 px / 5 m) * 10 000 m / 1000 px = 200x.
const BOUNDS = { minX: 0, maxX: 10000, minY: 0, maxY: 7000 };
const LIMIT = 200;

describe.each([
  ['DrillMap', useDrillViewport, drillSettings, 'exploration-map'],
  ['TechnoMap', useTechnoViewport, technoSettings, 'techno-map'],
])('%s native wheel zoom', (_page, useViewport, settings, viewKey) => {
  const wheelFactor = 1 + settings.wheelZoomStep;
  const buttonFactor = 1 + settings.zoomStep;

  function mount(scale, options = settings, bounds = BOUNDS) {
    writeMapView(viewKey, { scale, translateX: -100, translateY: -50 });
    let latest;
    function Viewport({ mapBounds }) {
      const viewport = useViewport({ settings: options, viewKey, bounds: mapBounds, dragIgnoreSelector: '.map-toolbar', overlaySelector: '.map-toolbar' });
      latest = viewport;
      return <div ref={viewport.viewportRef} {...viewport.viewportHandlers} data-testid="viewport">
        <img alt="Test map" onLoad={viewport.image.onLoad} />
        <button className="map-toolbar" type="button">Overlay control</button>
      </div>;
    }
    const result = render(<Viewport mapBounds={bounds} />);
    const image = result.getByAltText('Test map');
    Object.defineProperties(image, { naturalWidth: { value: 1000 }, naturalHeight: { value: 700 } });
    fireEvent.load(image);
    flushFrame();
    const element = result.getByTestId('viewport');
    const wheel = (deltaY, deltaMode = 0, target = element) => fireEvent.wheel(target, { deltaY, deltaMode, clientX: 420, clientY: 330 });
    return {
      ...result,
      element,
      wheel,
      setBounds: (next) => result.rerender(<Viewport mapBounds={next} />),
      getView: () => latest.view,
      maxZoom: () => latest.maxZoom,
      controls: () => latest.controls,
    };
  }

  it.each([1, 5, 10, 90, 170])('multiplies the zoom by the same factor per notch at scale %s, anchored to the cursor', scale => {
    const map = mount(scale);
    const initial = map.getView();
    const anchor = { x: 400, y: 300 };
    const ratio = view => viewportToMapRatio(anchor, view, { x: 0, y: 0 }, { width: 1000, height: 700 });
    const before = ratio(initial);
    map.wheel(-100);
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(Math.min(LIMIT, scale * wheelFactor), 10);
    expect(ratio(map.getView()).x).toBeCloseTo(before.x, 12);
    expect(ratio(map.getView()).y).toBeCloseTo(before.y, 12);
    if (scale * wheelFactor > LIMIT) return;
    map.wheel(100);
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(scale, 10);
    expect(ratio(map.getView()).x).toBeCloseTo(before.x, 12);
    expect(ratio(map.getView()).y).toBeCloseTo(before.y, 12);
  });

  it.each([5, 90])('normalizes fractional touchpad and line input at scale %s', scale => {
    const map = mount(scale);
    map.wheel(-2);
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(scale * wheelFactor ** 0.02, 10);
    let previous = map.getView().scale;
    map.wheel(2);
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(previous / wheelFactor ** 0.02, 10);
    previous = map.getView().scale;
    map.wheel(-3, 1);
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(previous * wheelFactor, 10);
    previous = map.getView().scale;
    map.wheel(1, 2);
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(previous / wheelFactor, 10);
  });

  it.each([1, 20])('uses the live scale during rapid bursts with no delayed zoom from scale %s', scale => {
    const map = mount(scale);
    let expected = scale;
    for (let i = 0; i < 6; i++) {
      expected = Math.min(LIMIT, expected * wheelFactor);
      map.wheel(-100);
    }
    expect(frames.size).toBe(1);
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(expected, 8);
    expect(frames.size).toBe(0);
    // Reversing immediately uses the new scale; it adds no animation tail.
    for (let i = 0; i < 6; i++) {
      expected = Math.max(settings.minZoom, expected / wheelFactor);
      map.wheel(100);
    }
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(expected, 8);
    const settled = map.getView();
    flushFrame();
    expect(map.getView()).toBe(settled);
  });

  it('stops zooming in where the scale bar reads the configured metres, and reverses immediately', () => {
    const map = mount(LIMIT / 1.1);
    expect(map.maxZoom()).toBeCloseTo(LIMIT, 10);
    map.wheel(-100);
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(LIMIT, 10);
    expect(computeScaleBar({ mapWidth: 1000, zoom: map.getView().scale, bounds: BOUNDS }).label).toBe(`${settings.minScaleBarMeters} m`);
    map.wheel(-10000);
    expect(frames.size).toBe(0);
    map.controls().zoomIn();
    expect(frames.size).toBe(0);
    map.wheel(100);
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(LIMIT / wheelFactor, 10);
  });

  it('clamps at the minimum and reverses immediately', () => {
    const map = mount(settings.minZoom * 1.1);
    map.wheel(100);
    flushFrame();
    expect(map.getView().scale).toBe(settings.minZoom);
    map.wheel(10000);
    expect(frames.size).toBe(0);
    map.wheel(-100);
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(settings.minZoom * wheelFactor, 12);
  });

  it('pulls a view deeper than the limit back to it, on load and when the base map changes', () => {
    const map = mount(500);
    expect(map.getView().scale).toBeCloseTo(LIMIT, 10);
    // Half the metres on the same width: the limit halves too.
    map.setBounds({ ...BOUNDS, maxX: 5000 });
    flushFrame();
    expect(map.maxZoom()).toBeCloseTo(LIMIT / 2, 10);
    expect(map.getView().scale).toBeCloseTo(LIMIT / 2, 10);
  });

  it('does not duplicate listeners across renders and cleans up listeners and pending frames', () => {
    const map = mount(2);
    let expected = 2;
    for (let i = 1; i <= 5; i++) {
      expected = Math.min(LIMIT, expected * wheelFactor);
      map.wheel(-100);
      flushFrame();
      expect(map.getView().scale).toBeCloseTo(expected, 10);
    }
    const previous = map.getView();
    map.wheel(-100, 0, map.getByRole('button', { name: 'Overlay control' }));
    expect(frames.size).toBe(0);
    expect(map.getView()).toBe(previous);
    map.wheel(-100);
    expect(frames.size).toBe(1);
    map.unmount();
    expect(frames.size).toBe(0);
    map.wheel(-100);
    expect(frames.size).toBe(0);
  });

  it('zooms the toolbar buttons by their own factor, back and forth', () => {
    const map = mount(10);
    map.controls().zoomIn();
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(10 * buttonFactor, 10);
    map.controls().zoomOut();
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(10, 10);
  });
});

it('keeps both maps configured with identical zoom sensitivity and limits', () => {
  expect(drillSettings.zoomStep).toBe(technoSettings.zoomStep);
  expect(drillSettings.wheelZoomStep).toBe(technoSettings.wheelZoomStep);
  expect(drillSettings.minScaleBarMeters).toBe(technoSettings.minScaleBarMeters);
  expect(drillSettings.minZoom).toBe(technoSettings.minZoom);
  expect(drillSettings.maxZoom).toBe(technoSettings.maxZoom);
});

describe('scale bar zoom limit', () => {
  const settings = technoSettings;

  it('stops where a minScaleBarMeters bar fills the scale bar width', () => {
    const zoom = maxZoomForScaleBar(settings, 1000, BOUNDS);
    const pixelsPerMeter = (1000 * zoom) / (BOUNDS.maxX - BOUNDS.minX);

    expect(pixelsPerMeter * settings.minScaleBarMeters).toBeCloseTo(SCALE_BAR_TARGET_PX, 10);
    expect(computeScaleBar({ mapWidth: 1000, zoom, bounds: BOUNDS })).toEqual({ label: `${settings.minScaleBarMeters} m`, width: SCALE_BAR_TARGET_PX });
  });

  it('lets a wide regional map zoom deeper than a small one, to the same scale', () => {
    const regional = { minX: 335469.35, maxX: 483969.35, minY: 0, maxY: 1 };
    const redox = { minX: 412499.97, maxX: 423375.13, minY: 0, maxY: 1 };

    expect(maxZoomForScaleBar(settings, 990, regional) / maxZoomForScaleBar(settings, 990, redox))
      .toBeCloseTo((regional.maxX - regional.minX) / (redox.maxX - redox.minX), 8);
  });

  it('falls back to the hard cap until the map is measured, and never goes below the minimum', () => {
    expect(maxZoomForScaleBar(settings, null, BOUNDS)).toBe(settings.maxZoom);
    expect(maxZoomForScaleBar(settings, 0, BOUNDS)).toBe(settings.maxZoom);
    expect(maxZoomForScaleBar(settings, 1e9, BOUNDS)).toBe(settings.minZoom);
  });

  it('reaches 5 m on the 148.5 km regional map in about 18 wheel notches', () => {
    const regional = { minX: 335469.35, maxX: 483969.35, minY: 0, maxY: 1 };
    const limit = maxZoomForScaleBar(settings, 990, regional);
    let scale = settings.minZoom;
    let notches = 0;
    while (scale < limit) {
      scale = Math.min(limit, scale + stepZoomDelta(scale, settings.wheelZoomStep, 1));
      notches++;
    }

    expect(notches).toBeLessThanOrEqual(20);
  });
});
