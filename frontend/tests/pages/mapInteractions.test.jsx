import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import MapScreenshot from '../../src/components/MapScreenshot/MapScreenshot';
import { getWheelZoomStep, wheelZoomDelta } from '../../src/utils/mapWheel';
import * as drillGeometry from '../../src/pages/DrillMap/utils/geometry';
import * as technoGeometry from '../../src/pages/TechnoMap/utils/geometry';
import * as drillExport from '../../src/pages/DrillMap/utils/exportMap';
import * as technoExport from '../../src/pages/TechnoMap/utils/exportMap';
import { MAP_SETTINGS as drillSettings, MAP_UTM_BOUNDS as drillBounds } from '../../src/pages/DrillMap/config/drillMapConfig';
import { MAP_SETTINGS as technoSettings } from '../../src/pages/TechnoMap/config/technoMapConfig';
import { ALL_VISIBLE } from '../../src/pages/TechnoMap/utils/mapFilters';
import { computeScaleBar } from '../../src/pages/DrillMap/utils/scaleBar';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

// The Exploration Map export takes the selected base map's image and corners;
// the Techno Map ignores both.
const LAYOUT = { src: '/base-map3.svg', bounds: drillBounds };

describe.each([
  ['DrillMap', drillGeometry, drillExport, drillSettings],
  ['TechnoMap', technoGeometry, technoExport, technoSettings],
])('%s zoom and capture', (page, geometry, exporter, settings) => {
  it('applies progressive wheel steps at low, middle and high scales with a fixed cursor anchor', () => {
    const origin = { x: 5, y: 0 }, anchor = { x: 400, y: 300 }, mapSize = { width: 990, height: 700 };
    for (const scale of [1, 9.8, 15, 90, 170]) {
      const view = { scale, translateX: -100, translateY: -50 };
      const delta = wheelZoomDelta({ deltaY: -100, deltaMode: 0 }, getWheelZoomStep(scale, settings));
      const next = geometry.zoomView(view, scale + delta, anchor, origin, settings);
      expect(next.scale - scale).toBeCloseTo(getWheelZoomStep(scale, settings));
      const before = geometry.viewportToMapRatio(anchor, view, origin, mapSize);
      const after = geometry.viewportToMapRatio(anchor, next, origin, mapSize);
      expect(after.x).toBeCloseTo(before.x, 12);
      expect(after.y).toBeCloseTo(before.y, 12);
    }
    expect(geometry.resolveScale(179.9, 181, settings)).toBe(settings.maxZoom);
    expect(settings.maxZoom).toBeGreaterThan(90);
  });

  it('keeps the real-world scale accurate beyond the old maximum', () => {
    const bounds = { minX: 412499.97, maxX: 423375.13, minY: 4890500, maxY: 4898190.29 };
    const bar = computeScaleBar({ mapWidth: 1200, zoom: settings.maxZoom, bounds });
    expect(bar.label).toBe('5 m');
    expect(bar.width / 5).toBeCloseTo(1200 * settings.maxZoom / (bounds.maxX - bounds.minX));
  });

  it('crops in viewport coordinates at 2x without adding a title or selection UI', () => {
    const snapshot = {
      viewport: { width: 1000, height: 700 }, view: { scale: 120, translateX: -100, translateY: -200 },
      mapOrigin: { x: 5, y: 0 }, mapSize: { width: 990, height: 700 },
      drillholes: [], filters: ALL_VISIBLE, measurement: [], title: 'Do not add a title', ...LAYOUT,
      capture: { x: 100, y: 150, width: 300, height: 200 },
    };
    const doc = new DOMParser().parseFromString(exporter.buildMapSvg(snapshot, { baseMap: 'data:image/png;base64,AAAA', rigIcon: '' }, 2), 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.getAttribute('viewBox')).toBe('100 150 300 200');
    expect(doc.documentElement.getAttribute('width')).toBe('600');
    expect(doc.documentElement.getAttribute('height')).toBe('400');
    expect(doc.querySelector('image').getAttribute('x')).toBe('-95');
    expect(doc.querySelector('image').getAttribute('width')).toBe('118800');
    expect(doc.documentElement.textContent).not.toContain(snapshot.title);
    expect(exporter.exportFileName('png', new Date(2026, 10, 7, 9, 4, 3))).toBe(`${page}_2026-11-07_09-04-03.png`);
  });

  it('downloads only the selected PNG at 2x and releases temporary URLs', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: () => Promise.resolve(new Blob(['<svg/>'])) })));
    vi.stubGlobal('Image', class { decode() { return Promise.resolve(); } });
    const create = vi.fn(() => 'blob:capture'), revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke });
    const encoded = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback, type) {
      encoded.push({ width: this.width, height: this.height, type });
      callback(new Blob(['pixels'], { type }));
    });
    const downloads = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { downloads.push(this.download); });
    await exporter.exportMap('png', {
      viewport: { width: 1000, height: 700 }, view: { scale: 180, translateX: 0, translateY: 0 },
      mapOrigin: { x: 5, y: 0 }, mapSize: { width: 990, height: 700 },
      drillholes: [], filters: ALL_VISIBLE, measurement: [], title: page, baseMap: 'white-grid', ...LAYOUT, src: null,
      capture: { x: 100, y: 150, width: 300, height: 200 },
    });
    expect(encoded).toEqual([{ width: 600, height: 400, type: 'image/png' }]);
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatch(new RegExp(`^${page}_\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2}\\.png$`));
    // The rasterisation URL is revoked immediately; download URL has a short delay.
    expect(revoke).toHaveBeenCalledWith('blob:capture');
  });

  it('downloads a cropped standalone SVG without rasterizing the vector elements', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: () => Promise.resolve(new Blob(['<svg/>'])) })));
    const blobs = [];
    vi.stubGlobal('URL', { createObjectURL: vi.fn(blob => { blobs.push(blob); return 'blob:svg'; }), revokeObjectURL: vi.fn() });
    const rasterise = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');
    const downloads = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { downloads.push(this.download); });
    await exporter.exportMap('svg', {
      viewport: { width: 1000, height: 700 }, view: { scale: 120, translateX: -100, translateY: -200 },
      mapOrigin: { x: 5, y: 0 }, mapSize: { width: 990, height: 700 },
      drillholes: [], filters: ALL_VISIBLE, measurement: [], title: page, ...LAYOUT,
      capture: { x: 100, y: 150, width: 300, height: 200 },
    });
    expect(downloads[0]).toMatch(new RegExp(`^${page}_.*\\.svg$`));
    expect(blobs[0].type).toBe('image/svg+xml');
    const text = await new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsText(blobs[0]);
    });
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.getAttribute('viewBox')).toBe('100 150 300 200');
    expect(doc.documentElement.getAttribute('width')).toBe('300');
    expect(doc.documentElement.getAttribute('height')).toBe('200');
    expect(doc.querySelector('path')).toBeTruthy();
    expect(doc.querySelector('image').getAttribute('href')).toMatch(/^data:/);
    expect(rasterise).not.toHaveBeenCalled();
  });
});

