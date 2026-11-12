import type { Point, Size } from '../../types/map';

/** A dragged rectangle in viewport CSS pixels. */
export interface CaptureRect extends Point, Size {}

/** The rectangle between two corners of a drag, whichever way it was dragged. */
export function selectionRect(a: Point, b: Point): CaptureRect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}
