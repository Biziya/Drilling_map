import { memo } from 'react';
import { outlineCentre, utmToMapRatio } from '../utils/coordinates';
import type { TechnoCell } from '../mock/mockData';

export interface TechnoCellsProps {
  cells: readonly TechnoCell[];
  /** Rendered (unzoomed) map size in CSS pixels. */
  mapWidth: number;
  mapHeight: number;
}

/**
 * Technological cell outlines and labels, inside the zoomed canvas so they
 * stay attached to the map. Lines and labels cancel the zoom (TechnoMap.css).
 */
function TechnoCells({ cells, mapWidth, mapHeight }: TechnoCellsProps) {
  if (!mapWidth || !mapHeight || cells.length === 0) return null;

  return (
    <>
      <svg className="tech-cell-layer" width={mapWidth} height={mapHeight} aria-hidden="true">
        {cells.map((cell) => (
          <polygon
            key={cell.id}
            points={cell.vertices.map((vertex) => {
              const { x, y } = utmToMapRatio(vertex);

              return `${x * mapWidth},${y * mapHeight}`;
            }).join(' ')}
          />
        ))}
      </svg>
      {cells.map((cell) => {
        const { x, y } = utmToMapRatio(outlineCentre(cell.vertices));

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
