import { memo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import DrillholeTooltip from './DrillholeTooltip';
import MarkerSymbol from './MarkerSymbol';
import { RIG_ICON_SRC, getGtRange } from './drillMapConfig';
import {
  MARKER_KIND,
  isRigKind,
  markerShapeFor,
} from './drillholeMarkerKind';
import type { MarkerKind } from './drillholeMarkerKind';
import { readDrillholeText, readDrillholeValue } from '../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../types/drillhole';
import type { MarkerSymbolConfig } from '../../types/map';

/** Fill used when a hole has no usable GT reading to colour it by. */
const UNIFORM_MARKER_CONFIG: Readonly<MarkerSymbolConfig> = Object.freeze({
  color: '#000000',
  shape: 'square',
});

const MARKER_ROLE_LABEL: Record<MarkerKind, string> = {
  [MARKER_KIND.rig]: 'Rig',
  [MARKER_KIND.producer]: 'Producer drillhole',
  [MARKER_KIND.injector]: 'Injector drillhole',
  [MARKER_KIND.drillhole]: 'Drillhole',
};

/**
 * Accessible name for a marker.
 *
 * Resolves the hole id under any spelling and substitutes a phrase when it is
 * absent. Interpolating the field directly announced "Drillhole null" to a
 * screen reader whenever the id was missing.
 */
function buildMarkerLabel(
  markerKind: MarkerKind,
  drillhole: DrillholeApiRecord,
): string {
  const holeId = readDrillholeText(drillhole, 'holeId') ?? 'unidentified hole';
  const campaign = readDrillholeText(drillhole, 'campaign') ?? 'campaign unavailable';

  return `${MARKER_ROLE_LABEL[markerKind]} ${holeId}, ${campaign}`;
}

export interface DrillholeMarkerProps {
  drillhole: DrillholeApiRecord;
  /** Defaults to the plain drillhole square when the caller has no opinion. */
  markerKind?: MarkerKind;
}

function DrillholeMarker({
  drillhole,
  markerKind = MARKER_KIND.drillhole,
}: DrillholeMarkerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isRig = isRigKind(markerKind);
  const gtRange = isRig ? null : getGtRange(readDrillholeValue(drillhole, 'gt'));

  // Shape comes from HolePurpose, colour still from the GT band, so the
  // existing grade colouring is unchanged for both shapes.
  const markerConfig: MarkerSymbolConfig = {
    ...UNIFORM_MARKER_CONFIG,
    shape: markerShapeFor(markerKind),
    ...(gtRange ? { color: gtRange.color } : null),
  };

  return (
    <button
      className={`drillhole-marker drillhole-marker--${markerKind}${isOpen ? ' is-open' : ''}`}
      type="button"
      aria-label={buildMarkerLabel(markerKind, drillhole)}
      aria-expanded={isOpen}
      onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        setIsOpen((current) => !current);
      }}
      onBlur={() => setIsOpen(false)}
    >
      {/* Either the rig or the shape, never both. */}
      {isRig ? (
        <img className="rig-marker-icon" src={RIG_ICON_SRC} alt="" draggable="false" />
      ) : (
        <MarkerSymbol config={markerConfig} />
      )}
      <DrillholeTooltip drillhole={drillhole} />
    </button>
  );
}

export default memo(DrillholeMarker);
