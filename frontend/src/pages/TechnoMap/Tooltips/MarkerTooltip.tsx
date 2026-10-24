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
  /** Opened by a click (stays until the next click) rather than by hovering. */
  isPinned: boolean;
}

/** Room the tooltip needs beside its marker before it turns to fit (px). */
const SIDE_ROOM = 130;

/**
 * The one tooltip on the map, for the hovered or clicked hole: a highlight
 * ring on its marker and the details beside it. Placed in viewport px from the
 * same transform as the canvas, so it follows the marker through pan and zoom.
 * Above the marker in the lower part of the map, below it in the upper part,
 * and shifted sideways near the left and right edges, so it stays in view.
 */
function MarkerTooltip({ feature, transform, viewport, isPinned }: MarkerTooltipProps) {
  const x = transform.x + feature.x * transform.width;
  const y = transform.y + feature.y * transform.height;
  const style: StyleWithCssVariables = { left: x, top: y, '--marker-half': `${markerHalfSize(feature.kind)}px` };
  const placement = [
    y < viewport.height * 0.45 ? 'is-below' : '',
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
      <span className="marker-tooltip__ring" aria-hidden="true" />
      <DrillholeTooltip drillhole={feature.drillhole} />
    </div>
  );
}

export default MarkerTooltip;
