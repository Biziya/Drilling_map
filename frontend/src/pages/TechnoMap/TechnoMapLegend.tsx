import TechnoMapMarkerSymbol from './TechnoMapMarkerSymbol';
import { TECHNO_MARKER_KIND, markerShapeFor } from './technoMarkerKind';
import type { TechnoMarkerKind } from './technoMarkerKind';
import {
  TECHNO_GT_RANGES,
  TECHNO_LEGEND_SYMBOL_COLOR,
  TECHNO_REDOX_CONFIG,
  TECHNO_RIG_ICON_SRC,
} from './technoMapConfig';

// Previously imported as a namespace with `?? fallback` on every value, to
// guard against an export going missing. The compiler now guarantees each of
// these exists, so the named imports say what is actually used and a removed
// export becomes a build error instead of a silently empty legend.

interface DrillholeTypeSymbolProps {
  kind: TechnoMarkerKind;
}

interface DrillholeTypeEntry {
  kind: TechnoMarkerKind;
  label: string;
}

// Drawn with the same symbol component the markers use, so the legend cannot
// drift away from what is actually on the map.
const DRILLHOLE_TYPES: readonly DrillholeTypeEntry[] = [
  { kind: TECHNO_MARKER_KIND.injector, label: 'Injector' },
  { kind: TECHNO_MARKER_KIND.producer, label: 'Producer' },
  { kind: TECHNO_MARKER_KIND.rig, label: 'Drill Rig' },
];

function DrillholeTypeSymbol({ kind }: DrillholeTypeSymbolProps) {
  if (kind === TECHNO_MARKER_KIND.rig) {
    return (
      <img
        className="techno-legend-rig-icon"
        src={TECHNO_RIG_ICON_SRC}
        alt=""
        draggable="false"
      />
    );
  }

  return (
    <TechnoMapMarkerSymbol
      config={{ shape: markerShapeFor(kind), color: TECHNO_LEGEND_SYMBOL_COLOR }}
      small
    />
  );
}

function TechnoMapLegend() {
  return (
    <aside className="techno-map-legend" aria-label="Map legend">
      <section>
        <h2>GT @75 ppm</h2>
        <ul>
          {TECHNO_GT_RANGES.map((range) => (
            <li key={range.label}>
              <i className="techno-legend-dot" style={{ background: range.color }} />
              <span>{range.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Redox Status</h2>
        <ul>
          {Object.entries(TECHNO_REDOX_CONFIG).map(([label, color]) => (
            <li key={label}>
              <i className="techno-legend-swatch" style={{ background: color }} />
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
              <span className="techno-legend-symbol">
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

export default TechnoMapLegend;
