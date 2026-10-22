import { MAP_CONFIG } from '../config/technoMapConfig';
import { computeCoordinateGrid } from '../utils/coordinateGrid';
import type { MapTransform, Point, Size } from '../../../types/map';

export interface CoordinateGridProps {
  viewport: Size;
  view: MapTransform;
  mapOrigin: Point;
  /** Rendered map size, or null before the base map has been measured. */
  mapSize: Size | null;
}

/**
 * The white grid base map, drawn under the map canvas in viewport pixels so
 * lines and labels stay crisp and the same size at any zoom. It never takes
 * the pointer: pan, zoom and measurement act on the viewport as before.
 */
function CoordinateGrid({ viewport, view, mapOrigin, mapSize }: CoordinateGridProps) {
  const style = MAP_CONFIG.baseMap.whiteGrid;
  const grid = mapSize && computeCoordinateGrid({
    viewport,
    view,
    mapOrigin,
    mapSize,
    minLineSpacing: style.minLineSpacing,
    labelFontSize: style.labelFontSize,
  });
  if (!grid) return null;

  const { sheet, lines, labels } = grid;

  return (
    <svg className="coordinate-grid" aria-hidden="true" data-step={grid.step}>
      <rect x={sheet.left} y={sheet.top} width={sheet.right - sheet.left} height={sheet.bottom - sheet.top} fill={style.background} />
      <g stroke={style.lineColor} strokeWidth={style.lineWidth} shapeRendering="crispEdges">
        {lines.map((line, index) => <line key={index} {...line} />)}
      </g>
      <g
        fill={style.labelColor}
        fontSize={style.labelFontSize}
        stroke={style.background}
        strokeWidth={3}
        paintOrder="stroke"
      >
        {labels.map(({ text, x, y }) => <text key={text} x={x} y={y}>{text}</text>)}
      </g>
    </svg>
  );
}

export default CoordinateGrid;
