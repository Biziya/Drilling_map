// Page-test helpers for the Techno Map's canvas markers. What a frame drew is
// read off the canvas (data-drawn, data-lines, and the recording 2D stub from
// tests/setup/canvas.js); a hole is found on screen with the app's own
// coordinate maths and hovered to bring up its tooltip.
import { act, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { MAP_ID } from "../../../src/pages/TechnoMap/config/technoMapConfig.js";
import { utmToMapRatio } from "../../../src/pages/TechnoMap/utils/coordinates.js";
import { computeMapOrigin, computeRenderedMapSize, mapRatioToViewport } from "../../../src/pages/TechnoMap/utils/geometry.js";
import { readMapView } from "../../../src/state/mapViewStore.js";

export const VIEWPORT = { width: 1000, height: 700 };
/** The real base map image's size. */
export const IMAGE = { width: 1191, height: 842 };

/** jsdom has no layout: every element gets the viewport's box. Undone by vi.restoreAllMocks. */
export function mockViewportBox() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    ...VIEWPORT, top: 0, left: 0, right: VIEWPORT.width, bottom: VIEWPORT.height, x: 0, y: 0,
  });
}

/** Fires the base map's and the rig icon's load events, so the canvas can draw everything. */
export async function loadMapImages(container) {
  const image = container.querySelector(".techno-map-page .base-map");
  Object.defineProperty(image, "naturalWidth", { value: IMAGE.width, configurable: true });
  Object.defineProperty(image, "naturalHeight", { value: IMAGE.height, configurable: true });
  await act(async () => fireEvent.load(image));
  const rig = container.querySelector(".techno-map-page .rig-sprite-source");
  if (rig) await act(async () => fireEvent.load(rig));
}

export const markerCanvas = (container) => container.querySelector(".techno-map-page canvas.drillhole-layer");
export const drawnMarkerCount = (container) => Number(markerCanvas(container)?.dataset.drawn ?? 0);
export const drawnLineCount = (container) => Number(markerCanvas(container)?.dataset.lines ?? 0);

/** The kind of every marker the last frame stamped, in drawing order. */
export const drawnKinds = (container) => (markerCanvas(container)?.__calls ?? [])
  .filter(([name]) => name === "drawImage")
  .map(([, image]) => image.dataset.sprite);

/** Where a UTM point is in the viewport under the page's current view. */
export function screenPointOf(utm) {
  const rendered = computeRenderedMapSize(IMAGE, VIEWPORT);
  const view = readMapView(MAP_ID, { scale: 1, translateX: 0, translateY: 0 });

  return mapRatioToViewport(utmToMapRatio(utm), view, computeMapOrigin(VIEWPORT, rendered), rendered);
}

const viewportOf = (container) => container.querySelector(".techno-map-page .map-viewport");

/** Moves the pointer onto a UTM point and returns the tooltip it brought up, or null. */
export function hoverAt(container, utm) {
  const { x, y } = screenPointOf(utm);
  fireEvent.pointerMove(viewportOf(container), { clientX: x, clientY: y, buttons: 0, pointerId: 1 });

  return container.querySelector(".marker-tooltip");
}

/** A press and release, without moving, on a UTM point: a click on the map. */
export function clickAt(container, utm) {
  const { x, y } = screenPointOf(utm);
  const viewport = viewportOf(container);
  fireEvent.pointerDown(viewport, { clientX: x, clientY: y, button: 0, buttons: 1, pointerId: 1 });
  fireEvent.pointerUp(viewport, { clientX: x, clientY: y, button: 0, buttons: 0, pointerId: 1 });
}
