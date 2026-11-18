import { describe, expect, it } from 'vitest';
import { MAX_TAG_FILTERS, type TrackProgress } from '@hub/shared';
import { hasFilters, parseFilters, progressBySlug, toggleTagHref, tracksQuery } from './catalog';

describe('parseFilters', () => {
  it('keeps a search, a known level and a tag', () => {
    expect(parseFilters({ q: ' sql ', level: 'beginner', tag: 'database' })).toEqual({
      q: 'sql',
      level: 'beginner',
      tags: ['database'],
    });
  });

  it('reads a repeated ?tag= as a list, trimmed, without blanks or repeats', () => {
    expect(parseFilters({ tag: [' sql', 'git', '', 'sql'] }).tags).toEqual(['sql', 'git']);
  });

  it('keeps at most MAX_TAG_FILTERS tags', () => {
    const tag = Array.from({ length: MAX_TAG_FILTERS + 3 }, (_, i) => `t${i}`);
    expect(parseFilters({ tag }).tags).toHaveLength(MAX_TAG_FILTERS);
  });

  it('drops an empty search and an unknown level', () => {
    expect(parseFilters({ q: '  ', level: 'expert' })).toEqual({
      q: undefined,
      level: undefined,
      tags: [],
    });
    expect(parseFilters({})).toEqual({ q: undefined, level: undefined, tags: [] });
  });
});

describe('tracksQuery', () => {
  it('only includes the filters that are set, one tag= per tag', () => {
    expect(tracksQuery({ tags: [] })).toBe('');
    expect(tracksQuery({ q: 'git', level: 'advanced', tags: [] })).toBe('q=git&level=advanced');
    expect(tracksQuery({ level: 'beginner', tags: ['sql', 'c#'] })).toBe(
      'level=beginner&tag=sql&tag=c%23',
    );
  });
});

describe('hasFilters', () => {
  it('is true when any of search, level or tags is set', () => {
    expect(hasFilters({ tags: [] })).toBe(false);
    expect(hasFilters({ q: 'sql', tags: [] })).toBe(true);
    expect(hasFilters({ level: 'beginner', tags: [] })).toBe(true);
    expect(hasFilters({ tags: ['git'] })).toBe(true);
  });
});

describe('toggleTagHref', () => {
  it('adds a tag and keeps the other filters', () => {
    expect(toggleTagHref({ q: 'join', level: 'beginner', tags: ['sql'] }, 'git')).toBe(
      '/tracks?q=join&level=beginner&tag=sql&tag=git',
    );
  });

  it('removes a selected tag, back to /tracks when nothing is left', () => {
    expect(toggleTagHref({ tags: ['sql', 'git'] }, 'sql')).toBe('/tracks?tag=git');
    expect(toggleTagHref({ tags: ['sql'] }, 'sql')).toBe('/tracks');
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
