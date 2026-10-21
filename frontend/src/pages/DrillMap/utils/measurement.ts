import type { Point, UtmCoordinates } from '../../../types/map';

/** Straight-line distance in metres. UTM eastings and northings are metres. */
export function measureDistance(a: UtmCoordinates, b: UtmCoordinates): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** "8.4 m", "412 m", "1.25 km": metres below 1 km, kilometres from there. */
export function formatDistance(metres: number): string {
  if (metres >= 1000) return `${(metres / 1000).toFixed(2)} km`;

  return `${metres.toFixed(metres < 100 ? 1 : 0)} m`;
}

/** SVG path of the X drawn at a measurement endpoint. */
export function endpointCrossPath({ x, y }: Point, radius = 6): string {
  return `M${x - radius} ${y - radius}L${x + radius} ${y + radius}M${x + radius} ${y - radius}L${x - radius} ${y + radius}`;
}

/** Next measurement after a click: a second point completes it, a third starts over. */
export function addMeasurementPoint(points: readonly UtmCoordinates[], point: UtmCoordinates): UtmCoordinates[] {
  const [first] = points;

  return first && points.length === 1 ? [first, point] : [point];
}
