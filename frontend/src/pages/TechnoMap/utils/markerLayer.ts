// The live drillhole layer: markers and deviation lines drawn on one canvas.
//
// Thousands of holes as DOM elements (each a button, a clip-path shape and a
// hidden tooltip) made every pan and zoom restyle and repaint the lot. Here:
//
//   buildMarkerFeatures - once per dataset: dedupe, classify, project the
//                         collar and the deviation endpoint
//   selectShownFeatures - per filter change (mapFilters.ts): a plain filter
//   createHitIndex      - per filter change: a grid for pointer hit-testing
//   drawMarkerLayer     - per frame: cull to the viewport, stamp pre-rendered
//                         sprites, stroke every line in one path
//
// Positions use the same UTM -> map ratio -> viewport conversion as every
// other layer (coordinates.ts, geometry.ts), so nothing can drift from the
// base map, the grid or the measurement.

import { DRILLHOLE_TYPE_CONFIG, MAP_CONFIG } from '../config/technoMapConfig';
import type { DrillholeType, MarkerKind } from '../config/technoMapConfig';
import { projectDrillholes } from './coordinates';
import { resolveDrillholeType } from './markerKind';
import { markerSizeFor, traceShape } from './markerShapes';
import { dedupeDrillholes } from '../../../utils/dedupeDrillholes';
import { isInProgressHole, readDrillholeText } from '../../../utils/drillholeFields';
import type { MapTransform, Point, ProjectedDrillhole, Size } from '../../../types/map';

/** One drawable hole, everything the frame loop needs already worked out. */
export interface MarkerFeature {
  /** Stable identity: the record ID when the API sends one, else hole id and position. */
  key: string;
  drillhole: ProjectedDrillhole;
  type: DrillholeType;
  /** The rig when in progress, otherwise the type. */
  kind: MarkerKind;
  isInProgress: boolean;
  /** Collar as a map ratio (0-1). */
  x: number;
  y: number;
  /** Exaggerated deviation endpoint as a map ratio, or null when there is no line. */
  end: Point | null;
}

/**
 * Every hole a filter could show, worked out once per dataset. Holes without a
 * category (an unmapped SQL Type) are left out: no filter shows them.
 */
export function buildMarkerFeatures(drillholes: readonly ProjectedDrillhole[]): MarkerFeature[] {
  return projectDrillholes(dedupeDrillholes(drillholes)).flatMap(({ drillhole, key, endpoint }) => {
    const type = resolveDrillholeType(drillhole);
    if (!type) return [];
    const isInProgress = isInProgressHole(drillhole);
    const id = readDrillholeText(drillhole, 'id')?.trim();

    return [{
      key: id ? `id:${id}` : key,
      drillhole,
      type,
      kind: isInProgress ? 'rig' : type,
      isInProgress,
      x: drillhole.xPercent / 100,
      y: drillhole.yPercent / 100,
      end: endpoint ? { x: endpoint.xPercent / 100, y: endpoint.yPercent / 100 } : null,
    }];
  });
}

/**
 * Map ratio -> viewport pixels for one view: `x + ratio * width`. The same
 * sum as geometry.ts mapRatioToViewport, with the per-view part done once
 * instead of once per point.
 */
