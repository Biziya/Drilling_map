import type { CSSProperties } from 'react';
import type { DrillholeApiRecord } from './drillhole';

/** Identifies one map: its cached dataset and its persisted view share this key. */
export type MapId = 'exploration-map' | 'techno-map';

/** A point in whatever space the surrounding code is working in. */
export interface Point {
  x: number;
  y: number;
}

/** A UTM easting/northing pair. Same shape as `Point`, different meaning. */
export type UtmCoordinates = Point;

/** A width/height pair in CSS pixels. */
export interface Size {
  width: number;
  height: number;
}

/** The UTM rectangle the base map image covers. */
export interface MapBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Position on the base map as a percentage of the image, so it survives resizing. */
export interface MapCoordinates {
  xPercent: number;
  yPercent: number;
  /** False for a hole whose UTM position falls outside the base map image. */
  isInsideMap: boolean;
}

/** A drillhole that has been placed on the map. */
export type ProjectedDrillhole = DrillholeApiRecord & MapCoordinates;

/** Projects a record onto the map, or rejects it as unplaceable. */
export type DrillholeProjection = (record: DrillholeApiRecord) => ProjectedDrillhole | null;

/** Anything carrying UTM coordinates the projection can read. */
export interface UtmProjectable {
  x?: number | string | null;
  y?: number | string | null;
}

/** Pan/zoom state, applied as `translate(translateX, translateY) scale(scale)`. */
export interface MapTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

/** Zoom limits and thresholds for a map. */
export interface MapZoomSettings {
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
  /** Zoom the steps snap to, and from which deviation lines are drawn. */
  deviationMinZoom: number;
}

/** Size the base map is drawn at; `'100%'` until the image reports its size. */
export type CssLength = number | '100%';

export interface RenderedMapSize {
  width: CssLength;
  height: CssLength;
}

/** Inline style that also carries CSS custom properties. */
export type StyleWithCssVariables = CSSProperties & Partial<Record<`--${string}`, string | number>>;

/** A GT grade band and the colour the map paints it. */
export interface GtRange {
  min: number;
  max: number;
  label: string;
  color: string;
}

/** Shapes a marker symbol can take. */
export type MarkerShape = 'square' | 'triangle';
