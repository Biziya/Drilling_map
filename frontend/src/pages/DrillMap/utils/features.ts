// The Exploration Map's holes as features: placed, keyed and classified once
// per dataset, then filtered, selected and hit-tested by the page.

import { layerForKind } from '../config/drillMapConfig';
import { projectDrillholes } from './coordinates';
import type { ProjectedDrillholeFeature } from './coordinates';
import { resolveMarkerKind } from './markerKind';
import type { MarkerKind } from './markerKind';
import type { MapFilters } from '../hooks/useMapFilters';
import { dedupeDrillholes } from '../../../utils/dedupeDrillholes';
import type { MapBounds, MapTransform, Point, ProjectedDrillhole, Size } from '../../../types/map';

/** A placed hole with its marker kind. */
export interface ExplorationFeature extends ProjectedDrillholeFeature {
  kind: MarkerKind;
}

/** Deduplicated first, so one hole can never produce both a rig and a shape. */
export function buildFeatures(drillholes: readonly ProjectedDrillhole[], bounds?: MapBounds): ExplorationFeature[] {
  return projectDrillholes(dedupeDrillholes(drillholes), bounds).map((feature) => ({ ...feature, kind: resolveMarkerKind(feature.drillhole) }));
}

/** The features whose Layers panel layer is on. */
export function shownFeatures(features: readonly ExplorationFeature[], filters: MapFilters): ExplorationFeature[] {
  return features.filter((feature) => filters[layerForKind(feature.kind)]);
}

/** A feature's collar in viewport px. */
export function featureScreenPoint(feature: ExplorationFeature, view: MapTransform, mapOrigin: Point, mapSize: Size): Point {
  return {
    x: mapOrigin.x + view.translateX + (feature.drillhole.xPercent / 100) * mapSize.width * view.scale,
    y: mapOrigin.y + view.translateY + (feature.drillhole.yPercent / 100) * mapSize.height * view.scale,
  };
}

/** The features whose collar lies inside `rect` (viewport px). */
export function featuresInRect(
  features: readonly ExplorationFeature[],
  rect: Point & Size,
  view: MapTransform,
  mapOrigin: Point,
  mapSize: Size,
): ExplorationFeature[] {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  return features.filter((feature) => {
    const { x, y } = featureScreenPoint(feature, view, mapOrigin, mapSize);

    return x >= rect.x && x <= right && y >= rect.y && y <= bottom;
  });
}

/** Half the on-screen marker, so the tooltip's arrow clears it (px). */
export const markerHalfSize = (kind: MarkerKind): number => (kind === 'rig' ? 16 : 8);
