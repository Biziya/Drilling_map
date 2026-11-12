import { memo } from 'react';
import { outlineCentre, utmToMapRatio } from '../utils/coordinates';
import type { TechnoCell } from '../mock/mockData';
import type { MapBounds } from '../../../types/map';

export interface TechnoCellsProps {
  cells: readonly TechnoCell[];
  /** Rendered (unzoomed) map size in CSS pixels. */
  mapWidth: number;
  mapHeight: number;
  /** UTM corners of the image the map is laid out on; the default base map's when left out. */
  bounds?: MapBounds;
}

/**
 * Technological cell outlines and labels, inside the zoomed canvas so they
 * stay attached to the map. Lines and labels cancel the zoom (TechnoMap.css).
 */
function TechnoCells({ cells, mapWidth, mapHeight, bounds }: TechnoCellsProps) {
  if (!mapWidth || !mapHeight || cells.length === 0) return null;

  return (
    <>
      <svg className="tech-cell-layer" width={mapWidth} height={mapHeight} aria-hidden="true">
        {cells.map((cell) => (
          <polygon
            key={cell.id}
            points={cell.vertices.map((vertex) => {
              const { x, y } = utmToMapRatio(vertex, bounds);

              return `${x * mapWidth},${y * mapHeight}`;
            }).join(' ')}
          />
        ))}
      </svg>
      {cells.map((cell) => {
        const { x, y } = utmToMapRatio(outlineCentre(cell.vertices), bounds);

        return (
          <span key={cell.id} className="tech-cell-label" style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>
            {cell.label}
          </span>
        );
      })}
    </>
  );
}

export default memo(TechnoCells);
