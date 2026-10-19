import { memo, useMemo } from 'react';
import TechnoMapDeviationLines from './TechnoMapDeviationLines';
import TechnoMapMarker from './TechnoMapMarker';
import {
  attachDeviationOffsets,
  projectDrillholes,
} from './drillholeFeatures';
import type { DrillholeProjectionHandlers } from './drillholeFeatures';
import {
  calculateTechnoMapDeviationEndpoint,
  convertUtmToTechnoMapPosition,
} from './technoMapCoordinates';
import { resolveTechnoMarkerKind } from './technoMarkerKind';
import type { TechnoMarkerKind } from './technoMarkerKind';
import { dedupeDrillholes } from '../../utils/dedupeDrillholes';
import type { Point, ProjectedDrillhole } from '../../types/map';

const PROJECTION: DrillholeProjectionHandlers = {
  calculateEndpoint: calculateTechnoMapDeviationEndpoint,
  project: convertUtmToTechnoMapPosition,
};

interface TechnoMapFeatureProps {
  drillhole: ProjectedDrillhole;
  deviation: Point | null;
  markerKind: TechnoMarkerKind;
  showDeviation: boolean;
}

export interface TechnoMapFeaturesProps {
  /** Drillholes already projected onto the map by the page. */
  drillholes: readonly ProjectedDrillhole[];
  /** Whether the current zoom is past the deviation threshold. */
  deviationVisible: boolean;
  mapWidth: number;
  mapHeight: number;
}

function TechnoMapFeature({
  drillhole,
  deviation,
  markerKind,
  showDeviation,
}: TechnoMapFeatureProps) {
  return (
    <div
      className="techno-drillhole-feature"
      style={{
        left: `${drillhole.xPercent}%`,
        top: `${drillhole.yPercent}%`,
      }}
    >
      {showDeviation && deviation && (
        <TechnoMapDeviationLines deviation={deviation} />
      )}

      <TechnoMapMarker drillhole={drillhole} markerKind={markerKind} />
    </div>
  );
}

function TechnoMapFeatures({
  drillholes,
  deviationVisible,
  mapWidth,
  mapHeight,
}: TechnoMapFeaturesProps) {
  // Collapsed before projecting so one hole can never produce both a rig and
  // a shape marker.
  const projected = useMemo(
    () => projectDrillholes(dedupeDrillholes(drillholes), PROJECTION),
    [drillholes],
  );

  const features = useMemo(
    () => attachDeviationOffsets(projected, { mapWidth, mapHeight }),
    [projected, mapHeight, mapWidth],
  );

  return features.map(({ key, drillhole, deviation, isRig }) => (
    <TechnoMapFeature
      key={key}
      drillhole={drillhole}
      deviation={deviation}
      markerKind={resolveTechnoMarkerKind(drillhole, isRig)}
      showDeviation={deviationVisible}
    />
  ));
}

export default memo(TechnoMapFeatures);
