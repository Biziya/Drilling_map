import { memo, useState } from 'react';
import LayerSymbol from '../Legends/LayerSymbol';
import { DRILLHOLE_TYPE_CONFIG, FILTER_IDS, MAP_CONFIG } from '../config/technoMapConfig';
import type { FilterId } from '../config/technoMapConfig';
import type { MapFilters } from '../utils/mapFilters';

export interface LayerPanelProps {
  filters: MapFilters;
  onChange: (id: FilterId, visible: boolean) => void;
  onSetAll: (visible: boolean) => void;
}

/**
 * A filter's label colour: a drillhole type's marker colour, the cell outline
 * and deviation line colours for those layers (all from technoMap.yaml), and
 * the panel's own text colour for Drilling in progress, whose symbol is the rig.
 */
function labelColor(id: FilterId): string | undefined {
  if (id === 'technological-cells') return MAP_CONFIG.technologicalCells.stroke;
  if (id === 'deviation-line') return MAP_CONFIG.deviationLine.color;
  if (id === 'drilling-in-progress') return undefined;

  return DRILLHOLE_TYPE_CONFIG[id].color;
}

/**
 * Floating "Legends" panel in the map's top-right corner: the 12 filters,
 * Show All / Hide All, and a collapse toggle. Opens expanded on every visit;
 * only the filter choices are remembered.
 */
function LayerPanel({ filters, onChange, onSetAll }: LayerPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const enabled = FILTER_IDS.filter((id) => filters[id]).length;

  const group = (title: string, entries: readonly { id: FilterId; label: string }[]) => (
    <fieldset className="map-layers__group">
      <legend>{title}</legend>
      {entries.map(({ id, label }) => (
        <label key={id} className="map-layers__item">
          <input type="checkbox" checked={filters[id]} onChange={(event) => onChange(id, event.target.checked)} />
          <LayerSymbol id={id} />
          <span className="map-layers__label" style={{ color: labelColor(id) }}>{label}</span>
        </label>
      ))}
    </fieldset>
  );

  return (
    <aside className={`map-layers${isExpanded ? '' : ' is-collapsed'}`} aria-label="Legends">
      <button
        className="map-layers__header"
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
        title={isExpanded ? 'Collapse Legends' : 'Expand Legends'}
      >
        <span className="map-layers__title">Legends</span>
        <span className="map-layers__count" aria-label={`${enabled} of ${FILTER_IDS.length} legends shown`}>
          {enabled}/{FILTER_IDS.length}
        </span>
        <svg className="map-layers__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isExpanded && (
        <div className="map-layers__body">
          {group('Drillhole Types', MAP_CONFIG.drillholeTypes)}
          {group('Map Features', MAP_CONFIG.mapFeatures)}
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
