import { memo, useState } from 'react';
import MarkerSymbol from '../Legends/MarkerSymbol';
import { LAYER_IDS, MAP_CONFIG, OVERLAY_LAYER_IDS, SITE_FEATURE_LAYERS } from '../config/drillMapConfig';
import { siteFeatureIconSrc } from '../../../services/siteFeatures/siteFeatures';
import type { LayerId } from '../config/drillMapConfig';
import type { MapFilters } from '../hooks/useMapFilters';
import { markerShapeFor } from '../utils/markerKind';
import '../../../components/MapLegend/mapLegend.css';

export interface LayerPanelProps {
  filters: MapFilters;
  onChange: (id: LayerId, visible: boolean) => void;
  onSetAll: (visible: boolean) => void;
}

/** The symbol drawn beside a layer: its marker, the rig or site icon, or a red line. */
function LayerSymbol({ id }: { id: LayerId }) {
  let symbol;
  const site = SITE_FEATURE_LAYERS.find((layer) => layer.id === id);
  if (id === 'rig') symbol = <img className="legend-rig-icon legend-image" src={MAP_CONFIG.rigIconSrc} alt="" draggable="false" />;
  else if (id === 'deviation-line') symbol = <i className="layer-swatch-line" />;
  else if (site) symbol = <img className="legend-image" src={siteFeatureIconSrc(site.siteFeatureType)} alt="" draggable="false" />;
  else symbol = <MarkerSymbol shape={markerShapeFor(id as 'producer' | 'drillhole')} color={MAP_CONFIG.legendSymbolColor} small />;

  return <span className="legend-symbol" aria-hidden="true">{symbol}</span>;
}

/**
 * The "Layers" panel in the map's top-right corner, as on the Techno Map:
 * a checkbox per hideable layer in two groups (Drillhole Types, Overlays), named as on the Techno Map,
 * Show All / Hide All, and a collapse toggle. GT and Redox are a key only
 * (the legend card under the panel), never hidden.
 */
function LayerPanel({ filters, onChange, onSetAll }: LayerPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const enabled = LAYER_IDS.filter((id) => filters[id]).length;
  const group = (title: string, entries: readonly { id: LayerId; label: string }[]) => (
    <fieldset className="map-layers__group">
      <legend>{title}</legend>
      {entries.map(({ id, label }) => (
        <div key={id}>
          <label className="map-layers__item">
            <input type="checkbox" checked={filters[id]} onChange={(event) => onChange(id, event.target.checked)} />
            <LayerSymbol id={id} />
            <span className="map-layers__label">{label}</span>
          </label>
        </div>
      ))}
    </fieldset>
  );

  return (
    <aside className={`map-layers${isExpanded ? '' : ' is-collapsed'}`} aria-label="Layers">
      <button
        className="map-layers__header"
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
        title={isExpanded ? 'Collapse Layers' : 'Expand Layers'}
      >
        <span className="map-layers__title">Layers</span>
        <span className="map-layers__count" aria-label={`${enabled} of ${LAYER_IDS.length} layers shown`}>
          {enabled}/{LAYER_IDS.length}
        </span>
        <svg className="map-layers__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isExpanded && (
        <div className="map-layers__body">
          {group('Drillhole Types', MAP_CONFIG.layers.filter(({ id }) => !OVERLAY_LAYER_IDS.includes(id)))}
          {group('Overlays', MAP_CONFIG.layers.filter(({ id }) => OVERLAY_LAYER_IDS.includes(id)))}
          <div className="map-layers__footer">
            <button type="button" onClick={() => onSetAll(true)}>Show All</button>
            <button type="button" onClick={() => onSetAll(false)}>Hide All</button>
          </div>
        </div>
      )}
    </aside>
  );
}

export default memo(LayerPanel);
