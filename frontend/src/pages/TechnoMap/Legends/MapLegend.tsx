import LayerSymbol from './LayerSymbol';
import { FILTER_ENTRIES, MAP_CONFIG } from '../config/technoMapConfig';
import { ALL_VISIBLE } from '../utils/mapFilters';
import type { MapFilters } from '../utils/mapFilters';

export interface MapLegendProps {
  /** Hidden categories stay listed, faded. */
  filters?: MapFilters;
}

// Symbols use the same component as the filter panel, and the same shapes and
// colours as the markers, so the legend cannot drift from the map.
function MapLegend({ filters = ALL_VISIBLE }: MapLegendProps) {
  return (
    <aside className="map-legend" aria-label="Map legend">
      <section>
        <h2>GT @75 ppm</h2>
        <ul>
          {MAP_CONFIG.gtRanges.map((range) => (
            <li key={range.label}>
              <i className="legend-dot" style={{ background: range.color }} />
              <span>{range.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Redox is not returned by the API yet and colours no marker; the
          section documents the planned classification. */}
      <section>
        <h2>Redox Status</h2>
        <ul>
          {Object.entries(MAP_CONFIG.redox).map(([label, color]) => (
            <li key={label}>
              <i className="legend-swatch" style={{ background: color }} />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="map-legend__symbols">
        <h2>Symbol</h2>
        <ul>
          {FILTER_ENTRIES.map(({ id, label }) => (
            <li key={id} className={filters[id] ? undefined : 'is-hidden'}>
              <LayerSymbol id={id} />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

export default MapLegend;
