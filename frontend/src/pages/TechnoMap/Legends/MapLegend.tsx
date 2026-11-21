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
 * What the map draws, in filter order: the nine drillhole types, the rig, the
 * deviation line and the hexagons. The site-feature icons label themselves
 * (name on hover, popup on click), so they have no row.
 */
const LEGEND_ENTRIES = FILTER_ENTRIES.filter(({ id }) => id !== 'site-features');
/** The same, before any Excel upload: no Hexagons row. */
const LEGEND_ENTRIES_NO_HEXAGONS = LEGEND_ENTRIES.filter(({ id }) => id !== 'hexagon');

export interface MapLegendProps {
  /** Hidden categories stay listed, faded. */
  filters?: MapFilters;
  /** Whether an uploaded Excel file has drawn hexagons; until then the Hexagons row is left out. */
  hasHexagons?: boolean;
}

// Anchored in the map's top-left corner: one category per row. Symbols use
// the same component as the Layers panel, and the same shapes and colours as
// the markers, so the legend cannot drift from the map. Informational only.
function MapLegend({ filters = ALL_VISIBLE, hasHexagons = false }: MapLegendProps) {
  return (
    <aside className="map-legend" aria-label="Map legend" style={LEGEND_STYLE}>
      <ul>
        {(hasHexagons ? LEGEND_ENTRIES : LEGEND_ENTRIES_NO_HEXAGONS).map(({ id, label }) => (
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
