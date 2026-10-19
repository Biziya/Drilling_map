// Marker priority on the Exploration Map:
//   1. HoleStatus  = INPROGRESS -> drill rig (wins outright: no shape beneath it)
//   2. HolePurpose = PRODUCT    -> triangle (producer)
//   3. HolePurpose = INJECT     -> square   (injector)
//   4. anything else            -> square   (drillhole)
//
// Kind 4 exists because this map's dataset is SEDIMENT/DEVELOP holes, which
// are neither producers nor injectors; calling them injectors would mislabel
// them in the marker's accessible name.

import { isInProgressHole, readDrillholeTag } from '../../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../../types/drillhole';
import type { MarkerShape } from '../../../types/map';

export const MARKER_KINDS = ['rig', 'producer', 'injector', 'drillhole'] as const;

export type MarkerKind = (typeof MARKER_KINDS)[number];

// PRODUCT/INJECT are what the API returns; PRODUCER/INJECTOR are accepted too
// so neither vocabulary silently falls through.
const PRODUCER_PURPOSES: readonly string[] = ['PRODUCT', 'PRODUCER'];
const INJECTOR_PURPOSES: readonly string[] = ['INJECT', 'INJECTOR'];

export function resolveMarkerKind(drillhole: DrillholeApiRecord | null | undefined): MarkerKind {
  if (isInProgressHole(drillhole)) return 'rig';

  const purpose = readDrillholeTag(drillhole, 'holePurpose');
  if (PRODUCER_PURPOSES.includes(purpose)) return 'producer';
  if (INJECTOR_PURPOSES.includes(purpose)) return 'injector';

  return 'drillhole';
}

/** Shape drawn for a kind. Only the producer differs from the default square. */
export function markerShapeFor(kind: MarkerKind): MarkerShape {
  return kind === 'producer' ? 'triangle' : 'square';
}
