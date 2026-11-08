import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useMapViewport as useDrillViewport } from '../../src/pages/DrillMap/hooks/useMapViewport';
import { useMapViewport as useTechnoViewport } from '../../src/pages/TechnoMap/hooks/useMapViewport';
import { MAP_SETTINGS as drillSettings } from '../../src/pages/DrillMap/config/drillMapConfig';
import { MAP_SETTINGS as technoSettings } from '../../src/pages/TechnoMap/config/technoMapConfig';
import { clearAllMapViews, writeMapView } from '../../src/state/mapViewStore';
import { viewportToMapRatio } from '../../src/pages/DrillMap/utils/geometry';

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
  function mount(scale) {
    writeMapView(viewKey, { scale, translateX: -100, translateY: -50 });
    let latest;
    function Viewport() {
      const viewport = useViewport({ settings, viewKey, dragIgnoreSelector: '.map-toolbar', overlaySelector: '.map-toolbar' });
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

  it.each([5, 10, 15, 20, 90, 179])('adds and subtracts the configured increment at scale %s, anchored to the cursor', scale => {
    const map = mount(scale);
    const initial = map.getView();
    const anchor = { x: 400, y: 300 };
    const ratio = view => viewportToMapRatio(anchor, view, { x: 0, y: 0 }, { width: 1000, height: 700 });
    const before = ratio(initial);
    map.wheel(-100);
    flushFrame();
    expect(map.getView().scale - initial.scale).toBeCloseTo(settings.zoomStep, 12);
    expect(ratio(map.getView()).x).toBeCloseTo(before.x, 12);
    expect(ratio(map.getView()).y).toBeCloseTo(before.y, 12);
    map.wheel(100);
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(initial.scale, 12);
    expect(map.getView().translateX).toBeCloseTo(initial.translateX, 10);
    expect(map.getView().translateY).toBeCloseTo(initial.translateY, 10);
  });

  it.each([5, 90, 179])('uses the same fractional touchpad and normalized line input at scale %s', scale => {
    const map = mount(scale);
    map.wheel(-2);
    flushFrame();
    expect(map.getView().scale - scale).toBeCloseTo(settings.zoomStep * 0.02, 12);
    map.wheel(2);
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(scale, 12);
    map.wheel(-3, 1);
    flushFrame();
    expect(map.getView().scale - scale).toBeCloseTo(settings.zoomStep, 12);
    map.wheel(1, 2);
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(scale, 12);
  });

  it.each([5, 90, 170])('handles rapid scrolling without acceleration or delayed zoom at scale %s', scale => {
    const map = mount(scale);
    for (let i = 0; i < 20; i++) map.wheel(-100);
    expect(frames.size).toBe(1);
    flushFrame();
    expect(map.getView().scale - scale).toBeCloseTo(20 * settings.zoomStep, 10);
    expect(frames.size).toBe(0);
    // A rapid reversal cancels the corresponding input, with no animation tail.
    for (let i = 0; i < 20; i++) map.wheel(100);
    flushFrame();
    expect(map.getView().scale).toBeCloseTo(scale, 10);
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
    expect(map.getView().scale).toBeCloseTo(settings.maxZoom - settings.zoomStep, 12);
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
    expect(map.getView().scale).toBeCloseTo(settings.minZoom + settings.zoomStep, 12);
  });

  it('does not duplicate listeners across renders and cleans up listeners and pending frames', () => {
    const map = mount(20);
    for (let i = 1; i <= 5; i++) {
      map.wheel(-100);
      flushFrame();
      expect(map.getView().scale).toBeCloseTo(20 + i * settings.zoomStep, 12);
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
});

it('keeps both maps configured with identical zoom sensitivity and limits', () => {
  expect(drillSettings.zoomStep).toBe(technoSettings.zoomStep);
  expect(drillSettings.minZoom).toBe(technoSettings.minZoom);
  expect(drillSettings.maxZoom).toBe(technoSettings.maxZoom);
});
