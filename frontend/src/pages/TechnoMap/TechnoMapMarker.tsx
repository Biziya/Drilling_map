import { memo, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import TechnoMapTooltip from './TechnoMapTooltip';
import TechnoMapMarkerSymbol from './TechnoMapMarkerSymbol';
import { classNames } from './classNames';
import { TECHNO_RIG_ICON_SRC, getTechnoMapGtRange } from './technoMapConfig';
import {
  TECHNO_MARKER_KIND,
  markerShapeFor,
} from './technoMarkerKind';
import type { TechnoMarkerKind } from './technoMarkerKind';
import { readDrillholeText, readDrillholeValue } from '../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../types/drillhole';
import type { MarkerSymbolConfig } from '../../types/map';

/** Fill used when a hole has no usable GT reading to colour it by. */
const TECHNO_UNIFORM_MARKER_CONFIG: Readonly<MarkerSymbolConfig> = Object.freeze({
  color: '#000000',
  shape: 'square',
});

const MARKER_ROLE_LABEL: Record<TechnoMarkerKind, string> = {
  [TECHNO_MARKER_KIND.rig]: 'Drill rig',
  [TECHNO_MARKER_KIND.producer]: 'Producer drillhole',
  [TECHNO_MARKER_KIND.injector]: 'Injector drillhole',
};

/**
 * Accessible name for a marker.
 *
 * Resolves the hole id under any spelling and substitutes a phrase when it is
 * absent. Interpolating the field directly announced "Drillhole null" to a
 * screen reader whenever the id was missing.
 */
function buildMarkerLabel(
  markerKind: TechnoMarkerKind,
  drillhole: DrillholeApiRecord,
): string {
  const holeId = readDrillholeText(drillhole, 'holeId') ?? 'unidentified hole';
  const campaign = readDrillholeText(drillhole, 'campaign') ?? 'campaign unavailable';

  return `${MARKER_ROLE_LABEL[markerKind]} ${holeId}, ${campaign}`;
}

export interface TechnoMapMarkerProps {
  drillhole: DrillholeApiRecord;
  /** Defaults to the injector square, this map's catch-all kind. */
  markerKind?: TechnoMarkerKind;
}

function TechnoMapMarker({
  drillhole,
  markerKind = TECHNO_MARKER_KIND.injector,
}: TechnoMapMarkerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isRig = markerKind === TECHNO_MARKER_KIND.rig;
  const gtRange = isRig ? null : getTechnoMapGtRange(readDrillholeValue(drillhole, 'gt'));
  const markerConfig: MarkerSymbolConfig = {
    ...TECHNO_UNIFORM_MARKER_CONFIG,
    shape: markerShapeFor(markerKind),
    ...(gtRange ? { color: gtRange.color } : null),
  };

  return (
    <button
      className={classNames(
        'techno-drillhole-marker',
        `techno-drillhole-marker--${markerKind}`,
        isOpen && 'is-open',
      )}
      type="button"
      aria-label={buildMarkerLabel(markerKind, drillhole)}
      aria-expanded={isOpen}
      onClick={(event: ReactMouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        setIsOpen((current) => !current);
      }}
      onBlur={() => setIsOpen(false)}
    >
      {isRig ? (
        <img
          className="techno-rig-marker-icon"
          src={TECHNO_RIG_ICON_SRC}
          alt=""
          draggable="false"
        />
      ) : (
        <TechnoMapMarkerSymbol config={markerConfig} />
      )}
      <TechnoMapTooltip drillhole={drillhole} />
    </button>
  );
}

export default memo(TechnoMapMarker);
