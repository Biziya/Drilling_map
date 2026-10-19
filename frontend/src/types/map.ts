import type { CSSProperties } from 'react';
import type { DrillholeApiRecord } from './drillhole';

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

/**
 * Position of a drillhole on the base map, as a percentage of the image so it
 * survives the image being rendered at any size.
 */
export interface MapCoordinates {
  xPercent: number;
  yPercent: number;
  /** False for a hole whose UTM position falls outside the base map image. */
  isInsideMap: boolean;
}

/** A drillhole that has been placed on the map. */
export type ProjectedDrillhole = DrillholeApiRecord & MapCoordinates;

/** Projects a record onto the map, or rejects it as unplaceable. */
export type DrillholeProjection = (
  record: DrillholeApiRecord,
) => ProjectedDrillhole | null;

/** Anything carrying UTM coordinates the projection can read. */
export interface UtmProjectable {
  x?: number | string | null;
  y?: number | string | null;
}

/**
 * The pan/zoom state of a map, applied as
 * `translate(translateX, translateY) scale(scale)`.
 */
export interface MapTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

/** Zoom limits and thresholds for one map page. */
export interface MapZoomSettings {
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
  /**
   * Zoom level the wheel and button steps snap to, and the zoom from which
   * deviation lines are drawn. One value serves both.
   */
  deviationMinZoom: number;
  showLegends: boolean;
}

/**
 * Size the base map is drawn at. Before the image reports its intrinsic size
 * there is nothing to scale, so the canvas falls back to filling its box.
 */
export type CssLength = number | '100%';

export interface RenderedMapSize {
  width: CssLength;
  height: CssLength;
}

/** A CSS custom property name. */
export type CssVariableName = `--${string}`;

/**
 * Inline style that also carries CSS custom properties. React's
 * `CSSProperties` has no room for them, so they are added explicitly rather
 * than by casting the style object.
 */
export type StyleWithCssVariables = CSSProperties &
  Partial<Record<CssVariableName, string | number>>;

/** A GT grade band and the colour the map paints it. */
export interface GtRange {
  min: number;
  max: number;
  label: string;
  color: string;
}

/** Shapes a marker symbol can take. */
export type MarkerShape =
  | 'square'
  | 'square-outline'
  | 'circle'
  | 'diamond'
  | 'triangle';

/** Fill colour and shape for one marker symbol. */
export interface MarkerSymbolConfig {
  color: string;
  shape: MarkerShape;
}

/** A drillhole status entry in the status legend configuration. */
export interface DrillholeStatusConfig {
  color: string;
  shape: MarkerShape;
  label: string;
}
