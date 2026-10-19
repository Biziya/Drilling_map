import { memo, useMemo } from 'react';
import DrillholeMarker from './DrillholeMarker';
import { MAP_CONFIG } from '../config/technoMapConfig';
import { attachDeviationOffsets, projectDrillholes } from '../utils/coordinates';
import { resolveMarkerKind } from '../utils/markerKind';
import { dedupeDrillholes } from '../../../utils/dedupeDrillholes';
import type { ProjectedDrillhole } from '../../../types/map';

export interface DrillholeFeaturesProps {
  /** Drillholes already projected onto the map. */
  drillholes: readonly ProjectedDrillhole[];
  /** Whether the current zoom is past the deviation threshold. */
  deviationVisible: boolean;
  mapWidth: number;
  mapHeight: number;
}

/**
 * Positions every drillhole's marker and deviation line. Deduplicated first,
 * so one hole can never produce both a rig and a shape.
 */
function DrillholeFeatures({
  drillholes,
  deviationVisible,
  mapWidth,
  mapHeight,
}: DrillholeFeaturesProps) {
  const projected = useMemo(() => projectDrillholes(dedupeDrillholes(drillholes)), [drillholes]);
  const features = useMemo(
    () => attachDeviationOffsets(projected, { mapWidth, mapHeight }),
    [projected, mapWidth, mapHeight],
  );

  return features.map(({ key, drillhole, deviation }) => {
    const kind = resolveMarkerKind(drillhole);

    return (
      <div key={key} className="drillhole-feature" style={{ left: `${drillhole.xPercent}%`, top: `${drillhole.yPercent}%` }}>
        {/* A 1x1 viewport with overflow: visible, so the line starts at the collar. */}
        {deviationVisible && deviation && (
          <svg className="deviation-line-vector" width="1" height="1" aria-hidden="true">
            <line x1="0" y1="0" x2={deviation.x} y2={deviation.y} />
          </svg>
        )}
        <DrillholeMarker drillhole={drillhole} kind={kind} roleLabel={MAP_CONFIG.markerLabels[kind]} />
      </div>
    );
  });
}

export default memo(DrillholeFeatures);
