// Outline of every marker shape in a unit box (0-1, y down). The legend
// symbols clip to these, the map canvas traces them and the SVG export draws
// them, so the three cannot drift.

import { MAP_CONFIG } from '../config/technoMapConfig';
import type { MarkerShape } from '../config/technoMapConfig';

type Outline = readonly (readonly [number, number])[];

const round = (value: number) => Math.round(value * 1000) / 1000;

/** Regular polygon (or star, with an inner radius) with its first point straight up. */
function radial(points: number, innerRadius?: number): Outline {
  const count = innerRadius ? points * 2 : points;

  return Array.from({ length: count }, (_, index) => {
    const radius = innerRadius && index % 2 ? innerRadius : 0.5;
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;

    return [round(0.5 + radius * Math.cos(angle)), round(0.5 + radius * Math.sin(angle))] as const;
  });
}

const OUTLINES: Readonly<Record<Exclude<MarkerShape, 'circle'>, Outline>> = {
  square: [[0, 0], [1, 0], [1, 1], [0, 1]],
  triangle: [[0.5, 0], [1, 1], [0, 1]],
  'triangle-down': [[0, 0], [1, 0], [0.5, 1]],
  // Vertical: taller than wide.
  diamond: [[0.5, 0], [0.84, 0.5], [0.5, 1], [0.16, 0.5]],
  pentagon: radial(5),
  hexagon: radial(6),
  // Five points, the inner radius wide enough to read at marker size.
  star: radial(5, 0.24),
  cross: [
    [0.32, 0], [0.68, 0], [0.68, 0.32], [1, 0.32], [1, 0.68], [0.68, 0.68],
    [0.68, 1], [0.32, 1], [0.32, 0.68], [0, 0.68], [0, 0.32], [0.32, 0.32],
  ],
};

/** Box a shape is drawn in on the map, white outline included (technoMap.yaml markers). */
export function markerSizeFor(shape: MarkerShape): number {
  return shape === 'square' || shape === 'circle' ? MAP_CONFIG.markers.size : MAP_CONFIG.markers.polygonSize;
}

/** CSS clip-path for a shape; null for the circle, which is a rounded box. */
export function clipPathFor(shape: MarkerShape): string | null {
  if (shape === 'circle') return null;

  return `polygon(${OUTLINES[shape].map(([x, y]) => `${round(x * 100)}% ${round(y * 100)}%`).join(', ')})`;
}

/** SVG `points` for a shape of `size` px centred on (cx, cy); null for the circle. */
export function svgPointsFor(shape: MarkerShape, cx: number, cy: number, size: number): string | null {
  if (shape === 'circle') return null;

  return OUTLINES[shape]
    .map(([x, y]) => `${round(cx + (x - 0.5) * size)},${round(cy + (y - 0.5) * size)}`)
    .join(' ');
}

/** Adds a shape of `size` px centred on (cx, cy) to the current canvas path. */
export function traceShape(context: CanvasRenderingContext2D, shape: MarkerShape, cx: number, cy: number, size: number) {
  if (shape === 'circle') {
    context.moveTo(cx + size / 2, cy);
    context.arc(cx, cy, size / 2, 0, 2 * Math.PI);
    return;
  }

  OUTLINES[shape].forEach(([x, y], index) => {
    const px = cx + (x - 0.5) * size;
    const py = cy + (y - 0.5) * size;
    if (index === 0) context.moveTo(px, py); else context.lineTo(px, py);
  });
  context.closePath();
}
