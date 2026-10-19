import type {
  CssLength,
  CssVariableName,
  MapTransform,
  Point,
  RenderedMapSize,
  Size,
  StyleWithCssVariables,
} from '../../types/map';

/**
 * Size used before the base map image has reported its intrinsic dimensions.
 * Frozen and shared so repeated renders compare equal by reference.
 */
const FILL_VIEWPORT = Object.freeze({ width: '100%', height: '100%' } as const);

/** Scale that fits the image inside the viewport without cropping it. */
export function computeFitScale(imageSize: Size, viewportSize: Size): number {
  if (!imageSize.width || !imageSize.height) return 0;

  return Math.min(
    viewportSize.width / imageSize.width,
    viewportSize.height / imageSize.height,
  );
}

/**
 * Pixel size the base map is drawn at.
 *
 * Falls back to filling the viewport while the image size is still unknown,
 * and never returns a sub-pixel dimension that would collapse the canvas.
 */
export function computeRenderedMapSize(
  imageSize: Size,
  viewportSize: Size,
): RenderedMapSize {
  const fitScale = computeFitScale(imageSize, viewportSize);
  if (fitScale <= 0) return FILL_VIEWPORT;

  return {
    width: Math.max(1, imageSize.width * fitScale),
    height: Math.max(1, imageSize.height * fitScale),
  };
}

/**
 * Reads a rendered dimension as a pixel count.
 *
 * The `'100%'` fallback has no pixel value yet, so it reads as 0 and the
 * callers that need real pixels skip their work for that frame.
 */
export function toPixels(value: CssLength | undefined): number {
  return typeof value === 'number' ? value : 0;
}

/** Top-left corner of the rendered map within the viewport. */
export function computeMapOrigin(
  viewportRect: Size,
  renderedMapSize: RenderedMapSize,
): Point {
  const width = typeof renderedMapSize.width === 'number'
    ? renderedMapSize.width
    : viewportRect.width;
  const height = typeof renderedMapSize.height === 'number'
    ? renderedMapSize.height
    : viewportRect.height;

  return {
    x: (viewportRect.width - width) / 2,
    y: (viewportRect.height - height) / 2,
  };
}

export function getDevicePixelRatio(): number {
  if (typeof window === 'undefined') return 1;

  return window.devicePixelRatio || 1;
}

/** Rounds a translation onto the device pixel grid to avoid blurred edges. */
export function snapToDevicePixels(
  point: Point,
  ratio: number = getDevicePixelRatio(),
): Point {
  return {
    x: Math.round(point.x * ratio) / ratio,
    y: Math.round(point.y * ratio) / ratio,
  };
}

export interface CanvasTransformOptions {
  view: MapTransform;
  renderedMapSize: RenderedMapSize;
  /**
   * Custom property the stylesheet reads to cancel the canvas scale out of
   * marker sizes. Each map owns its own name, so it is passed in rather than
   * hard-coded.
   */
  scaleVariable: CssVariableName;
}

/**
 * Inline style implementing the canvas transform.
 *
 * The order `translate(...) scale(...)` is load-bearing: cursor-centred zoom
 * is computed against exactly this composition, so swapping the two would
 * move the map out from under the pointer.
 */
export function buildCanvasTransformStyle({
  view,
  renderedMapSize,
  scaleVariable,
}: CanvasTransformOptions): StyleWithCssVariables {
  const { x, y } = snapToDevicePixels({
    x: view.translateX,
    y: view.translateY,
  });

  return {
    ...renderedMapSize,
    [scaleVariable]: 1 / view.scale,
    transform: `translate(${x}px, ${y}px) scale(${view.scale})`,
  };
}
