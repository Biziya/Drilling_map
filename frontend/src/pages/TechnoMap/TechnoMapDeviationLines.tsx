import type { Point } from '../../types/map';

export interface TechnoMapDeviationLinesProps {
  /** Offset from the collar to the deviation endpoint, in CSS pixels. */
  deviation: Point;
}

// Must render identically to DrillMap/DeviationLineVector.tsx: the two maps
// are required to draw the same line for the same hole.
function TechnoMapDeviationLines({ deviation }: TechnoMapDeviationLinesProps) {
  return (
    <svg
      className="techno-deviation-line-vector"
      width="1"
      height="1"
      aria-hidden="true"
    >
      <line x1="0" y1="0" x2={deviation.x} y2={deviation.y} />
    </svg>
  );
}

export default TechnoMapDeviationLines;
