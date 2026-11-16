import type { NextItem } from '@hub/shared';

/** URLs of lessons and exercises use ids, not slugs, because ids are stable (FRONTEND-DESIGN §3). */
export function lessonHref(id: string): string {
  return `/lessons/${id}`;
}

export function exerciseHref(id: string): string {
  return `/exercises/${id}`;
}

export function itemHref(item: Pick<NextItem, 'kind' | 'id'>): string {
  return item.kind === 'lesson' ? lessonHref(item.id) : exerciseHref(item.id);
}

/** Anchor of a module section on the track page. */
export function moduleAnchor(moduleSlug: string): string {
  return `module-${moduleSlug}`;
}

/** Track page scrolled to one module (there is no separate module page yet). */
export function moduleHref(trackSlug: string, moduleSlug: string): string {
  return `/tracks/${trackSlug}#${moduleAnchor(moduleSlug)}`;
}
