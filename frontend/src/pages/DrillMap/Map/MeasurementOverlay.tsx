import { utmToMapRatio } from '../utils/coordinates';
import { mapRatioToViewport } from '../utils/geometry';
import { endpointCrossPath, formatDistance, measureDistance } from '../utils/measurement';
import type { MapTransform, Point, Size, UtmCoordinates } from '../../../types/map';

export interface MeasurementOverlayProps {
  /** Zero, one or two points, in UTM metres. */
  points: readonly UtmCoordinates[];
  view: MapTransform;
  mapOrigin: Point;
  /** Rendered map size, or null before the base map has loaded. */
  mapSize: Size | null;
}

/**
 * The measurement, drawn over the map in viewport pixels so its line and
 * markers stay crisp at any zoom. Points are kept in map units and re-placed
 * on every pan, zoom and resize.
 */
function MeasurementOverlay({ points, view, mapOrigin, mapSize }: MeasurementOverlayProps) {
  const [start, end] = points;
  if (!mapSize || !start) return null;

  const toViewport = (point: UtmCoordinates) => mapRatioToViewport(utmToMapRatio(point), view, mapOrigin, mapSize);
  const a = toViewport(start);
  const b = end && toViewport(end);

  return (
    <>
      <svg className="measurement-layer" aria-hidden="true">
        {b && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />}
        {(b ? [a, b] : [a]).map((point, index) => <path key={index} d={endpointCrossPath(point)} />)}
      </svg>
      {end && b && (
        <span className="measurement-label" style={{ left: (a.x + b.x) / 2, top: (a.y + b.y) / 2 }} role="status">
          {formatDistance(measureDistance(start, end))}
        </span>
      )}
    </>
  );
}

export default MeasurementOverlay;
