import { memo } from 'react';
import { formatMeasurement, formatNumber } from '../../../utils/formatNumber';
import { readDrillholeTag, readDrillholeText, readDrillholeValue } from '../../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../../types/drillhole';

const EMPTY_VALUE = '—';

export interface DrillholeTooltipProps {
  drillhole: DrillholeApiRecord;
}

// Every row reads through drillholeFields, so camelCase and PascalCase
// payloads show the same values. Shown on hover, focus or click (TechnoMap.css).
function DrillholeTooltip({ drillhole }: DrillholeTooltipProps) {
  const value = (field: Parameters<typeof readDrillholeValue>[1]) => readDrillholeValue(drillhole, field);

  return (
    <span className="drillhole-tooltip" role="tooltip">
      <strong>{readDrillholeText(drillhole, 'holeId') ?? 'Unknown drillhole'}</strong>
      <span><b>Hole Purpose:</b> {readDrillholeTag(drillhole, 'holePurpose') || EMPTY_VALUE}</span>
      <span><b>Hole Status:</b> {readDrillholeTag(drillhole, 'holeStatus') || EMPTY_VALUE}</span>
      <span><b>X:</b> {formatNumber(value('x'), 2)}</span>
      <span><b>Y:</b> {formatNumber(value('y'), 2)}</span>
      <span><b>Z:</b> {formatMeasurement(value('z'))}</span>
      <span><b>Year:</b> {readDrillholeText(drillhole, 'year') ?? EMPTY_VALUE}</span>
      <span><b>Campaign:</b> {readDrillholeText(drillhole, 'campaign') ?? EMPTY_VALUE}</span>
      <span><b>GT:</b> {formatNumber(value('gt'))}</span>
      <span><b>Max Depth:</b> {formatMeasurement(value('maxDepth'))}</span>
      <span><b>Azimuth:</b> {formatNumber(value('azimuth'), 2)}</span>
      <span><b>Final Deviation:</b> {formatMeasurement(value('finalDeviation'))}</span>
    </span>
  );
}

export default memo(DrillholeTooltip);