export interface ScreenTransform {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function screenTransform(view: MapTransform, mapOrigin: Point, mapSize: Size): ScreenTransform {
  return {
    x: mapOrigin.x + view.translateX,
    y: mapOrigin.y + view.translateY,
    width: mapSize.width * view.scale,
    height: mapSize.height * view.scale,
  };
}

/** Half the on-screen box of a marker kind, in px. */
export function markerHalfSize(kind: MarkerKind): number {
  return (kind === 'rig' ? MAP_CONFIG.markers.rigSize : markerSizeFor(DRILLHOLE_TYPE_CONFIG[kind].shape)) / 2;
}

// --- Hit testing -------------------------------------------------------------

/** Cells per side of the hit grid over the map (ratios 0-1, edges clamped). */
const GRID = 128;
/** Extra px around a marker that still counts as on it. */
const HIT_SLOP = 2;

export interface HitIndex {
  features: readonly MarkerFeature[];
  /** Cell number -> indices into `features`. */
  cells: ReadonlyMap<number, readonly number[]>;
}

const cellOf = (ratio: number) => Math.min(GRID - 1, Math.max(0, Math.floor(ratio * GRID)));

/** Buckets the shown features by grid cell, so a pointer looks at a handful, not thousands. */
export function createHitIndex(features: readonly MarkerFeature[]): HitIndex {
  const cells = new Map<number, number[]>();
  features.forEach(({ x, y }, index) => {
    const cell = cellOf(y) * GRID + cellOf(x);
    const bucket = cells.get(cell);
    if (bucket) bucket.push(index); else cells.set(cell, [index]);
  });

  return { features, cells };
}

/**
 * The marker under a viewport point, or null. Of several, the nearest wins;
 * on a tie the one drawn last (on top). Rigs are drawn above other markers.
 */
export function findMarkerAt(index: HitIndex, point: Point, transform: ScreenTransform): MarkerFeature | null {
  if (!(transform.width > 0 && transform.height > 0)) return null;

  const reach = MAP_CONFIG.markers.rigSize / 2 + HIT_SLOP;
  const toRatioX = (px: number) => (px - transform.x) / transform.width;
  const toRatioY = (py: number) => (py - transform.y) / transform.height;
  const [minCol, maxCol] = [cellOf(toRatioX(point.x - reach)), cellOf(toRatioX(point.x + reach))];
  const [minRow, maxRow] = [cellOf(toRatioY(point.y - reach)), cellOf(toRatioY(point.y + reach))];

  let best: MarkerFeature | null = null;
  let bestScore = Infinity;
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      for (const i of index.cells.get(row * GRID + col) ?? []) {
        const feature = index.features[i];
        if (!feature) continue;
        const dx = Math.abs(point.x - (transform.x + feature.x * transform.width));
        const dy = Math.abs(point.y - (transform.y + feature.y * transform.height));
        const half = markerHalfSize(feature.kind) + HIT_SLOP;
        if (dx > half || dy > half) continue;

        // Rigs sit on top, then later features; distance decides first.
        const score = Math.hypot(dx, dy) - (feature.kind === 'rig' ? 0.001 : 0) - i * 1e-9;
        if (score < bestScore) {
          best = feature;
          bestScore = score;
        }
      }
    }
  }

  return best;
}

// --- Sprites -----------------------------------------------------------------

/** A marker pre-rendered once at device resolution, stamped with drawImage. */
export interface Sprite {
  image: CanvasImageSource;
  /** Drawn size in CSS px (the marker plus room for its shadow). */
  size: number;
}

/** Room around a sprite for its drop shadow, in px. */
const SPRITE_PAD = 3;
const SHADOW = { color: 'rgba(0, 0, 0, .45)', blur: 2, offsetY: 1 };

function createSprite(
  kind: MarkerKind,
  markerSize: number,
  pixelRatio: number,
  paint: (context: CanvasRenderingContext2D) => void,
): Sprite | null {
  const size = markerSize + 2 * SPRITE_PAD;
  const canvas = document.createElement('canvas');
  // Names the sprite in devtools and tests; never read by the map.
  canvas.dataset.sprite = kind;
  canvas.width = Math.ceil(size * pixelRatio);
  canvas.height = canvas.width;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.scale(pixelRatio, pixelRatio);
  context.translate(size / 2, size / 2);
  paint(context);

  return { image: canvas, size };
}

/** A type's marker: its shape in white, with the type colour inset by the outline. */
function createTypeSprite(type: DrillholeType, pixelRatio: number): Sprite | null {
  const { shape, color } = DRILLHOLE_TYPE_CONFIG[type];
  const size = markerSizeFor(shape);
  const outline = MAP_CONFIG.markers.outline;

  return createSprite(type, size, pixelRatio, (context) => {
    context.shadowColor = SHADOW.color;
    context.shadowBlur = SHADOW.blur * pixelRatio;
    context.shadowOffsetY = SHADOW.offsetY * pixelRatio;
    context.fillStyle = '#fff';
    context.beginPath();
    traceShape(context, shape, 0, 0, size);
    context.fill();

    context.shadowColor = 'transparent';
    context.fillStyle = color;
    context.beginPath();
    traceShape(context, shape, 0, 0, size - 2 * outline);
    context.fill();
  });
}

