import LayerSymbol from './LayerSymbol';
import { FILTER_ENTRIES, MAP_CONFIG } from '../config/technoMapConfig';
import { ALL_VISIBLE } from '../utils/mapFilters';
import type { MapFilters } from '../utils/mapFilters';
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
  '--legend-gt-width': px(legend.gt.width),
  '--legend-gt-height': px(legend.gt.height),
  '--legend-gt-row-gap': px(legend.gt.rowGap),
  '--legend-redox-width': px(legend.redox.width),
  '--legend-redox-height': px(legend.redox.height),
  '--legend-redox-row-gap': px(legend.redox.rowGap),
  '--legend-symbol-box-width': px(legend.symbols.boxWidth),
  '--legend-symbol-box-height': px(legend.symbols.boxHeight),
  '--legend-symbol-size': px(legend.symbols.size),
  '--legend-rig-size': px(legend.symbols.rigIconSize),
  '--legend-symbol-row-gap': px(legend.symbols.rowGap),
  '--legend-symbol-column-gap': px(legend.symbols.columnGap),
  '--legend-line-width': px(legend.symbols.lineWidth),
  '--legend-line-thickness': px(legend.symbols.lineThickness),
};

export interface MapLegendProps {
  /** Hidden categories stay listed, faded. */
  filters?: MapFilters;
}

// Symbols use the same component as the filter panel, and the same shapes and
// colours as the markers, so the legend cannot drift from the map.
function MapLegend({ filters = ALL_VISIBLE }: MapLegendProps) {
  return (
    <aside className="map-legend" aria-label="Map legend" style={LEGEND_STYLE}>
      <section>
        <h2>GT @75 ppm</h2>
        <ul className="map-legend__gt">
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
        <ul className="map-legend__redox">
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
