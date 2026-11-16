import { memo } from 'react';
import { DrillholeFields } from '../../../components/MapTooltip/MapTooltip';
import { TOOLTIP_FIELDS } from '../utils/tooltipFields';
import { readDrillholeText } from '../../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../../types/drillhole';

export interface DrillholeTooltipProps {
  drillhole: DrillholeApiRecord;
}

// Titled with the record ID ([ID]); every TOOLTIP_FIELDS row follows, in
// order, a missing value as a dash. Values read through drillholeFields, so
// camelCase and PascalCase payloads show the same.
function DrillholeTooltip({ drillhole }: DrillholeTooltipProps) {
  return <DrillholeFields title={readDrillholeText(drillhole, 'id')?.trim() || 'ID unavailable'} fields={TOOLTIP_FIELDS} drillhole={drillhole} />;
}

export default memo(DrillholeTooltip);
