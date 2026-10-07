'use client';

import { useEffect } from 'react';

/**
 * Browsers change a focused number field when the mouse wheel turns over it,
 * so scrolling a long form could silently alter a measurement or price.
 * Blur the field on wheel instead; the page then scrolls normally.
 */
export function NumberWheelGuard() {
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement && el.type === 'number' && e.target === el) {
        el.blur();
      }
    }
    document.addEventListener('wheel', onWheel, { passive: true });
    return () => document.removeEventListener('wheel', onWheel);
  }, []);
  return null;
}
