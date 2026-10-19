import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { Size } from '../../types/map';

const EMPTY_SIZE: Size = { width: 0, height: 0 };

/**
 * Tracks an element's rendered size.
 *
 * The state is only replaced when the measurement actually changes, so a
 * ResizeObserver callback that reports the same box does not re-render the
 * whole map.
 */
export function useElementSize(elementRef: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>(EMPTY_SIZE);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;

    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setSize((current) => (
        current.width === width && current.height === height
          ? current
          : { width, height }
      ));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => observer.disconnect();
  }, [elementRef]);

  return size;
}
