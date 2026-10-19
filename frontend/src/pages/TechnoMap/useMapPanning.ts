import { useCallback } from 'react';
import type { RefObject } from 'react';
import { usePointerDrag } from './usePointerDrag';
import type { PointerDrag } from './usePointerDrag';
import type { MapTransform, Point } from '../../types/map';
import type { ViewUpdater } from './useAnimationFrameView';

export interface MapPanningOptions {
  viewRef: RefObject<MapTransform>;
  queueViewUpdate: (updater: ViewUpdater) => void;
  ignoreSelector: string;
}

/** Wires drag-to-pan up to the view, leaving the current scale untouched. */
export function useMapPanning({
  viewRef,
  queueViewUpdate,
  ignoreSelector,
}: MapPanningOptions): PointerDrag {
  const panTo = useCallback((position: Point) => {
    queueViewUpdate((current) => ({
      ...current,
      translateX: position.x,
      translateY: position.y,
    }));
  }, [queueViewUpdate]);

  const readTranslate = useCallback((): Point => ({
    x: viewRef.current.translateX,
    y: viewRef.current.translateY,
  }), [viewRef]);

  return usePointerDrag({
    ignoreSelector,
    getOrigin: readTranslate,
    onPan: panTo,
  });
}
