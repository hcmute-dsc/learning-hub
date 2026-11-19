'use client';

import { useEffect } from 'react';

/**
 * Opens the folded module that the URL points to (`/tracks/x#module-y`, used by lesson
 * breadcrumbs), then scrolls to it. Some browsers do not unfold a closed <details> on a
 * fragment jump by themselves (learning-hub#61).
 */
export function OpenModuleFromHash() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      if (el instanceof HTMLDetailsElement && !el.open) {
        el.open = true;
        el.scrollIntoView();
      }
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);
  return null;
}
