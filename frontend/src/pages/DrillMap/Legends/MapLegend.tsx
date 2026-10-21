import MarkerSymbol from './MarkerSymbol';
import { MAP_CONFIG } from '../config/drillMapConfig';
import { markerShapeFor } from '../utils/markerKind';
import type { StyleWithCssVariables } from '../../../types/map';

const { legend } = MAP_CONFIG;
const px = (value: number) => `${value}px`;

/** The YAML legend dimensions, as the CSS variables the legend styles read. */
const LEGEND_STYLE: StyleWithCssVariables = {
  '--legend-padding-block': px(legend.paddingBlock),
  '--legend-padding-inline': px(legend.paddingInline),
  '--legend-min-height': px(legend.minHeight),
  '--legend-column-gap': px(legend.columnGap),
  '--legend-row-gap': px(legend.rowGap),
  '--legend-title-gap': px(legend.titleGap),
  '--legend-title-size': px(legend.titleFontSize),
  '--legend-label-size': px(legend.labelFontSize),
  '--legend-label-gap': px(legend.labelGap),
  '--legend-symbol-size': px(legend.symbolSize),
  '--legend-rig-scale': legend.symbols.rigIconScale,
  '--legend-gt-row-gap': px(legend.gt.rowGap),
  '--legend-redox-row-gap': px(legend.redox.rowGap),
  '--legend-symbol-row-gap': px(legend.symbols.rowGap),
};

// Symbols use the same component as the markers, so the legend cannot drift
// away from what is drawn on the map.
function MapLegend() {
  return (
    <aside className="map-legend" aria-label="Map legend" style={LEGEND_STYLE}>
      <section>
        <h2>GT @75 ppm</h2>
        <ul className="map-legend__gt">
          {MAP_CONFIG.gtRanges.map((range) => (
            <li key={range.label}>
              <span className="legend-symbol"><i className="legend-dot" style={{ background: range.color }} /></span>
              <span>{range.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Redox is not returned by the API yet and colours no marker; the
          section documents the planned classification. */}
      <section>
        <h2>Redox Status</h2>
        <ul className="map-legend__redox">
          {Object.entries(MAP_CONFIG.redox).map(([label, color]) => (
            <li key={label}>
              <span className="legend-symbol"><i className="legend-swatch" style={{ background: color }} /></span>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="map-legend__symbols">
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
