import { memo } from 'react';
import { DRILLHOLE_TYPE_CONFIG } from '../config/technoMapConfig';
import { resolveDrillholeType } from '../utils/markerKind';
import { formatMeasurement, formatNumber } from '../../../utils/formatNumber';
import { readDrillholeText, readDrillholeValue } from '../../../utils/drillholeFields';
import type { DrillholeField } from '../../../utils/drillholeFields';
import type { DrillholeApiRecord } from '../../../types/drillhole';

const EMPTY_VALUE = '—';

export interface DrillholeTooltipProps {
  drillhole: DrillholeApiRecord;
}

/** A 0/1 flag as Yes/No, or null when the API did not say. */
function formatFlag(value: unknown): string | null {
  if (value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true') return 'Yes';
  if (value === false || value === 0 || value === '0' || String(value).toLowerCase() === 'false') return 'No';

  return null;
}

/** "a – b" from whichever ends are known, or null when neither is. */
function formatRange(from: string, to: string): string | null {
  if (from === EMPTY_VALUE && to === EMPTY_VALUE) return null;

  return `${from} – ${to}`;
}

// Every row reads through drillholeFields, so camelCase and PascalCase
// payloads show the same values. The identity rows always show (a dash when
// missing); the rest only when the API sent them, so the demo dataset and the
// pyISR_AllData_V2 records each show what they have and nothing empty.
// Shown on hover, focus or click (TechnoMap.css).
function DrillholeTooltip({ drillhole }: DrillholeTooltipProps) {
  const value = (field: DrillholeField) => readDrillholeValue(drillhole, field);
  const text = (field: DrillholeField) => readDrillholeText(drillhole, field)?.trim() || null;
  const number = (field: DrillholeField, digits?: number) => {
    const formatted = formatNumber(value(field), digits);
    return formatted === EMPTY_VALUE ? null : formatted;
  };
  const metres = (field: DrillholeField) => {
    const formatted = formatMeasurement(value(field));
    return formatted === EMPTY_VALUE ? null : formatted;
  };
  const type = resolveDrillholeType(drillhole);

  const optional: [label: string, shown: string | null][] = [
    ['Category', type && DRILLHOLE_TYPE_CONFIG[type].label],
    ['Relative Level', text('relativeLevel')],
    ['License', text('license')],
    ['Stratigraphic Unit', text('stratigraphicUnit')],
    ['Screen Depth', formatRange(formatMeasurement(value('screenMinDepth')), formatMeasurement(value('screenMaxDepth')))],
    ['Screen Length', metres('screenLength')],
    ['Screen Altitude', formatRange(formatMeasurement(value('screenTopAltitude')), formatMeasurement(value('screenBottomAltitude')))],
    ['Drilling Company', text('drillingCompany')],
    ['Drilling Rig', text('drillingRig')],
    ['Start Date', text('startDate')],
    ['End Date', text('endDate')],
    ['Billing Date', text('billingDate')],
    ['Ra-grade Sampling', formatFlag(value('raGradeSampling'))],
    ['Sediment Sampling', formatFlag(value('sedimentSampling'))],
    ['Year', text('year')],
    ['Campaign', text('campaign')],
    ['GT', number('gt')],
    ['Max Depth', metres('maxDepth')],
    ['Azimuth', number('azimuth', 2)],
    ['Final Deviation', metres('finalDeviation')],
    ['Comment', text('generalComment')],
  ];

  return (
    <span className="drillhole-tooltip" role="tooltip">
      <strong>{text('holeId') ?? 'Unknown drillhole'}</strong>
      <span><b>Type:</b> {text('holePurpose') ?? EMPTY_VALUE}</span>
      <span><b>Status:</b> {text('holeStatus') ?? EMPTY_VALUE}</span>
      <span><b>X:</b> {formatNumber(value('x'), 2)}</span>
      <span><b>Y:</b> {formatNumber(value('y'), 2)}</span>
      <span><b>Z:</b> {formatMeasurement(value('z'))}</span>
      {optional.map(([label, shown]) => shown && <span key={label}><b>{label}:</b> {shown}</span>)}
    </span>
  );
}

export default memo(DrillholeTooltip);
