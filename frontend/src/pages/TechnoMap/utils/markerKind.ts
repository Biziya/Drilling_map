// Marker priority on the Techno Map:
//   1. HoleStatus = INPROGRESS -> drill rig (wins outright: no shape beneath it)
//   2. category                -> that drillhole type's symbol (technoMap.yaml)
//
// `category` is resolved by the backend (TechnoMapCategory.cs): sampling flags
// first, then the SQL Type. A hole without one (an unmapped Type such as
// CONTROLE or SER) belongs to no filter and is not drawn.

import { DRILLHOLE_TYPE_CONFIG, DRILLHOLE_TYPES, MARKER_KINDS } from '../config/technoMapConfig';
import type { DrillholeType, MarkerKind, MarkerShape } from '../config/technoMapConfig';
import { isInProgressHole, readDrillholeValue } from '../../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../../types/drillhole';

export { MARKER_KINDS };
export type { MarkerKind };

const isDrillholeType = (value: unknown): value is DrillholeType =>
  (DRILLHOLE_TYPES as readonly unknown[]).includes(value);

/** The hole's type, from the API's category alone. A rig still has one, for filtering. */
export function resolveDrillholeType(drillhole: DrillholeApiRecord | null | undefined): DrillholeType | null {
  const category = readDrillholeValue(drillhole, 'category');
  const id = typeof category === 'string' ? category.trim().toLowerCase() : null;

  return isDrillholeType(id) ? id : null;
}

/** The marker to draw, or null for a hole that belongs to no filter. */
export function resolveMarkerKind(drillhole: DrillholeApiRecord | null | undefined): MarkerKind | null {
  const type = resolveDrillholeType(drillhole);
  if (!type) return null;

  return isInProgressHole(drillhole) ? 'rig' : type;
}

export function markerShapeFor(type: DrillholeType): MarkerShape {
  return DRILLHOLE_TYPE_CONFIG[type].shape;
}
