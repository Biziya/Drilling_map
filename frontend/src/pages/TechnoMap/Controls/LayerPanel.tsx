import { memo, useState } from 'react';
import LayerSymbol from '../Legends/LayerSymbol';
import { DRILLHOLE_TYPE_CONFIG, FILTER_IDS, MAP_CONFIG } from '../config/technoMapConfig';
import type { FilterId } from '../config/technoMapConfig';
import type { MapFilters } from '../utils/mapFilters';

export interface LayerPanelProps {
  filters: MapFilters;
  onChange: (id: FilterId, visible: boolean) => void;
  onSetAll: (visible: boolean) => void;
  /** Whether an uploaded Excel file has drawn hexagons; until then the Hexagons row is left out. */
  hasHexagons?: boolean;
}

/**
 * A filter's label colour: a drillhole type's marker colour, the deviation
 * line or hexagon colour for those layers (all from technoMap.yaml), and
 * the panel's own text colour for Drilling in progress, whose symbol is the rig.
 */
function labelColor(id: FilterId): string | undefined {
  if (id === 'deviation-line') return MAP_CONFIG.deviationLine.color;
  if (id === 'hexagon') return MAP_CONFIG.hexagon.color;
  if (id === 'drilling-in-progress') return undefined;

  return DRILLHOLE_TYPE_CONFIG[id].color;
}

/**
 * Floating "Layers" panel in the map's top-right corner: every filter,
 * Show All / Hide All, and a collapse toggle. Opens expanded on every visit;
 * only the filter choices are remembered. The hexagon file itself is managed
 * from the toolbar Upload window, not here, and the Hexagons row only shows
 * once a file is loaded.
 */
function LayerPanel({ filters, onChange, onSetAll, hasHexagons = false }: LayerPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const shownIds = hasHexagons ? FILTER_IDS : FILTER_IDS.filter((id) => id !== 'hexagon');
  const overlays = hasHexagons ? MAP_CONFIG.mapFeatures : MAP_CONFIG.mapFeatures.filter(({ id }) => id !== 'hexagon');
  const enabled = shownIds.filter((id) => filters[id]).length;
  const group = (title: string, entries: readonly { id: FilterId; label: string }[]) => (
    <fieldset className="map-layers__group">
      <legend>{title}</legend>
      {entries.map(({ id, label }) => (
        <div key={id}>
          <label className="map-layers__item">
            <input type="checkbox" checked={filters[id]} onChange={(event) => onChange(id, event.target.checked)} />
            <LayerSymbol id={id} />
            <span className="map-layers__label" style={{ color: labelColor(id) }}>{label}</span>
          </label>
        </div>
      ))}
    </fieldset>
  );

  return (
    <aside className={`map-layers${isExpanded ? '' : ' is-collapsed'}`} aria-label="Layers">
      <button
        className="map-layers__header"
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
        title={isExpanded ? 'Collapse Layers' : 'Expand Layers'}
      >
        <span className="map-layers__title">Layers</span>
        <span className="map-layers__count" aria-label={`${enabled} of ${shownIds.length} layers shown`}>
          {enabled}/{shownIds.length}
        </span>
        <svg className="map-layers__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isExpanded && (
        <div className="map-layers__body">
          {group('Drillhole Types', MAP_CONFIG.drillholeTypes)}
          {group('Overlays', overlays)}
          <div className="map-layers__footer">
            <button type="button" onClick={() => onSetAll(true)}>Show All</button>
            <button type="button" onClick={() => onSetAll(false)}>Hide All</button>
          </div>
        </div>
      )}
    </aside>
  );
}

export default memo(LayerPanel);
