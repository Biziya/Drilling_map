import MarkerSymbol from './MarkerSymbol';
import { MARKER_KIND, markerShapeFor } from './drillholeMarkerKind';
import type { MarkerKind } from './drillholeMarkerKind';
import {
  GT_RANGES,
  LEGEND_SYMBOL_COLOR,
  REDOX_CONFIG,
  RIG_ICON_SRC,
} from './drillMapConfig';

interface DrillholeTypeSymbolProps {
  kind: MarkerKind;
}

interface DrillholeTypeEntry {
  kind: MarkerKind;
  label: string;
}

// Drawn with the same symbol component the markers use, so the legend cannot
// drift away from what is actually on the map. The legend previously listed
// only the rig, leaving the producer triangle and the injector/drillhole
// square unexplained even though both are drawn.
// Only the producer differs in shape on this map; injector, sediment and
// develop holes all draw the same square, so listing them separately would
// show two identical swatches under different names.
const DRILLHOLE_TYPES: readonly DrillholeTypeEntry[] = [
  { kind: MARKER_KIND.producer, label: 'Producer' },
  { kind: MARKER_KIND.drillhole, label: 'Drillhole' },
  { kind: MARKER_KIND.rig, label: 'Drill Rig' },
];

function DrillholeTypeSymbol({ kind }: DrillholeTypeSymbolProps) {
  if (kind === MARKER_KIND.rig) {
    return (
      <img
        className="legend-rig-icon"
        src={RIG_ICON_SRC}
        alt=""
        draggable="false"
      />
    );
  }

  return (
    <MarkerSymbol
      config={{ shape: markerShapeFor(kind), color: LEGEND_SYMBOL_COLOR }}
      small
    />
  );
}

function MapLegend() {
  return (
    <aside className="map-legend" aria-label="Map legend">
      <section>
        <h2>GT @75 ppm</h2>
        <ul>
          {GT_RANGES.map((range) => (
            <li key={range.label}>
              <i className="legend-dot" style={{ background: range.color }} />
              <span>{range.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Redox is not yet returned by the API and no marker is coloured by it,
          so this section currently documents nothing on the map. Kept because
          removing it is a visible product change, not a migration fix. Delete
          this section and REDOX_CONFIG together once that call is made. */}
      <section>
        <h2>Redox Status</h2>
        <ul>
          {Object.entries(REDOX_CONFIG).map(([label, color]) => (
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
          {DRILLHOLE_TYPES.map(({ kind, label }) => (
            <li key={kind}>
              <span className="legend-symbol">
                <DrillholeTypeSymbol kind={kind} />
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
