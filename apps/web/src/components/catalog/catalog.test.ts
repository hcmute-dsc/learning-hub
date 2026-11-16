import { describe, expect, it } from 'vitest';
import type { TrackProgress } from '@hub/shared';
import { parseFilters, progressBySlug, tracksQuery } from './catalog';

describe('parseFilters', () => {
  it('keeps a search and a known level', () => {
    expect(parseFilters({ q: ' sql ', level: 'beginner' })).toEqual({
      q: 'sql',
      level: 'beginner',
    });
  });

  it('drops an empty search and an unknown level', () => {
    expect(parseFilters({ q: '  ', level: 'expert' })).toEqual({
      q: undefined,
      level: undefined,
    });
    expect(parseFilters({})).toEqual({ q: undefined, level: undefined });
  });
});

describe('tracksQuery', () => {
  it('only includes the filters that are set', () => {
    expect(tracksQuery({})).toBe('');
    expect(tracksQuery({ q: 'git', level: 'advanced' })).toBe('q=git&level=advanced');
  });
});

describe('progressBySlug', () => {
  it('maps slugs to percent, completed tracks to 100', () => {
    const base = { lessons: { done: 0, total: 0 }, exercises: { done: 0, total: 0 } };
    const map = progressBySlug([
      { ...base, slug: 'sql', status: 'active', percent: 40 },
      { ...base, slug: 'git', status: 'completed', percent: 95 },
    ] as TrackProgress[]);
    expect(map.get('sql')).toBe(40);
    expect(map.get('git')).toBe(100);
    expect(map.has('docker')).toBe(false);
  });
});
