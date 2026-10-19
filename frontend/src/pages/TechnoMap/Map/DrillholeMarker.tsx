import { memo, useState } from 'react';
import MarkerSymbol from '../Legends/MarkerSymbol';
import DrillholeTooltip from '../Tooltips/DrillholeTooltip';
import { MAP_CONFIG, getGtRange } from '../config/technoMapConfig';
import { markerShapeFor } from '../utils/markerKind';
import type { MarkerKind } from '../utils/markerKind';
import { readDrillholeText, readDrillholeValue } from '../../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../../types/drillhole';

export interface DrillholeMarkerProps {
  drillhole: DrillholeApiRecord;
  kind: MarkerKind;
  /** Accessible role name for this kind, e.g. "Producer drillhole". */
  roleLabel: string;
}

/**
 * One clickable marker: the rig icon OR a GT-coloured shape, never both,
 * plus its tooltip. Clicking toggles the tooltip; blurring closes it.
 */
function DrillholeMarker({ drillhole, kind, roleLabel }: DrillholeMarkerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const holeId = readDrillholeText(drillhole, 'holeId') ?? 'unidentified hole';
  const campaign = readDrillholeText(drillhole, 'campaign') ?? 'campaign unavailable';

  return (
    <button
      className={`drillhole-marker drillhole-marker--${kind}${isOpen ? ' is-open' : ''}`}
      type="button"
      aria-label={`${roleLabel} ${holeId}, ${campaign}`}
      aria-expanded={isOpen}
      onClick={(event) => {
        event.stopPropagation();
        setIsOpen((current) => !current);
      }}
      onBlur={() => setIsOpen(false)}
    >
      {kind === 'rig' ? (
        <img className="rig-marker-icon" src={MAP_CONFIG.rigIconSrc} alt="" draggable="false" />
      ) : (
        <MarkerSymbol
          shape={markerShapeFor(kind)}
          color={getGtRange(readDrillholeValue(drillhole, 'gt'))?.color ?? MAP_CONFIG.uniformMarkerColor}
        />
      )}
      <DrillholeTooltip drillhole={drillhole} />
    </button>
  );
}

export default memo(DrillholeMarker);
