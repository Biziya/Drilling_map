import { memo } from 'react';
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
  '--legend-row-gap': px(legend.rowGap),
  '--legend-label-size': px(legend.labelFontSize),
  '--legend-label-gap': px(legend.labelGap),
  '--legend-symbol-size': px(legend.symbolSize),
  '--legend-rig-scale': legend.symbols.rigIconScale,
  '--legend-line-thickness': px(legend.symbols.lineThickness),
};

/**
 * What the map draws, in filter order: the nine drillhole types, the rig and
 * the deviation line. Technological cells have no source yet and stay only in
 * the Legends panel.
 */
const LEGEND_ENTRIES = FILTER_ENTRIES.filter(({ id }) => id !== 'technological-cells');

export interface MapLegendProps {
  /** Hidden categories stay listed, faded. */
  filters?: MapFilters;
}

// Anchored in the map's top-left corner: one category per row. Symbols use
// the same component as the Legends panel, and the same shapes and colours as
// the markers, so the legend cannot drift from the map. Informational only.
function MapLegend({ filters = ALL_VISIBLE }: MapLegendProps) {
  return (
    <aside className="map-legend" aria-label="Map legend" style={LEGEND_STYLE}>
      <ul>
        {LEGEND_ENTRIES.map(({ id, label }) => (
          <li key={id} className={filters[id] ? undefined : 'is-hidden'}>
            <LayerSymbol id={id} />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default memo(MapLegend);
