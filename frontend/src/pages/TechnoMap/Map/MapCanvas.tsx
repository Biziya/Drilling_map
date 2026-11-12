import type { CSSProperties, ReactEventHandler } from 'react';

export interface MapCanvasProps {
  /** Transform and size, from buildCanvasTransformStyle. */
  style: CSSProperties;
  onImageLoad: ReactEventHandler<HTMLImageElement>;
  onImageError: ReactEventHandler<HTMLImageElement>;
  /**
   * False while another base map is shown. The image stays loaded and laid
   * out, only invisible: its size is what every feature is placed against,
   * so switching back is instant and nothing moves.
   */
  showImage?: boolean;
  /** The image the map is laid out on. */
  src: string;
}

/** The pannable, zoomable base map image. */
function MapCanvas({ style, onImageLoad, onImageError, showImage = true, src }: MapCanvasProps) {
  return (
    <div className="map-canvas" style={style}>
      <img
        className={`base-map${showImage ? '' : ' is-hidden'}`}
        src={src}
        alt="Base map"
        decoding="async"
        draggable="false"
        onLoad={onImageLoad}
        onError={onImageError}
      />
    </div>
  );
}

export default MapCanvas;
