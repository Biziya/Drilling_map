import type { Point, UtmCoordinates } from '../types/map';

/** Something a measurement point can snap to: where it is drawn, how far its symbol reaches, and its true position. */
export interface SnapTarget {
  /** Centre in viewport px. */
  at: Point;
  /** Reach of its symbol around `at`, in px. */
  radius: number;
  utm: UtmCoordinates;
}

/**
 * The position of the target under `point`, or null when there is none.
 * Groups are tried in order (top map layer first), so a site icon drawn over a
 * hole wins; within a group the nearest centre wins.
 */
export function snapPoint(point: Point, groups: readonly (readonly SnapTarget[])[]): UtmCoordinates | null {
  for (const targets of groups) {
    let best: SnapTarget | null = null;
    let bestDistance = Infinity;
    for (const target of targets) {
      const distance = Math.hypot(point.x - target.at.x, point.y - target.at.y);
      if (distance <= target.radius && distance < bestDistance) {
        best = target;
        bestDistance = distance;
      }
    }
    if (best) return best.utm;
  }

  return null;
}
