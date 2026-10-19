// Marker priority on the Techno Map:
//   1. HoleStatus  = INPROGRESS -> drill rig (wins outright: no shape beneath it)
//   2. HolePurpose = PRODUCT    -> triangle (producer)
//   3. anything else            -> square   (injector)
//
// This map's dataset is gated to PRODUCT and INJECT, so anything that is not
// a producer is an injector.

import { isInProgressHole, readDrillholeTag } from '../../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../../types/drillhole';
import type { MarkerShape } from '../../../types/map';

export const MARKER_KINDS = ['rig', 'producer', 'injector'] as const;

export type MarkerKind = (typeof MARKER_KINDS)[number];

// PRODUCT is what the API returns; PRODUCER is accepted too so neither
// vocabulary silently falls through to the injector square.
const PRODUCER_PURPOSES: readonly string[] = ['PRODUCT', 'PRODUCER'];

export function resolveMarkerKind(drillhole: DrillholeApiRecord | null | undefined): MarkerKind {
  if (isInProgressHole(drillhole)) return 'rig';

  return PRODUCER_PURPOSES.includes(readDrillholeTag(drillhole, 'holePurpose')) ? 'producer' : 'injector';
}

/** Shape drawn for a kind. Only the producer differs from the default square. */
export function markerShapeFor(kind: MarkerKind): MarkerShape {
  return kind === 'producer' ? 'triangle' : 'square';
}
