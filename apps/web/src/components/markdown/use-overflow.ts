'use client';

import { useEffect, type RefObject } from 'react';

/** True when the content is wider than the box (1px of rounding is not overflow). */
export function overflowsX(scrollWidth: number, clientWidth: number): boolean {
  return scrollWidth - clientWidth > 1;
}

/**
 * Sets `data-overflow` on the element while its content is wider than it, so the CSS
 * scroll hint in globals.css fades only boxes that really scroll (learning-hub#103).
 * CSS alone cannot tell: Chrome runs a scroll timeline even on a box with nothing to
 * scroll. Re-checked whenever the box or its content changes size (rotating a phone,
 * fonts loading).
 */
export function useOverflowFlag(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const box = ref.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const update = () =>
      box.toggleAttribute('data-overflow', overflowsX(box.scrollWidth, box.clientWidth));
    const observer = new ResizeObserver(update);
    observer.observe(box);
    if (box.firstElementChild) observer.observe(box.firstElementChild);
    update();
    return () => observer.disconnect();
  }, [ref]);
}