it('normalizes line/page wheel units, caps large jumps and preserves fractional touchpad input', () => {
  expect(wheelZoomDelta({ deltaY: -3, deltaMode: 1 }, 0.4)).toBe(0.4);
  expect(wheelZoomDelta({ deltaY: -1, deltaMode: 2 }, 0.4)).toBe(0.4);
  expect(wheelZoomDelta({ deltaY: -10000, deltaMode: 0 }, 0.4)).toBe(0.4);
  expect(wheelZoomDelta({ deltaY: -2, deltaMode: 0 }, 0.4)).toBeCloseTo(0.008);
  expect(wheelZoomDelta({ deltaY: 0, deltaMode: 0 }, 0.4)).toBe(0);
});

function selection() {
  const viewport = document.createElement('div');
  const onCapture = vi.fn(), onCancel = vi.fn(), onPan = vi.fn();
  const result = render(<div onPointerDown={onPan}><MapScreenshot viewportRef={{ current: viewport }} onCancel={onCancel} onCapture={onCapture} /></div>);
  const overlay = result.getByLabelText('Screenshot selection');
  vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({ left: 10, top: 20, width: 1000, height: 700 });
  Object.defineProperties(overlay, { clientWidth: { value: 1000 }, clientHeight: { value: 700 } });
  return { ...result, overlay, viewport, onCapture, onCancel, onPan };
}

it('selects in reverse, clamps to the viewport and prevents map panning', () => {
  const { overlay, onCapture, onPan, getByRole } = selection();
  fireEvent.pointerDown(overlay, { button: 0, clientX: 410, clientY: 320 });
  fireEvent.pointerMove(overlay, { clientX: -20, clientY: 120 });
  const box = overlay.querySelector('.map-screenshot__selection');
  expect(box.style.left).toBe('0px');
  expect(box.style.width).toBe('400px');
  fireEvent.pointerUp(overlay, { clientX: -20, clientY: 120 });
  expect(onCapture).not.toHaveBeenCalled();
  expect(getByRole('dialog', { name: 'Export Screenshot' }).open).toBe(true);
  expect(getByRole('radio', { name: 'PNG' }).checked).toBe(true);
  expect(document.activeElement).toBe(getByRole('radio', { name: 'PNG' }));
  expect(box.style.width).toBe('400px');
  fireEvent.click(getByRole('button', { name: 'Export', exact: true }));
  expect(onCapture).toHaveBeenCalledExactlyOnceWith({ x: 0, y: 100, width: 400, height: 200 }, 'png');
  expect(onPan).not.toHaveBeenCalled();
});

