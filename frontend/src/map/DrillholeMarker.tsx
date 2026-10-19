import { memo, useState } from 'react';
import { MAP_CONFIG, getGtRange } from './mapConfig';
import { markerShapeFor } from './markerKind';
import type { MarkerKind } from './markerKind';
import { formatMeasurement, formatNumber } from '../utils/formatNumber';
import { readDrillholeTag, readDrillholeText, readDrillholeValue } from '../utils/drillholeFields';
import type { DrillholeApiRecord } from '../types/drillhole';
import type { MarkerShape, StyleWithCssVariables } from '../types/map';

const EMPTY_VALUE = '—';

export interface MarkerSymbolProps {
  shape: MarkerShape;
  color: string;
  /** Reduced size used by the legend swatches. */
  small?: boolean;
}

/** The coloured shape drawn for a non-rig drillhole. Styled in index.css. */
export function MarkerSymbol({ shape, color, small = false }: MarkerSymbolProps) {
  const style: StyleWithCssVariables = { '--status-color': color };

  return (
    <span className="marker-symbol" data-shape={shape} data-small={small || undefined} style={style} aria-hidden="true" />
  );
}

export function RigIcon({ className }: { className: string }) {
  return <img className={`block select-none ${className}`} src={MAP_CONFIG.rigIconSrc} alt="" draggable="false" />;
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <span className="block">
      <b className="font-medium text-slate-300">{label}:</b> {value}
    </span>
  );
}

/** Every row reads through drillholeFields, so camelCase and PascalCase payloads look the same. */
function DrillholeTooltip({ drillhole }: { drillhole: DrillholeApiRecord }) {
  const value = (field: Parameters<typeof readDrillholeValue>[1]) => readDrillholeValue(drillhole, field);
  const textOf = (field: 'year' | 'campaign') => readDrillholeText(drillhole, field) ?? EMPTY_VALUE;

  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max max-w-60 -translate-x-1/2 rounded-lg border border-white/80 bg-ink/94 px-3 py-2.5 text-left text-2xs leading-normal whitespace-normal text-slate-50 shadow-lg group-hover:block group-focus:block group-aria-expanded:block after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-5 after:border-transparent after:border-t-ink/94"
    >
      <strong className="mb-1 block text-sm">{readDrillholeText(drillhole, 'holeId') ?? 'Unknown drillhole'}</strong>
      <TooltipRow label="Hole Purpose" value={readDrillholeTag(drillhole, 'holePurpose') || EMPTY_VALUE} />
      <TooltipRow label="Hole Status" value={readDrillholeTag(drillhole, 'holeStatus') || EMPTY_VALUE} />
      <TooltipRow label="X" value={formatNumber(value('x'), 2)} />
      <TooltipRow label="Y" value={formatNumber(value('y'), 2)} />
      <TooltipRow label="Z" value={formatMeasurement(value('z'))} />
      <TooltipRow label="Year" value={textOf('year')} />
      <TooltipRow label="Campaign" value={textOf('campaign')} />
      <TooltipRow label="GT" value={formatNumber(value('gt'))} />
      <TooltipRow label="Max Depth" value={formatMeasurement(value('maxDepth'))} />
      <TooltipRow label="Azimuth" value={formatNumber(value('azimuth'), 2)} />
      <TooltipRow label="Final Deviation" value={formatMeasurement(value('finalDeviation'))} />
    </span>
  );
}

export interface DrillholeMarkerProps {
  drillhole: DrillholeApiRecord;
  kind: MarkerKind;
  /** Accessible role name for this kind, e.g. "Producer drillhole". */
  roleLabel: string;
}

/** A clickable marker: the rig icon or a GT-coloured shape (never both), plus its tooltip. */
function DrillholeMarker({ drillhole, kind, roleLabel }: DrillholeMarkerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isRig = kind === 'rig';
  const holeId = readDrillholeText(drillhole, 'holeId') ?? 'unidentified hole';
  const campaign = readDrillholeText(drillhole, 'campaign') ?? 'campaign unavailable';

  return (
    <button
      type="button"
      data-kind={kind}
      className={`map-marker group absolute top-0 left-0 z-2 cursor-pointer bg-transparent p-0 outline-0 hover:z-20 ${isRig ? 'size-8' : 'size-6'}`}
      aria-label={`${roleLabel} ${holeId}, ${campaign}`}
      aria-expanded={isOpen}
      onClick={(event) => {
        event.stopPropagation();
        setIsOpen((current) => !current);
      }}
      onBlur={() => setIsOpen(false)}
    >
      {isRig ? (
        <RigIcon className="pointer-events-none size-full drop-shadow-[0_1px_2px_rgb(0_0_0/0.5)]" />
      ) : (
        <MarkerSymbol
          shape={markerShapeFor(kind)}
          color={getGtRange(readDrillholeValue(drillhole, 'gt'))?.color ?? MAP_CONFIG.uniformMarkerColor}
        />
      )}
      <DrillholeTooltip drillhole={drillhole} />
    </button>
  );
}

export default memo(DrillholeMarker);
