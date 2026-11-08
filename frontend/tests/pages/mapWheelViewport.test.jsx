import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useMapViewport as useDrillViewport } from '../../src/pages/DrillMap/hooks/useMapViewport';
import { useMapViewport as useTechnoViewport } from '../../src/pages/TechnoMap/hooks/useMapViewport';
import { MAP_SETTINGS as drillSettings } from '../../src/pages/DrillMap/config/drillMapConfig';
import { MAP_SETTINGS as technoSettings } from '../../src/pages/TechnoMap/config/technoMapConfig';
import { clearAllMapViews, writeMapView } from '../../src/state/mapViewStore';
import { viewportToMapRatio } from '../../src/pages/DrillMap/utils/geometry';
import { getWheelZoomStep } from '../../src/utils/mapWheel';

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

describe.each([
  ['DrillMap', useDrillViewport, drillSettings, 'exploration-map'],
  ['TechnoMap', useTechnoViewport, technoSettings, 'techno-map'],
])('%s native wheel zoom', (_page, useViewport, settings, viewKey) => {
  function mount(scale, options = settings) {
    writeMapView(viewKey, { scale, translateX: -100, translateY: -50 });
    let latest;
    function Viewport() {
      const viewport = useViewport({ settings: options, viewKey, dragIgnoreSelector: '.map-toolbar', overlaySelector: '.map-toolbar' });
      latest = viewport;
      return <div ref={viewport.viewportRef} {...viewport.viewportHandlers} data-testid="viewport">
        <img alt="Test map" onLoad={viewport.image.onLoad} />
        <button className="map-toolbar" type="button">Overlay control</button>
      </div>;
    }
    const result = render(<Viewport />);
    const image = result.getByAltText('Test map');
    Object.defineProperties(image, { naturalWidth: { value: 1000 }, naturalHeight: { value: 700 } });
    fireEvent.load(image);
    const element = result.getByTestId('viewport');
    const wheel = (deltaY, deltaMode = 0, target = element) => fireEvent.wheel(target, { deltaY, deltaMode, clientX: 420, clientY: 330 });
    return { ...result, element, wheel, getView: () => latest.view, controls: () => latest.controls };
  }

  it.each([5, 10, 15, 20, 90, 170])('uses the current adaptive step at scale %s, anchored to the cursor in both directions', scale => {
    const map = mount(scale);
    const initial = map.getView();
    const anchor = { x: 400, y: 300 };
    const ratio = view => viewportToMapRatio(anchor, view, { x: 0, y: 0 }, { width: 1000, height: 700 });
    const before = ratio(initial);
    map.wheel(-100);
    flushFrame();
    expect(map.getView().scale - initial.scale).toBeCloseTo(getWheelZoomStep(scale, settings), 12);
    expect(ratio(map.getView()).x).toBeCloseTo(before.x, 12);
    expect(ratio(map.getView()).y).toBeCloseTo(before.y, 12);
    const zoomed = map.getView();
    map.wheel(100);
    flushFrame();
    expect(zoomed.scale - map.getView().scale).toBeCloseTo(getWheelZoomStep(zoomed.scale, settings), 12);
    expect(ratio(map.getView()).x).toBeCloseTo(before.x, 12);
    expect(ratio(map.getView()).y).toBeCloseTo(before.y, 12);
  });

  it.each([5, 90, 170])('normalizes fractional touchpad and line input at scale %s', scale => {
    const map = mount(scale);
    map.wheel(-2);
    flushFrame();
    expect(map.getView().scale - scale).toBeCloseTo(getWheelZoomStep(scale, settings) * 0.02, 12);
    let previous = map.getView().scale;
    map.wheel(2);
    flushFrame();
    expect(previous - map.getView().scale).toBeCloseTo(getWheelZoomStep(previous, settings) * 0.02, 12);
    previous = map.getView().scale;
    map.wheel(-3, 1);
    flushFrame();
    expect(map.getView().scale - previous).toBeCloseTo(getWheelZoomStep(previous, settings), 12);
    previous = map.getView().scale;
    map.wheel(1, 2);
    flushFrame();
    expect(previous - map.getView().scale).toBeCloseTo(getWheelZoomStep(previous, settings), 12);
  });

  it.each([5, 90, 170])('uses the live scale during rapid bursts with no delayed zoom at scale %s', scale => {
    const map = mount(scale);
    let expected = scale;
    for (let i = 0; i < 20; i++) {
      expected = Math.min(settings.maxZoom, expected + getWheelZoomStep(expected, settings));
      map.wheel(-100);
    }
    expect(frames.size).toBe(1);
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(expected, 10);
    expect(frames.size).toBe(0);
    // Reversing immediately uses the new scale; it adds no animation tail.
    for (let i = 0; i < 20; i++) {
      expected = Math.max(settings.minZoom, expected - getWheelZoomStep(expected, settings));
      map.wheel(100);
    }
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(expected, 10);
    const settled = map.getView();
    flushFrame();
    expect(map.getView()).toBe(settled);
  });

  it('clamps at the existing maximum and reverses immediately', () => {
    const map = mount(settings.maxZoom - settings.zoomStep / 2);
    map.wheel(-100);
    flushFrame();
    expect(map.getView().scale).toBe(settings.maxZoom);
    map.wheel(-10000);
    expect(frames.size).toBe(0);
    map.wheel(100);
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(settings.maxZoom - settings.maxWheelZoomStep, 12);
  });

  it('clamps at the existing minimum and reverses immediately', () => {
    const map = mount(settings.minZoom + settings.zoomStep / 2);
    map.wheel(100);
    flushFrame();
    expect(map.getView().scale).toBe(settings.minZoom);
    map.wheel(10000);
    expect(frames.size).toBe(0);
    map.wheel(-100);
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(settings.minZoom + settings.minWheelZoomStep, 12);
  });

  it('does not duplicate listeners across renders and cleans up listeners and pending frames', () => {
    const map = mount(20);
    let expected = 20;
    for (let i = 1; i <= 5; i++) {
      expected += getWheelZoomStep(expected, settings);
      map.wheel(-100);
      flushFrame();
      expect(map.getView().scale).toBeCloseTo(expected, 12);
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

  it('smoothly increases wheel speed on zoom-in and decreases it on zoom-out', () => {
    const map = mount(90);
    let previousStep = 0;
    for (let i = 0; i < 5; i++) {
      const previous = map.getView().scale;
      map.wheel(-100);
      flushFrame();
      const step = map.getView().scale - previous;
      expect(step).toBeGreaterThan(previousStep);
      previousStep = step;
    }
    previousStep = Infinity;
    for (let i = 0; i < 5; i++) {
      const previous = map.getView().scale;
      map.wheel(100);
      flushFrame();
      const step = previous - map.getView().scale;
      expect(step).toBeLessThan(previousStep);
      previousStep = step;
    }
  });

  it('keeps toolbar steps fixed and supports disabling adaptive wheel zoom', () => {
    const map = mount(90, { ...settings, adaptiveZoomEnabled: false });
    map.wheel(-100);
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(90 + settings.zoomStep, 12);
    map.wheel(100);
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(90, 12);
    map.unmount();
    const adaptiveMap = mount(90);
    adaptiveMap.controls().zoomIn();
    flushFrame();
    expect(adaptiveMap.getView().scale).toBeCloseTo(90 + settings.zoomStep, 12);
  });
});

it('keeps both maps configured with identical zoom sensitivity and limits', () => {
  expect(drillSettings.zoomStep).toBe(technoSettings.zoomStep);
  expect(drillSettings.adaptiveZoomEnabled).toBe(technoSettings.adaptiveZoomEnabled);
  expect(drillSettings.minWheelZoomStep).toBe(technoSettings.minWheelZoomStep);
  expect(drillSettings.maxWheelZoomStep).toBe(technoSettings.maxWheelZoomStep);
  expect(drillSettings.minZoom).toBe(technoSettings.minZoom);
  expect(drillSettings.maxZoom).toBe(technoSettings.maxZoom);
});

it('bounds the linear curve at both ends and interpolates smoothly', () => {
  const settings = drillSettings;
  expect(getWheelZoomStep(settings.minZoom - 100, settings)).toBe(settings.minWheelZoomStep);
  expect(getWheelZoomStep(settings.maxZoom + 100, settings)).toBe(settings.maxWheelZoomStep);
  const middle = (settings.minZoom + settings.maxZoom) / 2;
  expect(getWheelZoomStep(middle, settings)).toBeCloseTo((settings.minWheelZoomStep + settings.maxWheelZoomStep) / 2, 12);
  expect(getWheelZoomStep(middle + 0.01, settings) - getWheelZoomStep(middle, settings)).toBeCloseTo(0.01 * (settings.maxWheelZoomStep - settings.minWheelZoomStep) / (settings.maxZoom - settings.minZoom), 12);
});

it('reaches the maximum in substantially fewer wheel steps than the fixed increment', () => {
  const settings = drillSettings;
  const fixedSteps = Math.ceil((settings.maxZoom - settings.minZoom) / settings.zoomStep);
  let scale = settings.minZoom;
  let steps = 0;
  while (scale < settings.maxZoom && steps < fixedSteps) {
    scale = Math.min(settings.maxZoom, scale + getWheelZoomStep(scale, settings));
    steps++;
  }
  expect(scale).toBe(settings.maxZoom);
  expect(steps).toBeLessThan(fixedSteps / 2);
});
