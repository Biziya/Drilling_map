import { useEffect, useRef, useState } from 'react';

/**
 * Open/closed state for a button + menu pair inside one wrapper element: a
 * press outside the wrapper or Esc closes it, and Esc returns focus to the
 * button. A panel rendered outside the wrapper (e.g. to escape an
 * `overflow: hidden` parent) can attach `panelRef` to count as inside too.
 */
export function usePopover<Wrapper extends HTMLElement = HTMLDivElement>() {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<Wrapper | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!wrapperRef.current?.contains(target) && !panelRef.current?.contains(target)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return { isOpen, setIsOpen, wrapperRef, buttonRef, panelRef };
}
