import MarkerSymbol from './MarkerSymbol';
import { MAP_CONFIG, layerForKind } from '../config/drillMapConfig';
import type { MapFilters } from '../hooks/useMapFilters';
import { markerShapeFor } from '../utils/markerKind';
import type { StyleWithCssVariables } from '../../../types/map';

const { legend } = MAP_CONFIG;
const px = (value: number) => `${value}px`;

/** The YAML legend dimensions, as the CSS variables the legend styles read. */
const LEGEND_STYLE: StyleWithCssVariables = {
  '--legend-padding-block': px(legend.paddingBlock),
  '--legend-padding-inline': px(legend.paddingInline),
  '--legend-column-gap': px(legend.columnGap),
  '--legend-row-gap': px(legend.rowGap),
  '--legend-title-gap': px(legend.titleGap),
  '--legend-title-size': px(legend.titleFontSize),
  '--legend-label-size': px(legend.labelFontSize),
  '--legend-label-gap': px(legend.labelGap),
  '--legend-symbol-size': px(legend.symbolSize),
  '--legend-rig-scale': legend.symbols.rigIconScale,
  '--legend-gt-rows': Math.ceil(MAP_CONFIG.gtRanges.length / legend.gt.columns),
  '--legend-gt-row-gap': px(legend.gt.rowGap),
  '--legend-gt-column-gap': px(legend.gt.columnGap),
  '--legend-redox-row-gap': px(legend.redox.rowGap),
  '--legend-symbol-row-gap': px(legend.symbols.rowGap),
};

export interface MapLegendProps {
  /** The Layers panel choices: hidden symbols stay listed, faded. GT and Redox never hide. */
  filters?: MapFilters;
}

// Anchored in the map's top-left corner, one section per row. Symbols use
// the same component as the markers, so the legend cannot drift away from
// what is drawn on the map.
function MapLegend({ filters }: MapLegendProps) {
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
        <h2>Drillhole Types</h2>
        <ul>
          {MAP_CONFIG.legendSymbols.map(({ kind, label }) => (
            <li key={kind} className={filters && !filters[layerForKind(kind)] ? 'is-hidden' : undefined}>
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

      <section className="map-legend__features">
        <h2>Overlays</h2>
        <ul>
          <li className={filters && !filters['deviation-line'] ? 'is-hidden' : undefined}>
            <span className="legend-symbol"><i className="layer-swatch-line" /></span>
            <span>{MAP_CONFIG.layers.find(({ id }) => id === 'deviation-line')?.label ?? 'Deviation line'}</span>
          </li>
        </ul>
      </section>
    </aside>
  );
}

export default MapLegend;
