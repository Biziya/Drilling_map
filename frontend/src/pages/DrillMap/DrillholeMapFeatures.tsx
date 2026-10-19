import { memo, useMemo } from 'react';
import DeviationLineVector from './DeviationLineVector';
import DrillholeMarker from './DrillholeMarker';
import {
  attachDeviationOffsets,
  projectDrillholes,
} from './drillholeFeatures';
import type { DrillholeProjectionHandlers } from './drillholeFeatures';
import {
  calculateDeviationEndpoint,
  convertUtmToMapPosition,
} from './utmCoordinates';
import { resolveDrillholeMarkerKind } from './drillholeMarkerKind';
import type { MarkerKind } from './drillholeMarkerKind';
import { dedupeDrillholes } from '../../utils/dedupeDrillholes';
import type { Point, ProjectedDrillhole } from '../../types/map';

const PROJECTION: DrillholeProjectionHandlers = {
  calculateEndpoint: calculateDeviationEndpoint,
  project: convertUtmToMapPosition,
};

interface DrillholeFeatureProps {
  drillhole: ProjectedDrillhole;
  deviation: Point | null;
  markerKind: MarkerKind;
  showDeviation: boolean;
}

export interface DrillholeMapFeaturesProps {
  /** Drillholes already projected onto the map by the page. */
  drillholes: readonly ProjectedDrillhole[];
  /** Whether the current zoom is past the deviation threshold. */
  deviationVisible: boolean;
  mapWidth: number;
  mapHeight: number;
}

function DrillholeFeature({
  drillhole,
  deviation,
  markerKind,
  showDeviation,
}: DrillholeFeatureProps) {
  return (
    <div
      className="drillhole-feature"
      style={{
        left: `${drillhole.xPercent}%`,
        top: `${drillhole.yPercent}%`,
      }}
    >
      {showDeviation && deviation && (
        <DeviationLineVector deviation={deviation} />
      )}

      <DrillholeMarker drillhole={drillhole} markerKind={markerKind} />
    </div>
  );
}

function DrillholeMapFeatures({
  drillholes,
  deviationVisible,
  mapWidth,
  mapHeight,
}: DrillholeMapFeaturesProps) {
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
    <DrillholeFeature
      key={key}
      drillhole={drillhole}
      deviation={deviation}
      markerKind={resolveDrillholeMarkerKind(drillhole, isRig)}
      showDeviation={deviationVisible}
    />
  ));
}

export default memo(DrillholeMapFeatures);
