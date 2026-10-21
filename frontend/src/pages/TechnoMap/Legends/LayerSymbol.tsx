import MarkerSymbol from './MarkerSymbol';
import { DRILLHOLE_TYPE_CONFIG, MAP_CONFIG } from '../config/technoMapConfig';
import type { FilterId } from '../config/technoMapConfig';

/** The swatch for one filter, shared by the legend and the filter panel. */
function LayerSymbol({ id }: { id: FilterId }) {
  let symbol;
  if (id === 'drilling-in-progress') {
    symbol = <img className="legend-rig-icon" src={MAP_CONFIG.rigIconSrc} alt="" draggable="false" />;
  } else if (id === 'technological-cells') {
    symbol = <i className="layer-swatch-cell" />;
  } else if (id === 'deviation-line') {
    symbol = <i className="layer-swatch-line" />;
  } else {
    const { shape, color } = DRILLHOLE_TYPE_CONFIG[id];
    symbol = <MarkerSymbol shape={shape} color={color} small />;
  }

  return <span className="legend-symbol" aria-hidden="true">{symbol}</span>;
}

export default LayerSymbol;
