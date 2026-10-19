import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { MapTransform } from '../../types/map';

/** Either a replacement view or a function producing one from the current view. */
export type ViewUpdater = MapTransform | ((current: MapTransform) => MapTransform);

export interface AnimationFrameView {
  /** The committed view, updated at most once per animation frame. */
  view: MapTransform;
  /** The live view, always current even between frames. */
  viewRef: RefObject<MapTransform>;
  queueViewUpdate: (updater: ViewUpdater) => void;
}

/**
 * Holds the pan/zoom view in a ref and commits it to state once per frame.
 *
 * Pointer and wheel events fire far faster than React can usefully re-render,
 * so the ref absorbs every update and only the last one per frame reaches
 * state.
 */
export function useAnimationFrameView(initialView: MapTransform): AnimationFrameView {
  const viewRef = useRef<MapTransform>(initialView);
  const frameRef = useRef<number | null>(null);
  const [view, setView] = useState<MapTransform>(initialView);

  const commitOnNextFrame = useCallback(() => {
    if (frameRef.current !== null) return;

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      setView(viewRef.current);
    });
  }, []);

  const queueViewUpdate = useCallback((updater: ViewUpdater) => {
    const current = viewRef.current;
    const next = typeof updater === 'function' ? updater(current) : updater;

    if (next === current) return;

    viewRef.current = next;
    commitOnNextFrame();
  }, [commitOnNextFrame]);

  useEffect(() => () => {
    if (frameRef.current === null) return;
    window.cancelAnimationFrame(frameRef.current);
  }, []);

  return { view, viewRef, queueViewUpdate };
}
