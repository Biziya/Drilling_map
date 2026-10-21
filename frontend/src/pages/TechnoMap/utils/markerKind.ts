// Marker priority on the Techno Map:
//   1. HoleStatus = INPROGRESS -> drill rig (wins outright: no shape beneath it)
//   2. HolePurpose             -> that drillhole type's symbol (technoMap.yaml)
//   3. anything else           -> injector square
//
// A purpose matching no configured type falls back to the injector, as it
// always has on this map.

import { DRILLHOLE_TYPE_CONFIG, MAP_CONFIG, MARKER_KINDS } from '../config/technoMapConfig';
import type { DrillholeType, MarkerKind, MarkerShape } from '../config/technoMapConfig';
import { isInProgressHole, readDrillholeTag } from '../../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../../types/drillhole';

export { MARKER_KINDS };
export type { MarkerKind };

const FALLBACK_TYPE: DrillholeType = 'injector';

const TYPE_BY_PURPOSE = new Map<string, DrillholeType>(
  MAP_CONFIG.drillholeTypes.flatMap(({ id, purposes }) => purposes.map((purpose) => [purpose.trim().toUpperCase(), id])),
);

/** The hole's type, from its purpose alone. A rig still has one, for filtering. */
export function resolveDrillholeType(drillhole: DrillholeApiRecord | null | undefined): DrillholeType {
  return TYPE_BY_PURPOSE.get(readDrillholeTag(drillhole, 'holePurpose')) ?? FALLBACK_TYPE;
}

export function resolveMarkerKind(drillhole: DrillholeApiRecord | null | undefined): MarkerKind {
  return isInProgressHole(drillhole) ? 'rig' : resolveDrillholeType(drillhole);
}

export function markerShapeFor(type: DrillholeType): MarkerShape {
  return DRILLHOLE_TYPE_CONFIG[type].shape;
}
