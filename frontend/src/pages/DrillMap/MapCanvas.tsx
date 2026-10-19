import type { CSSProperties, ReactNode, ReactEventHandler } from 'react';
import { BASE_MAP_SRC } from './drillMapConfig';

export interface MapCanvasProps {
  /** Transform and sizing for the canvas, from buildCanvasTransformStyle. */
  style: CSSProperties;
  onImageLoad: ReactEventHandler<HTMLImageElement>;
  onImageError: ReactEventHandler<HTMLImageElement>;
  children?: ReactNode;
}

function MapCanvas({ style, onImageLoad, onImageError, children }: MapCanvasProps) {
  return (
    <div className="map-canvas" style={style}>
      <img
        className="base-map"
        src={BASE_MAP_SRC}
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