it('offers SVG for the same selection without exporting until confirmed', () => {
  const { overlay, onCapture, getByRole } = selection();
  fireEvent.pointerDown(overlay, { button: 0, clientX: 110, clientY: 120 });
  fireEvent.pointerUp(overlay, { clientX: 410, clientY: 320 });
  fireEvent.click(getByRole('radio', { name: 'SVG' }));
  expect(getByRole('radio', { name: 'SVG' }).checked).toBe(true);
  expect(getByRole('radio', { name: 'PNG' }).checked).toBe(false);
  expect(onCapture).not.toHaveBeenCalled();
  // A finalized selection cannot be moved by another press.
  fireEvent.pointerDown(overlay, { button: 0, clientX: 10, clientY: 20 });
  fireEvent.pointerUp(overlay, { clientX: 110, clientY: 120 });
  fireEvent.click(getByRole('button', { name: 'Export', exact: true }));
  expect(onCapture).toHaveBeenCalledExactlyOnceWith({ x: 100, y: 100, width: 300, height: 200 }, 'svg');
});

it.each(['Cancel', 'Close export', 'Escape'])('cancels the finalized selection via %s without exporting', (action) => {
  const { overlay, onCapture, onCancel, getByRole } = selection();
  fireEvent.pointerDown(overlay, { button: 0, clientX: 110, clientY: 120 });
  fireEvent.pointerUp(overlay, { clientX: 410, clientY: 320 });
  if (action === 'Escape') fireEvent.keyDown(window, { key: 'Escape' });
  else fireEvent.click(getByRole('button', { name: action }));
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onCapture).not.toHaveBeenCalled();
});

it('keeps keyboard focus in the dialog and closes it when the map unmounts', () => {
  const { overlay, getByRole, unmount } = selection();
  const close = vi.spyOn(HTMLDialogElement.prototype, 'close');
  fireEvent.pointerDown(overlay, { button: 0, clientX: 110, clientY: 120 });
  fireEvent.pointerUp(overlay, { clientX: 410, clientY: 320 });
  const first = getByRole('button', { name: 'Close export' });
  const last = getByRole('button', { name: 'Export', exact: true });
  last.focus();
  fireEvent.keyDown(last, { key: 'Tab' });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(last);
  unmount();
  expect(close).toHaveBeenCalledTimes(1);
});

it('preserves fractional CSS viewport coordinates at high device scale', () => {
  const { overlay, getByRole, onCapture } = selection();
  overlay.getBoundingClientRect.mockReturnValue({ left: 10.25, top: 20.5, width: 1000.4, height: 700.3 });
  fireEvent.pointerDown(overlay, { button: 0, clientX: 110.25, clientY: 120.5 });
  fireEvent.pointerUp(overlay, { clientX: 410.25, clientY: 320.5 });
  fireEvent.click(getByRole('button', { name: 'Export', exact: true }));
  expect(onCapture).toHaveBeenCalledExactlyOnceWith({ x: 100, y: 100, width: 300, height: 200 }, 'png');
});

it('ignores tiny selections, cancels on Escape and cleans up wheel/key listeners on unmount', () => {
  const { overlay, viewport, onCapture, onCancel, unmount } = selection();
  fireEvent.pointerDown(overlay, { button: 0, clientX: 20, clientY: 30 });
  fireEvent.pointerUp(overlay, { clientX: 23, clientY: 32 });
  expect(onCapture).not.toHaveBeenCalled();
  const wheel = new WheelEvent('wheel', { deltaY: 100, cancelable: true });
  viewport.dispatchEvent(wheel);
  expect(wheel.defaultPrevented).toBe(true);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onCancel).toHaveBeenCalledTimes(1);
  unmount();
  fireEvent.keyDown(window, { key: 'Escape' });
  const restored = new WheelEvent('wheel', { cancelable: true });
  viewport.dispatchEvent(restored);
  expect(restored.defaultPrevented).toBe(false);
  expect(onCancel).toHaveBeenCalledTimes(1);
});
