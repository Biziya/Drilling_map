import { memo } from 'react';
import { utmToMapRatio } from '../utils/coordinates';
import { mapRatioToViewport } from '../utils/geometry';
import type { HexCell } from '../utils/hexagons';
import type { MapBounds, MapTransform, Point, Size } from '../../../types/map';

export interface HexagonOverlayProps {
  cells: readonly HexCell[];
  view: MapTransform;
  mapOrigin: Point;
  /** Rendered map size, or null before the base map has loaded. */
  mapSize: Size | null;
  bounds?: MapBounds;
}

/**
 * The uploaded production-cell outlines, drawn in viewport pixels under the
 * marker canvas so lines stay crisp at any zoom and wells stay on top.
 */
function HexagonOverlay({ cells, view, mapOrigin, mapSize, bounds }: HexagonOverlayProps) {
  if (!mapSize || !cells.length) return null;

  return (
    <svg className="hexagon-layer" aria-hidden="true" data-cells={cells.length}>
      {cells.map((cell) => (
        <polygon
          key={cell.id}
          points={cell.points.map((point) => {
            const at = mapRatioToViewport(utmToMapRatio(point, bounds), view, mapOrigin, mapSize);

            return `${at.x.toFixed(1)},${at.y.toFixed(1)}`;
          }).join(' ')}
        />
      ))}
    </svg>
  );
}

export default memo(HexagonOverlay);
