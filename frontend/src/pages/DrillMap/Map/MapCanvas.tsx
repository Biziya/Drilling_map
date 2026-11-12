import type { CSSProperties, ReactEventHandler, ReactNode } from 'react';

export interface MapCanvasProps {
  /** Transform and size, from buildCanvasTransformStyle. */
  style: CSSProperties;
  /** The selected base map's image (see baseMapLayout's imageSrc). */
  src: string;
  onImageLoad: ReactEventHandler<HTMLImageElement>;
  onImageError: ReactEventHandler<HTMLImageElement>;
  /**
   * False while another base map is shown. The image stays loaded and laid
   * out, only invisible: its size is what every feature is placed against,
   * so switching back is instant and nothing moves.
   */
  showImage?: boolean;
  children?: ReactNode;
}

/** The pannable, zoomable layer: the base map with the features on top. */
function MapCanvas({ style, src, onImageLoad, onImageError, showImage = true, children }: MapCanvasProps) {
  return (
    <div className="map-canvas" style={style}>
      <img
        className={`base-map${showImage ? '' : ' is-hidden'}`}
        src={src}
        alt="Drillhole base map"
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
