import MarkerSymbol from './MarkerSymbol';
import { siteFeatureIconSrc } from '../../../services/siteFeatures/siteFeatures';
import { DRILLHOLE_TYPE_CONFIG, MAP_CONFIG, SITE_FEATURE_LAYERS } from '../config/technoMapConfig';
import type { FilterId } from '../config/technoMapConfig';

/**
 * The symbol for one filter, shared by the legend and the filter panel. The
 * caller centres it in the shared `.legend-symbol` square (components/MapLegend).
 */
function LayerSymbol({ id }: { id: FilterId }) {
  if (id === 'drilling-in-progress') {
    return <img className="legend-rig-icon legend-image" src={MAP_CONFIG.rigIconSrc} alt="" draggable="false" />;
  }
  if (id === 'deviation-line') return <i className="layer-swatch-line" />;
  if (id === 'hexagon') {
    // A flat-topped hexagon outline, in the colour drawn on the map.
    return (
      <svg className="layer-swatch-hexagon" viewBox="0 0 24 22">
        <polygon points="6.5,2 17.5,2 23,11 17.5,20 6.5,20 1,11" fill="none" stroke={MAP_CONFIG.hexagon.color} strokeWidth="2" strokeLinejoin="round" />
      </svg>
    );
  }

  const site = SITE_FEATURE_LAYERS.find((layer) => layer.id === id);
  if (site) return <img className="legend-image" src={siteFeatureIconSrc(site.siteFeatureType)} alt="" draggable="false" />;

  const { shape, color } = DRILLHOLE_TYPE_CONFIG[id as keyof typeof DRILLHOLE_TYPE_CONFIG];
  return <MarkerSymbol shape={shape} color={color} small />;
}

export default LayerSymbol;
