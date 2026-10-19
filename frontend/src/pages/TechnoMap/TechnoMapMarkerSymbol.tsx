import { classNames } from './classNames';
import type { MarkerSymbolConfig, StyleWithCssVariables } from '../../types/map';

export interface TechnoMapMarkerSymbolProps {
  config: MarkerSymbolConfig;
  /** Renders the reduced size used by the legend swatches. */
  small?: boolean;
}

// `small` is opt-in and appends nothing when false, so the class list for a
// map marker stays exactly `techno-marker-symbol techno-marker-symbol--<shape>`.
function TechnoMapMarkerSymbol({ config, small = false }: TechnoMapMarkerSymbolProps) {
  const style: StyleWithCssVariables = { '--techno-status-color': config.color };

  return (
    <span
      className={classNames(
        'techno-marker-symbol',
        `techno-marker-symbol--${config.shape}`,
        small && 'techno-marker-symbol--small',
      )}
      style={style}
      aria-hidden="true"
    />
  );
}

export default TechnoMapMarkerSymbol;
