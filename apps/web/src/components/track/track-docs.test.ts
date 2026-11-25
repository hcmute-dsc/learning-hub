import { describe, expect, it } from 'vitest';
import { canSeeStats, isTrackDocPage, trackDocHref, trackTabs } from './track-docs';

describe('isTrackDocPage', () => {
  it('accepts only the pages a track can have', () => {
    expect(isTrackDocPage('setup')).toBe(true);
    expect(isTrackDocPage('resources')).toBe(true);
    expect(isTrackDocPage('progress')).toBe(false);
    expect(isTrackDocPage('Setup')).toBe(false);
  });
});

describe('trackDocHref', () => {
  it('is a sub-page of the track', () => {
    expect(trackDocHref('docker', 'setup')).toBe('/tracks/docker/setup');
  });
});

describe('canSeeStats', () => {
  it('shows track statistics to admins and mentors only (learning-hub#118)', () => {
    expect(canSeeStats(['member', 'admin'])).toBe(true);
    expect(canSeeStats(['member', 'mentor'])).toBe(true);
    expect(canSeeStats(['member'])).toBe(false);
    expect(canSeeStats(['member', 'content_maintainer'])).toBe(false);
  });
});

describe('trackTabs', () => {
  it('shows no tabs when the track has no extra pages', () => {
    expect(
      trackTabs(
        'git',
        { docs: { setup: false, resources: false }, hasGlossary: false },
        'overview',
      ),
    ).toEqual([]);
    // an older API without `docs` or `hasGlossary` must not break the page
    expect(trackTabs('git', {}, 'overview')).toEqual([]);
  });

  it('lists the overview, then only the pages the track has, and marks the current one', () => {
    expect(trackTabs('docker', { docs: { setup: true, resources: false } }, 'setup')).toEqual([
      { label: 'Tổng quan', href: '/tracks/docker', current: false },
      { label: 'Cài đặt', href: '/tracks/docker/setup', current: true },
    ]);
  });

  it('keeps the order Tổng quan, Cài đặt, Tài liệu thêm', () => {
    const tabs = trackTabs('sql', { docs: { resources: true, setup: true } }, 'overview');
    expect(tabs.map((t) => [t.label, t.current])).toEqual([
      ['Tổng quan', true],
      ['Cài đặt', false],
      ['Tài liệu thêm', false],
    ]);
  });

  it('adds Từ vựng last when the track has a glossary (learning-hub#106)', () => {
    const tabs = trackTabs('git', { docs: { setup: true }, hasGlossary: true }, 'glossary');
    expect(tabs.map((t) => [t.label, t.href, t.current])).toEqual([
      ['Tổng quan', '/tracks/git', false],
      ['Cài đặt', '/tracks/git/setup', false],
      ['Từ vựng', '/tracks/git/glossary', true],
    ]);
    // a glossary alone is enough for tabs
    expect(trackTabs('git', { hasGlossary: true }, 'overview')).toHaveLength(2);
  });

  it('adds Thống kê last, only when the viewer may see it (learning-hub#118)', () => {
    expect(trackTabs('git', { hasGlossary: true }, 'overview').map((t) => t.label)).toEqual([
      'Tổng quan',
      'Từ vựng',
    ]);
    const tabs = trackTabs('git', { hasGlossary: true, canSeeStats: true }, 'stats');
    expect(tabs.map((t) => [t.label, t.href, t.current])).toEqual([
      ['Tổng quan', '/tracks/git', false],
      ['Từ vựng', '/tracks/git/glossary', false],
      ['Thống kê', '/tracks/git/stats', true],
    ]);
    // a track with no other page still gets the two tabs
    expect(trackTabs('git', { canSeeStats: true }, 'overview')).toHaveLength(2);
  });
});
