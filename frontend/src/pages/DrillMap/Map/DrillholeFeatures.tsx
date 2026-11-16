import { memo, useMemo } from 'react';
import DrillholeMarker from './DrillholeMarker';
import { MAP_CONFIG } from '../config/drillMapConfig';
import { attachDeviationOffsets } from '../utils/coordinates';
import type { ExplorationFeature } from '../utils/features';

const NO_KEYS: ReadonlySet<string> = new Set();

export interface DrillholeFeaturesProps {
  /** The holes to draw (already filtered by the Layers panel). */
  features: readonly ExplorationFeature[];
  /** Whether deviation lines are on and the zoom is past their threshold. */
  deviationVisible: boolean;
  mapWidth: number;
  mapHeight: number;
  /** Keys of the selected holes, ringed. */
  selectedKeys?: ReadonlySet<string>;
  pinnedKey?: string | null;
  onHover?: (key: string | null) => void;
  onActivate?: (key: string, additive: boolean) => void;
}

/** Positions every drillhole's marker and deviation line. */
function DrillholeFeatures({
  features,
  deviationVisible,
  mapWidth,
  mapHeight,
  selectedKeys = NO_KEYS,
  pinnedKey = null,
  onHover,
  onActivate,
}: DrillholeFeaturesProps) {
  const placed = useMemo(() => attachDeviationOffsets(features, { mapWidth, mapHeight }), [features, mapWidth, mapHeight]);

  return placed.map(({ key, drillhole, deviation }, index) => {
    const { kind } = features[index] as ExplorationFeature;

    return (
      <div key={key} className="drillhole-feature" style={{ left: `${drillhole.xPercent}%`, top: `${drillhole.yPercent}%` }}>
        {/* A 1x1 viewport with overflow: visible, so the line starts at the collar. */}
        {deviationVisible && deviation && (
          <svg className="deviation-line-vector" width="1" height="1" aria-hidden="true">
            <line x1="0" y1="0" x2={deviation.x} y2={deviation.y} />
          </svg>
        )}
        <DrillholeMarker
          featureKey={key}
          drillhole={drillhole}
          kind={kind}
          roleLabel={MAP_CONFIG.markerLabels[kind]}
          isSelected={selectedKeys.has(key)}
          isPinned={pinnedKey === key}
          onHover={onHover}
          onActivate={onActivate}
        />
      </div>
    );
  });
}

export default memo(DrillholeFeatures);
