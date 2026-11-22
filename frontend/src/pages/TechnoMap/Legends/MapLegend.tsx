import { memo } from 'react';
import LayerSymbol from './LayerSymbol';
import { LegendRow, LegendSection, MapLegend as LegendCard } from '../../../components/MapLegend/MapLegend';
import { FILTER_ENTRIES, SITE_FEATURE_FILTER_IDS } from '../config/technoMapConfig';
import { ALL_VISIBLE } from '../utils/mapFilters';
import type { MapFilters } from '../utils/mapFilters';

/**
 * What the map draws, in filter order: the nine drillhole types, the rig, the
 * deviation line and the hexagons. The site-feature icons label themselves
 * (name on hover, popup on click), so they have no row.
 */
const LEGEND_ENTRIES = FILTER_ENTRIES.filter(({ id }) => !SITE_FEATURE_FILTER_IDS.includes(id));
/** The same, before any Excel upload: no Hexagons row. */
const LEGEND_ENTRIES_NO_HEXAGONS = LEGEND_ENTRIES.filter(({ id }) => id !== 'hexagon');

export interface MapLegendProps {
  /** Hidden categories stay listed, faded. */
  filters?: MapFilters;
  /** Whether an uploaded Excel file has drawn hexagons; until then the Hexagons row is left out. */
  hasHexagons?: boolean;
}

// The shared legend card (components/MapLegend): one untitled list, one
// category per row. Symbols use the same component as the Layers panel, and
// the same shapes and colours as the markers, so the legend cannot drift from
// the map.
function MapLegend({ filters = ALL_VISIBLE, hasHexagons = false }: MapLegendProps) {
  return (
    <LegendCard>
      <LegendSection>
        {(hasHexagons ? LEGEND_ENTRIES : LEGEND_ENTRIES_NO_HEXAGONS).map(({ id, label }) => (
          <LegendRow key={id} hidden={!filters[id]} symbol={<LayerSymbol id={id} />} label={label} />
        ))}
      </LegendSection>
    </LegendCard>
  );
}

export default memo(MapLegend);
