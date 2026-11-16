import { memo } from 'react';
import MarkerSymbol from '../Legends/MarkerSymbol';
import { MAP_CONFIG, getGtRange } from '../config/drillMapConfig';
import { markerShapeFor } from '../utils/markerKind';
import type { MarkerKind } from '../utils/markerKind';
import { readDrillholeText, readDrillholeValue } from '../../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../../types/drillhole';

export interface DrillholeMarkerProps {
  /** The hole's selection key. */
  featureKey: string;
  drillhole: DrillholeApiRecord;
  kind: MarkerKind;
  /** Accessible role name for this kind, e.g. "Producer drillhole". */
  roleLabel: string;
  /** In the area/Ctrl+click selection: ringed. */
  isSelected?: boolean;
  /** Its tooltip is pinned open. */
  isPinned?: boolean;
  /** The pointer is over it (or left it: null). */
  onHover?: (key: string | null) => void;
  /** A click: pins its tooltip, or with Ctrl/Cmd adds it to the selection. */
  onActivate?: (key: string, additive: boolean) => void;
}

/**
 * One clickable marker: the rig icon OR a GT-coloured shape, never both.
 * Its details show in the page's one floating tooltip (components/MapTooltip),
 * as on the Techno Map: on hover, or pinned by a click.
 */
function DrillholeMarker({ featureKey, drillhole, kind, roleLabel, isSelected = false, isPinned = false, onHover, onActivate }: DrillholeMarkerProps) {
  const holeId = readDrillholeText(drillhole, 'holeId') ?? 'unidentified hole';
  const campaign = readDrillholeText(drillhole, 'campaign') ?? 'campaign unavailable';
  const state = `${isSelected ? ' is-selected' : ''}${isPinned ? ' is-pinned' : ''}`;

  return (
    <button
      className={`drillhole-marker drillhole-marker--${kind}${state}`}
      type="button"
      aria-label={`${roleLabel} ${holeId}, ${campaign}`}
      aria-expanded={isPinned}
      data-key={featureKey}
      onPointerEnter={() => onHover?.(featureKey)}
      onPointerLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(featureKey)}
      onBlur={() => onHover?.(null)}
      onClick={(event) => {
        event.stopPropagation();
        onActivate?.(featureKey, event.ctrlKey || event.metaKey);
      }}
    >
      {kind === 'rig' ? (
        <img className="rig-marker-icon" src={MAP_CONFIG.rigIconSrc} alt="" draggable="false" />
      ) : (
        <MarkerSymbol
          shape={markerShapeFor(kind)}
          color={getGtRange(readDrillholeValue(drillhole, 'gt'))?.color ?? MAP_CONFIG.uniformMarkerColor}
        />
      )}
    </button>
  );
}

export default memo(DrillholeMarker);
