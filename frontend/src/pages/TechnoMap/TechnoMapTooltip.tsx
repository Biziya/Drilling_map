import { memo } from 'react';
import { formatMeasurement, formatNumber } from './formatNumber';
import { readHolePurpose } from './technoMarkerKind';
import { readDrillholeTag, readDrillholeText, readDrillholeValue } from '../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../types/drillhole';

const EMPTY_VALUE = '—';

export interface TechnoMapTooltipProps {
  drillhole: DrillholeApiRecord;
}

// Every row reads through readDrillholeValue, so all eleven resolve the
// camelCase and PascalCase spellings the same way. Previously only Hole
// Status, Azimuth and Final Deviation did, and a PascalCase payload drew
// correct markers above a tooltip showing dashes for the other eight rows.
function TechnoMapTooltip({ drillhole }: TechnoMapTooltipProps) {
  return (
    <span className="techno-drillhole-tooltip" role="tooltip">
      <strong>{readDrillholeText(drillhole, 'holeId') ?? 'Unknown drillhole'}</strong>
      <span><b>Hole Purpose:</b> {readHolePurpose(drillhole) || EMPTY_VALUE}</span>
      <span>
        <b>Hole Status:</b> {readDrillholeTag(drillhole, 'holeStatus') || EMPTY_VALUE}
      </span>
      <span><b>X:</b> {formatNumber(readDrillholeValue(drillhole, 'x'), 2)}</span>
      <span><b>Y:</b> {formatNumber(readDrillholeValue(drillhole, 'y'), 2)}</span>
      <span><b>Z:</b> {formatMeasurement(readDrillholeValue(drillhole, 'z'))}</span>
      <span><b>Year:</b> {readDrillholeText(drillhole, 'year') ?? EMPTY_VALUE}</span>
      <span><b>Campaign:</b> {readDrillholeText(drillhole, 'campaign') ?? EMPTY_VALUE}</span>
      <span><b>GT:</b> {formatNumber(readDrillholeValue(drillhole, 'gt'))}</span>
      <span>
        <b>Max Depth:</b> {formatMeasurement(readDrillholeValue(drillhole, 'maxDepth'))}
      </span>
      <span>
        <b>Azimuth:</b> {formatNumber(readDrillholeValue(drillhole, 'azimuth'), 2)}
      </span>
      <span>
        <b>Final Deviation:</b>
        {' '}
        {formatMeasurement(readDrillholeValue(drillhole, 'finalDeviation'))}
      </span>
    </span>
  );
}

export default memo(TechnoMapTooltip);
