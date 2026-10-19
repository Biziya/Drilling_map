// Marker priority, shared by both maps:
//   1. HoleStatus  = INPROGRESS -> drill rig (wins outright: no shape beneath it)
//   2. HolePurpose = PRODUCT    -> triangle (producer)
//   3. HolePurpose = INJECT     -> square   (injector)
//   4. anything else            -> the page's fallback kind
//
// The Exploration Map falls back to a plain `drillhole` square (its dataset is
// SEDIMENT/DEVELOP holes); the Techno Map falls back to `injector`.

import { isInProgressHole, readDrillholeTag } from '../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../types/drillhole';
import type { MarkerShape } from '../../types/map';

export const MARKER_KINDS = ['rig', 'producer', 'injector', 'drillhole'] as const;

export type MarkerKind = (typeof MARKER_KINDS)[number];

// PRODUCT/INJECT are what the API returns; PRODUCER/INJECTOR are accepted too
// so neither vocabulary silently falls through to the fallback.
const PRODUCER_PURPOSES: readonly string[] = ['PRODUCT', 'PRODUCER'];
const INJECTOR_PURPOSES: readonly string[] = ['INJECT', 'INJECTOR'];

export function resolveMarkerKind(
  drillhole: DrillholeApiRecord | null | undefined,
  fallback: MarkerKind,
): MarkerKind {
  if (isInProgressHole(drillhole)) return 'rig';

  const purpose = readDrillholeTag(drillhole, 'holePurpose');
  if (PRODUCER_PURPOSES.includes(purpose)) return 'producer';
  if (INJECTOR_PURPOSES.includes(purpose)) return 'injector';

  return fallback;
}

/** Shape drawn for a kind. Only the producer differs from the default square. */
export function markerShapeFor(kind: MarkerKind): MarkerShape {
  return kind === 'producer' ? 'triangle' : 'square';
}
