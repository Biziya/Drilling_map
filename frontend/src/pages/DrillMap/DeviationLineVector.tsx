import type { Point } from '../../types/map';

export interface DeviationLineVectorProps {
  /** Offset from the collar to the deviation endpoint, in CSS pixels. */
  deviation: Point;
}

// Deliberately identical to TechnoMap/TechnoMapDeviationLines.tsx.
//
// This previously sized the SVG to the vector's bounding box and offset it back
// over the collar. The geometry was correct, but it diverged from the working
// Techno Map renderer and, combined with a floored stroke width, drew a red
// round cap over every collar at low zoom where the line is under a pixel long.
//
// The 1x1 viewport plus `overflow: visible` on the class is what Techno Map
// uses, so the two maps now draw deviation lines the same way.
function DeviationLineVector({ deviation }: DeviationLineVectorProps) {
  return (
    <svg
      className="deviation-line-vector"
      width="1"
      height="1"
      aria-hidden="true"
    >
      <line x1="0" y1="0" x2={deviation.x} y2={deviation.y} />
    </svg>
  );
}

export default DeviationLineVector;
