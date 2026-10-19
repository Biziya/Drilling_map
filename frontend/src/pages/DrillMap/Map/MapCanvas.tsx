import type { CSSProperties, ReactEventHandler, ReactNode } from 'react';
import { BASE_MAP_SRC } from '../config/drillMapConfig';

export interface MapCanvasProps {
  /** Transform and size, from buildCanvasTransformStyle. */
  style: CSSProperties;
  onImageLoad: ReactEventHandler<HTMLImageElement>;
  onImageError: ReactEventHandler<HTMLImageElement>;
  children?: ReactNode;
}

/** The pannable, zoomable layer: the base map with the features on top. */
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
