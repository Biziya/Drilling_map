import type { MarkerShape } from '../config/technoMapConfig';
import { clipPathFor } from '../utils/markerShapes';
import type { StyleWithCssVariables } from '../../../types/map';

export interface MarkerSymbolProps {
  shape: MarkerShape;
  color: string;
  /** Reduced size used by the legend and filter swatches. */
  small?: boolean;
}

// Square and circle are bordered boxes; the triangle keeps its own rules; every
// other shape clips to its outline from utils/markerShapes (see TechnoMap.css).
const BOX_SHAPES: readonly MarkerShape[] = ['square', 'circle', 'triangle'];

/**
 * The coloured shape drawn for a non-rig drillhole, on the map, in the legend
 * and in the filter panel. The fill travels as `--status-color`.
 */
function MarkerSymbol({ shape, color, small = false }: MarkerSymbolProps) {
  const isPolygon = !BOX_SHAPES.includes(shape);
  const style: StyleWithCssVariables = { '--status-color': color };
  if (isPolygon) style['--marker-clip'] = clipPathFor(shape) ?? undefined;

  return (
    <span
      className={`marker-symbol marker-symbol--${shape}${isPolygon ? ' marker-symbol--polygon' : ''}${small ? ' marker-symbol--small' : ''}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export default MarkerSymbol;
