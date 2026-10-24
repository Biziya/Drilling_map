import { memo } from 'react';
import { TOOLTIP_FIELDS } from '../utils/tooltipFields';
import { readDrillholeText } from '../../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../../types/drillhole';

const EMPTY_VALUE = '—';

export interface DrillholeTooltipProps {
  drillhole: DrillholeApiRecord;
}

// Every value reads through drillholeFields, so camelCase and PascalCase
// payloads show the same. Every row always shows, in order; a missing value
// is a dash. The body scrolls when the map leaves too little room
// (--tooltip-max-height, from MarkerTooltip).
function DrillholeTooltip({ drillhole }: DrillholeTooltipProps) {
  return (
    <span className="drillhole-tooltip" role="tooltip">
      <strong>{readDrillholeText(drillhole, 'holeId')?.trim() || 'Unknown drillhole'}</strong>
      <dl className="drillhole-tooltip__fields">
        {TOOLTIP_FIELDS.map(({ label, read }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{read(drillhole) ?? EMPTY_VALUE}</dd>
          </div>
        ))}
      </dl>
    </span>
  );
}

export default memo(DrillholeTooltip);
