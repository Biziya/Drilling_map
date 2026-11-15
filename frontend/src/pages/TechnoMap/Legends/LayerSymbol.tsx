import MarkerSymbol from './MarkerSymbol';
import { DRILLHOLE_TYPE_CONFIG, MAP_CONFIG } from '../config/technoMapConfig';
import type { FilterId } from '../config/technoMapConfig';

/** The swatch for one filter, shared by the legend and the filter panel. */
function LayerSymbol({ id }: { id: FilterId }) {
  let symbol;
  if (id === 'drilling-in-progress') {
    symbol = <img className="legend-rig-icon" src={MAP_CONFIG.rigIconSrc} alt="" draggable="false" />;
  } else if (id === 'deviation-line') {
    symbol = <i className="layer-swatch-line" />;
  } else if (id === 'hexagon') {
    // A flat-topped hexagon outline, in the colour drawn on the map.
    symbol = (
      <svg className="layer-swatch-hexagon" viewBox="0 0 24 22">
        <polygon points="6.5,2 17.5,2 23,11 17.5,20 6.5,20 1,11" fill="none" stroke={MAP_CONFIG.hexagon.color} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  } else {
    const { shape, color } = DRILLHOLE_TYPE_CONFIG[id];
    symbol = <MarkerSymbol shape={shape} color={color} small />;
  }

  return <span className="legend-symbol" aria-hidden="true">{symbol}</span>;
}

export default LayerSymbol;
