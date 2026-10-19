// Marker priority on the Techno Map:
//   1. HoleStatus  = INPROGRESS -> drill rig
//   2. HolePurpose = PRODUCT    -> triangle
//   3. HolePurpose = INJECT     -> square
//
// The rig rule wins outright, so an in-progress producer shows a rig and not a
// triangle.

import { isInProgressHole, readDrillholeTag } from '../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../types/drillhole';
import type { MarkerShape } from '../../types/map';

export const TECHNO_MARKER_KIND = Object.freeze({
  rig: 'rig',
  producer: 'producer',
  injector: 'injector',
} as const);

/** What a marker on the Techno Map is drawn as. */
export type TechnoMarkerKind =
  (typeof TECHNO_MARKER_KIND)[keyof typeof TECHNO_MARKER_KIND];

// PRODUCT/INJECT are what the API actually returns. This previously matched
// only 'PRODUCER', which no record ever carries, so every hole fell through to
// the injector square and no triangle was ever drawn. PRODUCER/INJECTOR are
// kept as accepted spellings so neither vocabulary can silently regress.
const PRODUCER_PURPOSES: readonly string[] = ['PRODUCT', 'PRODUCER'];
const INJECTOR_PURPOSES: readonly string[] = ['INJECT', 'INJECTOR'];

/** Normalised HolePurpose, or the empty string when absent. */
export function readHolePurpose(drillhole: DrillholeApiRecord | null | undefined): string {
  return readDrillholeTag(drillhole, 'holePurpose');
}

// Re-exported so the marker rules and the feature list cannot drift apart.
export { isInProgressHole };

export function isProducerHole(drillhole: DrillholeApiRecord | null | undefined): boolean {
  return PRODUCER_PURPOSES.includes(readHolePurpose(drillhole));
}

export function isInjectorHole(drillhole: DrillholeApiRecord | null | undefined): boolean {
  return INJECTOR_PURPOSES.includes(readHolePurpose(drillhole));
}

/** Applies the documented marker priority to one drillhole. */
export function resolveTechnoMarkerKind(
  drillhole: DrillholeApiRecord | null | undefined,
  isRig = false,
): TechnoMarkerKind {
  if (isRig || isInProgressHole(drillhole)) return TECHNO_MARKER_KIND.rig;
  if (isProducerHole(drillhole)) return TECHNO_MARKER_KIND.producer;

  // This map's dataset is gated to PRODUCT and INJECT, so anything that is not
  // a producer is an injector and keeps the square it already had.
  return TECHNO_MARKER_KIND.injector;
}

/** Shape drawn for a kind. Only the producer differs from the default square. */
export function markerShapeFor(kind: TechnoMarkerKind): MarkerShape {
  return kind === TECHNO_MARKER_KIND.producer ? 'triangle' : 'square';
}
