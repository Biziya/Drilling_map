import {
  isInProgressHole,
  readDrillholeValue,
} from '../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../types/drillhole';
import type {
  MapCoordinates,
  Point,
  ProjectedDrillhole,
  UtmCoordinates,
} from '../../types/map';

/** A drillhole paired with its deviation endpoint, before pixel conversion. */
export interface ProjectedDrillholeFeature {
  drillhole: ProjectedDrillhole;
  /** Stable React key. */
  key: string;
  isRig: boolean;
  /** Where the deviation line ends on the map, or null when there is none. */
  endpoint: MapCoordinates | null;
}

/** A drillhole ready to render, with its deviation as a pixel offset. */
export interface DrillholeFeature {
  drillhole: ProjectedDrillhole;
  key: string;
  isRig: boolean;
  /** Offset from the collar to the deviation endpoint, in CSS pixels. */
  deviation: Point | null;
}

/**
 * The two map-specific functions the projection needs.
 *
 * Passed in rather than imported so this module stays identical between the
 * Exploration and Techno maps, which each supply their own pair.
 */
export interface DrillholeProjectionHandlers {
  calculateEndpoint: (drillhole: DrillholeApiRecord) => UtmCoordinates | null;
  project: (endpoint: UtmCoordinates) => MapCoordinates | null;
}

/** Dimensions of the rendered base map, in CSS pixels. */
export interface MapPixelSize {
  mapWidth: number;
  mapHeight: number;
}

// Shared with the marker rules and with dedupeDrillholes. Previously compared
// the raw value, so ' inprogress ' set this flag false while the marker still
// resolved to a rig.
function isRig(drillhole: DrillholeApiRecord): boolean {
  return isInProgressHole(drillhole);
}

// Reads every spelling of holeId. Reading only the camelCase name keyed an
// entire PascalCase payload as `drillhole-0`, `drillhole-1`, ... which makes
// React reuse the wrong element whenever the list reorders.
function buildFeatureKey(drillhole: DrillholeApiRecord, index: number): string {
  return `${readDrillholeValue(drillhole, 'holeId') ?? 'drillhole'}-${index}`;
}

/**
 * Pairs each already-projected drillhole with its projected deviation
 * endpoint.
 *
 * The drillholes arriving here have already been placed on the map by the
 * page; only the endpoint is projected.
 */
export function projectDrillholes(
  drillholes: readonly ProjectedDrillhole[],
  { calculateEndpoint, project }: DrillholeProjectionHandlers,
): ProjectedDrillholeFeature[] {
  return drillholes.map((drillhole, index) => {
    const endpoint = calculateEndpoint(drillhole);

    return {
      drillhole,
      key: buildFeatureKey(drillhole, index),
      isRig: isRig(drillhole),
      endpoint: endpoint ? project(endpoint) : null,
    };
  });
}

/**
 * Converts a percentage delta into a pixel offset.
 *
 * Returns null before the map has been measured, since a zero-sized map would
 * collapse every line onto its collar.
 */
function toDeviationOffset(
  drillhole: MapCoordinates,
  endpoint: MapCoordinates | null,
  mapWidth: number,
  mapHeight: number,
): Point | null {
  if (!endpoint || mapWidth <= 0 || mapHeight <= 0) return null;

  return {
    x: ((endpoint.xPercent - drillhole.xPercent) / 100) * mapWidth,
    y: ((endpoint.yPercent - drillhole.yPercent) / 100) * mapHeight,
  };
}

export function attachDeviationOffsets(
  projected: readonly ProjectedDrillholeFeature[],
  { mapWidth, mapHeight }: MapPixelSize,
): DrillholeFeature[] {
  return projected.map(({ drillhole, key, isRig: rig, endpoint }) => ({
    drillhole,
    key,
    isRig: rig,
    deviation: toDeviationOffset(drillhole, endpoint, mapWidth, mapHeight),
  }));
}
