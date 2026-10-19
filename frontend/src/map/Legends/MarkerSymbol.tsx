import type { MarkerShape, StyleWithCssVariables } from '../../types/map';

export interface MarkerSymbolProps {
  shape: MarkerShape;
  color: string;
  /** Reduced size used by the legend swatches. */
  small?: boolean;
}

/**
 * The coloured shape drawn for a non-rig drillhole, on the map and in the
 * legend. The fill travels as `--status-color`: the square paints it as its
 * background, the triangle through a ::before (see map.css).
 */
function MarkerSymbol({ shape, color, small = false }: MarkerSymbolProps) {
  const style: StyleWithCssVariables = { '--status-color': color };

  return (
    <span
      className={`marker-symbol marker-symbol--${shape}${small ? ' marker-symbol--small' : ''}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export default MarkerSymbol;
