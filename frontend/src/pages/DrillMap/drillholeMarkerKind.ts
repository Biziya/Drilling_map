// Marker priority on the Exploration Map:
//   1. HoleStatus  = INPROGRESS -> drill rig
//   2. HolePurpose = PRODUCT    -> triangle (producer)
//   3. HolePurpose = INJECT     -> square   (injector)
//   4. anything else            -> square, exactly as before
//
// The rig rule wins outright, so an in-progress producer shows a rig and NOT a
// rig stacked on a triangle.
//
// Kind 4 exists because the Exploration Map's own dataset is gated to SEDIMENT
// and DEVELOP holes, which are neither producers nor injectors. Folding them
// into 'injector' would label them wrongly in the marker's accessible name, so
// they keep the plain square they already had.

import { isInProgressHole, readDrillholeTag } from '../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../types/drillhole';
import type { MarkerShape } from '../../types/map';

export const MARKER_KIND = Object.freeze({
  rig: 'rig',
  producer: 'producer',
  injector: 'injector',
  drillhole: 'drillhole',
} as const);

/** What a marker on the Exploration Map is drawn as. */
export type MarkerKind = (typeof MARKER_KIND)[keyof typeof MARKER_KIND];

// PRODUCT/INJECT are the values the API returns. PRODUCER/INJECTOR are accepted
// as well because the Techno Map's resolver matches on those spellings; taking
// both here means neither vocabulary silently falls through to a square. Trim
// this list if the two are ever unified.
const PRODUCER_PURPOSES: readonly string[] = ['PRODUCT', 'PRODUCER'];
const INJECTOR_PURPOSES: readonly string[] = ['INJECT', 'INJECTOR'];

/** Normalised HoleStatus, or the empty string when absent. */
export function readHoleStatus(drillhole: DrillholeApiRecord | null | undefined): string {
  return readDrillholeTag(drillhole, 'holeStatus');
}

/** Normalised HolePurpose, or the empty string when absent. */
export function readHolePurpose(drillhole: DrillholeApiRecord | null | undefined): string {
  return readDrillholeTag(drillhole, 'holePurpose');
}

// Re-exported so the marker rules and the feature list cannot drift apart.
export { isInProgressHole };

/** Applies the documented marker priority to one drillhole. */
export function resolveDrillholeMarkerKind(
  drillhole: DrillholeApiRecord | null | undefined,
  isRig = false,
): MarkerKind {
  if (isRig || isInProgressHole(drillhole)) return MARKER_KIND.rig;

  const purpose = readHolePurpose(drillhole);

  if (PRODUCER_PURPOSES.includes(purpose)) return MARKER_KIND.producer;
  if (INJECTOR_PURPOSES.includes(purpose)) return MARKER_KIND.injector;

  return MARKER_KIND.drillhole;
}

/** Shape drawn for a kind. Only the producer differs from the default square. */
export function markerShapeFor(kind: MarkerKind): MarkerShape {
  return kind === MARKER_KIND.producer ? 'triangle' : 'square';
}

export function isRigKind(kind: MarkerKind): boolean {
  return kind === MARKER_KIND.rig;
}
