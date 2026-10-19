import { classNames } from './classNames';
import type { MarkerSymbolConfig, StyleWithCssVariables } from '../../types/map';

export interface MarkerSymbolProps {
  config: MarkerSymbolConfig;
  /** Renders the reduced size used by the legend swatches. */
  small?: boolean;
}

/**
 * The coloured shape drawn for a non-rig drillhole.
 *
 * The fill travels as a CSS custom property because the triangle paints it
 * through a ::before and the square through its background; the stylesheet
 * decides, this component only supplies the value.
 *
 * `small` is opt-in and appends nothing when false, so the class list for a
 * map marker stays exactly `marker-symbol marker-symbol--<shape>`.
 */
function MarkerSymbol({ config, small = false }: MarkerSymbolProps) {
  const style: StyleWithCssVariables = { '--status-color': config.color };

  return (
    <span
      className={classNames(
        'marker-symbol',
        `marker-symbol--${config.shape}`,
        small && 'marker-symbol--small',
      )}
      style={style}
      aria-hidden="true"
    />
  );
}

export default MarkerSymbol;
