import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MAP_CONFIG } from '../config/technoMapConfig';
import { createSpriteSet, drawMarkerLayer } from '../utils/markerLayer';
import type { MarkerFeature, ScreenTransform } from '../utils/markerLayer';
import type { Size } from '../../../types/map';

export interface DrillholeLayerProps {
  /** The features the filters let through. */
  features: readonly MarkerFeature[];
  /** Map ratio -> viewport px for the current view; null before the base map is measured. */
  transform: ScreenTransform | null;
  viewport: Size;
  deviationVisible: boolean;
}

/**
 * Every shown marker and deviation line, drawn on one viewport-sized canvas
 * in the same commit as the view change, so it never lags the base map. It
 * takes no pointer events: hover and clicks are hit-tested by the page
 * (markerLayer.ts findMarkerAt). `data-drawn` / `data-lines` report what the
 * last frame drew.
 */
function DrillholeLayer({ features, transform, viewport, deviationVisible }: DrillholeLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // The rig sprite is made from the icon once it has loaded; until then rigs wait.
  const [rigIcon, setRigIcon] = useState<HTMLImageElement | null>(null);
  const pixelRatio = window.devicePixelRatio || 1;
  const sprites = useMemo(() => createSpriteSet(pixelRatio, rigIcon), [pixelRatio, rigIcon]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = Math.round(viewport.width * pixelRatio);
    const height = Math.round(viewport.height * pixelRatio);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const context = canvas.getContext('2d');
    let drawn = { markers: 0, lines: 0 };
    if (context && transform) drawn = drawMarkerLayer(context, { features, transform, viewport, deviationVisible, sprites });
    else context?.clearRect(0, 0, canvas.width, canvas.height);

    canvas.dataset.drawn = String(drawn.markers);
    canvas.dataset.lines = String(drawn.lines);
  }, [features, transform, viewport, deviationVisible, sprites, pixelRatio]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="drillhole-layer"
        style={{ width: viewport.width, height: viewport.height }}
        aria-hidden="true"
      />
      <img className="rig-sprite-source" src={MAP_CONFIG.rigIconSrc} alt="" onLoad={(event) => setRigIcon(event.currentTarget)} />
    </>
  );
}

export default memo(DrillholeLayer);
