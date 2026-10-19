import MarkerSymbol from './MarkerSymbol';
import { MAP_CONFIG } from '../config/drillMapConfig';
import { markerShapeFor } from '../utils/markerKind';

// Symbols use the same component as the markers, so the legend cannot drift
// away from what is drawn on the map.
function MapLegend() {
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

      <section>
        <h2>Symbol</h2>
        <ul>
          {MAP_CONFIG.legendSymbols.map(({ kind, label }) => (
            <li key={kind}>
              <span className="legend-symbol">
                {kind === 'rig' ? (
                  <img className="legend-rig-icon" src={MAP_CONFIG.rigIconSrc} alt="" draggable="false" />
                ) : (
                  <MarkerSymbol shape={markerShapeFor(kind)} color={MAP_CONFIG.legendSymbolColor} small />
                )}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

export default MapLegend;