function createRigSprite(icon: CanvasImageSource, pixelRatio: number): Sprite | null {
  const size = MAP_CONFIG.markers.rigSize;

  return createSprite('rig', size, pixelRatio, (context) => {
    context.shadowColor = 'rgba(0, 0, 0, .5)';
    context.shadowBlur = 2 * pixelRatio;
    context.shadowOffsetY = pixelRatio;
    context.drawImage(icon, -size / 2, -size / 2, size, size);
  });
}

export interface SpriteSet {
  pixelRatio: number;
  get: (kind: MarkerKind) => Sprite | null;
}

/**
 * Sprites by marker kind for one pixel ratio, built on first use. Without the
 * rig icon (still loading) rigs have no sprite and are skipped.
 */
export function createSpriteSet(pixelRatio: number, rigIcon: CanvasImageSource | null): SpriteSet {
  const sprites = new Map<MarkerKind, Sprite | null>();

  return {
    pixelRatio,
    get(kind) {
      if (!sprites.has(kind)) {
        let sprite: Sprite | null = null;
        if (kind !== 'rig') sprite = createTypeSprite(kind, pixelRatio);
        else if (rigIcon) sprite = createRigSprite(rigIcon, pixelRatio);
        sprites.set(kind, sprite);
      }

      return sprites.get(kind) ?? null;
    },
  };
}

// --- Drawing -----------------------------------------------------------------

/** Markers this far outside the viewport are still drawn, so none pop in at the edge. */
export const CULL_MARGIN = 40;

export interface DrawOptions {
  features: readonly MarkerFeature[];
  transform: ScreenTransform;
  viewport: Size;
  deviationVisible: boolean;
  sprites: SpriteSet;
}

export interface DrawResult {
  markers: number;
  lines: number;
}

/**
 * Draws one frame: deviation lines, then markers, then rigs on top. Only what
 * falls within the viewport (plus CULL_MARGIN) is drawn; every feature stays
 * in `features` for the next frame.
 */
export function drawMarkerLayer(context: CanvasRenderingContext2D, options: DrawOptions): DrawResult {
  const { features, transform: t, viewport, deviationVisible, sprites } = options;
  const ratio = sprites.pixelRatio;
  const [left, top] = [-CULL_MARGIN, -CULL_MARGIN];
  const [right, bottom] = [viewport.width + CULL_MARGIN, viewport.height + CULL_MARGIN];
  const snap = (value: number) => Math.round(value * ratio) / ratio;

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, viewport.width, viewport.height);

  let lines = 0;
  if (deviationVisible) {
    context.beginPath();
    for (const { x, y, end } of features) {
      if (!end) continue;
      const [x1, y1] = [t.x + x * t.width, t.y + y * t.height];
      const [x2, y2] = [t.x + end.x * t.width, t.y + end.y * t.height];
      if (Math.max(x1, x2) < left || Math.min(x1, x2) > right || Math.max(y1, y2) < top || Math.min(y1, y2) > bottom) continue;
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      lines += 1;
    }
    context.strokeStyle = MAP_CONFIG.deviationLine.color;
    context.lineWidth = 1;
    context.lineCap = 'round';
    context.stroke();
  }

  let markers = 0;
  for (const rigs of [false, true]) {
    for (const { x, y, kind, isInProgress } of features) {
      if (isInProgress !== rigs) continue;
      const sx = t.x + x * t.width;
      const sy = t.y + y * t.height;
      if (sx < left || sx > right || sy < top || sy > bottom) continue;
      const sprite = sprites.get(kind);
      if (!sprite) continue;
      context.drawImage(sprite.image, snap(sx - sprite.size / 2), snap(sy - sprite.size / 2), sprite.size, sprite.size);
      markers += 1;
    }
  }

  return { markers, lines };
}
