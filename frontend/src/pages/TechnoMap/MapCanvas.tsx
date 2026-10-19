import type { CSSProperties, ReactNode, ReactEventHandler } from 'react';
import { TECHNO_BASE_MAP_SRC } from './technoMapConfig';

export interface MapCanvasProps {
  /** Transform and sizing for the canvas, from buildCanvasTransformStyle. */
  style: CSSProperties;
  onImageLoad: ReactEventHandler<HTMLImageElement>;
  onImageError: ReactEventHandler<HTMLImageElement>;
  children?: ReactNode;
}

function MapCanvas({ style, onImageLoad, onImageError, children }: MapCanvasProps) {
  return (
    <div className="techno-map-canvas" style={style}>
      <img
        className="techno-base-map"
        src={TECHNO_BASE_MAP_SRC}
        alt="Geological drillhole base map"
        decoding="async"
        draggable="false"
        onLoad={onImageLoad}
        onError={onImageError}
      />

      {children}
    </div>
  );
}

export default MapCanvas;
