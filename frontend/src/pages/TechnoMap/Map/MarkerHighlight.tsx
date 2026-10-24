import { markerHalfSize } from '../utils/markerLayer';
import type { MarkerFeature, ScreenTransform } from '../utils/markerLayer';
import type { StyleWithCssVariables } from '../../../types/map';

export interface MarkerHighlightProps {
  feature: MarkerFeature;
  transform: ScreenTransform;
  /** Blue while hovered, green while pinned (interaction colours in technoMap.yaml). */
  state: 'hovered' | 'pinned';
}

/**
 * A ring around one marker, over the canvas. The marker underneath keeps its
 * category colour; only the ring shows the hover or pinned state. Positioned
 * from the same transform as the canvas, so it follows the marker.
 */
function MarkerHighlight({ feature, transform, state }: MarkerHighlightProps) {
  const style: StyleWithCssVariables = {
    left: transform.x + feature.x * transform.width,
    top: transform.y + feature.y * transform.height,
    '--marker-half': `${markerHalfSize(feature.kind)}px`,
  };

  return <span className={`marker-highlight is-${state}`} style={style} data-key={feature.key} aria-hidden="true" />;
}

export default MarkerHighlight;
