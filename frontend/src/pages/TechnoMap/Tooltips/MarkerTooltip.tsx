import DrillholeTooltip from './DrillholeTooltip';
import { MAP_CONFIG } from '../config/technoMapConfig';
import { markerHalfSize } from '../utils/markerLayer';
import type { MarkerFeature, ScreenTransform } from '../utils/markerLayer';
import { readDrillholeText } from '../../../utils/drillholeFields';
import type { Size, StyleWithCssVariables } from '../../../types/map';

export interface MarkerTooltipProps {
  feature: MarkerFeature;
  transform: ScreenTransform;
  viewport: Size;
  /** Showing the pinned hole, not under the pointer: it takes the pointer so it can scroll. */
  isPinned: boolean;
}

/** Room the tooltip needs beside its marker before it turns to fit (px). */
const SIDE_ROOM = 150;
/** Gap from the marker (with the arrow) plus the margin kept from the map edge (px). */
const CLEARANCE = 26;
/** The tooltip never gets shorter than this; past it the body scrolls (px). */
const MIN_HEIGHT = 120;

/**
 * The one tooltip on the map, for the hovered or clicked hole: its details
 * beside its marker (the ring is Map/MarkerHighlight). Placed in viewport px from the
 * same transform as the canvas, so it follows the marker through pan and zoom.
 * It opens on whichever side of the marker has more room, no taller than that
 * room (the body scrolls), and shifts sideways near the left and right edges,
 * so it stays in view.
 */
function MarkerTooltip({ feature, transform, viewport, isPinned }: MarkerTooltipProps) {
  const x = transform.x + feature.x * transform.width;
  const y = transform.y + feature.y * transform.height;
  const half = markerHalfSize(feature.kind);
  const isBelow = y < viewport.height / 2;
  const room = (isBelow ? viewport.height - y : y) - half - CLEARANCE;
  const style: StyleWithCssVariables = {
    left: x,
    top: y,
    '--marker-half': `${half}px`,
    '--tooltip-max-height': `${Math.max(MIN_HEIGHT, Math.round(room))}px`,
  };
  const placement = [
    isBelow ? 'is-below' : '',
    x < SIDE_ROOM ? 'is-start' : '',
    x > viewport.width - SIDE_ROOM ? 'is-end' : '',
    isPinned ? 'is-pinned' : '',
  ].filter(Boolean).join(' ');
  const holeId = readDrillholeText(feature.drillhole, 'holeId') ?? 'unidentified hole';

  return (
    <div
      className={`marker-tooltip drillhole-marker--${feature.kind}${placement ? ` ${placement}` : ''}`}
      style={style}
      data-hole={holeId}
      aria-label={`${MAP_CONFIG.markerLabels[feature.kind]} ${holeId}`}
      role="group"
    >
      <DrillholeTooltip drillhole={feature.drillhole} />
    </div>
  );
}

export default MarkerTooltip;
