import { useCallback, useState } from 'react';
import type { ReactEventHandler } from 'react';
import type { Size } from '../../types/map';

const NO_IMAGE_SIZE: Size = { width: 0, height: 0 };

export interface BaseMapImage {
  /** Intrinsic size of the loaded image, zeroed until it loads. */
  size: Size;
  hasFailed: boolean;
  handleLoad: ReactEventHandler<HTMLImageElement>;
  handleError: ReactEventHandler<HTMLImageElement>;
}

/** Tracks the base map image's intrinsic size and whether it failed to load. */
export function useBaseMapImage(): BaseMapImage {
  const [size, setSize] = useState<Size>(NO_IMAGE_SIZE);
  const [hasFailed, setHasFailed] = useState(false);

  const handleLoad = useCallback<ReactEventHandler<HTMLImageElement>>((event) => {
    setHasFailed(false);
    setSize({
      width: event.currentTarget.naturalWidth,
      height: event.currentTarget.naturalHeight,
    });
  }, []);

  const handleError = useCallback<ReactEventHandler<HTMLImageElement>>(
    () => setHasFailed(true),
    [],
  );

  return { size, hasFailed, handleLoad, handleError };
}
