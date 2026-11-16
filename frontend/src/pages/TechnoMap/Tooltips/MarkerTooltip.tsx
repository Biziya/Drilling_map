import DrillholeTooltip from './DrillholeTooltip';
import { MAP_CONFIG } from '../config/technoMapConfig';
import { markerHalfSize } from '../utils/markerLayer';
import type { MarkerFeature, ScreenTransform } from '../utils/markerLayer';
import { MapTooltip } from '../../../components/MapTooltip/MapTooltip';
import { readDrillholeText } from '../../../utils/drillholeFields';
import type { Size } from '../../../types/map';

export interface MarkerTooltipProps {
  feature: MarkerFeature;
  transform: ScreenTransform;
  viewport: Size;
  /** Showing the pinned hole, not under the pointer: it takes the pointer so it can scroll. */
  isPinned: boolean;
}

/**
 * The Techno Map's one tooltip (the shared MapTooltip), for the hovered or
 * clicked hole, placed from the same transform as the marker canvas. The ring
 * is Map/MarkerHighlight.
 */
function MarkerTooltip({ feature, transform, viewport, isPinned }: MarkerTooltipProps) {
  const holeId = readDrillholeText(feature.drillhole, 'holeId') ?? 'unidentified hole';

  return (
    <MapTooltip
      at={{ x: transform.x + feature.x * transform.width, y: transform.y + feature.y * transform.height }}
      markerHalf={markerHalfSize(feature.kind)}
      viewport={viewport}
      isPinned={isPinned}
      className={`drillhole-marker--${feature.kind}`}
      label={`${MAP_CONFIG.markerLabels[feature.kind]} ${holeId}`}
      holeId={holeId}
    >
      <DrillholeTooltip drillhole={feature.drillhole} />
    </MapTooltip>
  );
}

export default MarkerTooltip;
