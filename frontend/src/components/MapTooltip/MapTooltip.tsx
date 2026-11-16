import { memo } from 'react';
import type { ReactNode } from 'react';
import type { DrillholeColumn } from '../SelectionTable/columns';
import type { DrillholeApiRecord } from '../../types/drillhole';
import type { Point, Size, StyleWithCssVariables } from '../../types/map';
import './MapTooltip.css';

/** Room the tooltip needs beside its marker before it turns to fit (px). */
const SIDE_ROOM = 150;
/** Gap from the marker (with the arrow) plus the margin kept from the map edge (px). */
const CLEARANCE = 26;
/** The tooltip never gets shorter than this; past it the body scrolls (px). */
const MIN_HEIGHT = 120;
const EMPTY_VALUE = '—';

export interface MapTooltipProps {
  /** The marker's centre, in viewport px. */
  at: Point;
  /** Half the marker's on-screen box, so the arrow clears it (px). */
  markerHalf: number;
  viewport: Size;
  /** Showing the pinned hole, not under the pointer: it takes the pointer so it can scroll. */
  isPinned: boolean;
  /** Extra classes, e.g. the marker kind. */
  className?: string;
  /** Accessible name, e.g. "Producer drillhole H-1". */
  label: string;
  /** Hole ID, as data-hole. */
  holeId: string;
  children: ReactNode;
}

/**
 * The one tooltip on a map, for the hovered or clicked hole: placed in
 * viewport px beside its marker, so it follows it through pan and zoom. It
 * opens on whichever side of the marker has more room, no taller than that
 * room (the body scrolls), and shifts sideways near the left and right edges,
 * so it stays in view.
 */
export function MapTooltip({ at, markerHalf, viewport, isPinned, className, label, holeId, children }: MapTooltipProps) {
  const isBelow = at.y < viewport.height / 2;
  const room = (isBelow ? viewport.height - at.y : at.y) - markerHalf - CLEARANCE;
  const style: StyleWithCssVariables = {
    left: at.x,
    top: at.y,
    '--marker-half': `${markerHalf}px`,
    '--tooltip-max-height': `${Math.max(MIN_HEIGHT, Math.round(room))}px`,
  };
  const classes = [
    'marker-tooltip',
    className ?? '',
    isBelow ? 'is-below' : '',
    at.x < SIDE_ROOM ? 'is-start' : '',
    at.x > viewport.width - SIDE_ROOM ? 'is-end' : '',
    isPinned ? 'is-pinned' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style} data-hole={holeId} aria-label={label} role="group">
      {children}
    </div>
  );
}

export interface DrillholeFieldsProps {
  title: string;
  fields: readonly DrillholeColumn[];
  drillhole: DrillholeApiRecord;
}

/**
 * A title and one label/value row per field, every row always shown in
 * order; a missing value is a dash. The rows scroll when the map leaves too
 * little room (--tooltip-max-height, from MapTooltip).
 */
export const DrillholeFields = memo(function DrillholeFields({ title, fields, drillhole }: DrillholeFieldsProps) {
  return (
    <span className="drillhole-tooltip" role="tooltip">
      <strong>{title}</strong>
      <dl className="drillhole-tooltip__fields">
        {fields.map(({ label, read }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{read(drillhole) ?? EMPTY_VALUE}</dd>
          </div>
        ))}
      </dl>
    </span>
  );
});
