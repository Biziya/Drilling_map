import MarkerSymbol from './MarkerSymbol';
import { LegendRow, LegendSection, MapLegend as LegendCard } from '../../../components/MapLegend/MapLegend';
import { MAP_CONFIG, layerForKind } from '../config/drillMapConfig';
import type { MapFilters } from '../hooks/useMapFilters';
import { markerShapeFor } from '../utils/markerKind';

export interface MapLegendProps {
  /** The Layers panel choices: hidden symbols stay listed, faded. GT and Redox never hide. */
  filters?: MapFilters;
}

// The shared legend card (components/MapLegend), as on the Techno Map, with
// this map's four sections. Symbols use the same component as the markers, so
// the legend cannot drift away from what is drawn on the map.
function MapLegend({ filters }: MapLegendProps) {
  return (
    <LegendCard>
      <LegendSection title="GT @75 ppm" className="map-legend__gt">
        {MAP_CONFIG.gtRanges.map((range) => (
          <LegendRow key={range.label} symbol={<i className="legend-dot" style={{ background: range.color }} />} label={range.label} />
        ))}
      </LegendSection>

      {/* Redox is not returned by the API yet and colours no marker; the
          section documents the planned classification. */}
      <LegendSection title="Redox Status" className="map-legend__redox">
        {Object.entries(MAP_CONFIG.redox).map(([label, color]) => (
          <LegendRow key={label} symbol={<i className="legend-swatch" style={{ background: color }} />} label={label} />
        ))}
      </LegendSection>

      <LegendSection title="Drillhole Types" className="map-legend__symbols">
        {MAP_CONFIG.legendSymbols.map(({ kind, label }) => (
          <LegendRow
            key={kind}
            hidden={Boolean(filters && !filters[layerForKind(kind)])}
            symbol={kind === 'rig'
              ? <img className="legend-rig-icon legend-image" src={MAP_CONFIG.rigIconSrc} alt="" draggable="false" />
              : <MarkerSymbol shape={markerShapeFor(kind)} color={MAP_CONFIG.legendSymbolColor} small />}
            label={label}
          />
        ))}
      </LegendSection>

      <LegendSection title="Overlays" className="map-legend__features">
        <LegendRow
          hidden={Boolean(filters && !filters['deviation-line'])}
          symbol={<i className="layer-swatch-line" />}
          label={MAP_CONFIG.layers.find(({ id }) => id === 'deviation-line')?.label ?? 'Deviation line'}
        />
      </LegendSection>
    </LegendCard>
  );
}

export default MapLegend;
