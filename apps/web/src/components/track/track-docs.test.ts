import { describe, expect, it } from 'vitest';
import { isTrackDocPage, trackDocHref, trackTabs } from './track-docs';

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

describe('trackTabs', () => {
  it('shows no tabs when the track has no extra pages', () => {
    expect(trackTabs('git', { setup: false, resources: false }, 'overview')).toEqual([]);
    // an older API without `docs` must not break the page
    expect(trackTabs('git', undefined, 'overview')).toEqual([]);
  });

  it('lists the overview, then only the pages the track has, and marks the current one', () => {
    expect(trackTabs('docker', { setup: true, resources: false }, 'setup')).toEqual([
      { label: 'Tổng quan', href: '/tracks/docker', current: false },
      { label: 'Cài đặt', href: '/tracks/docker/setup', current: true },
    ]);
  });

  it('keeps the order Tổng quan, Cài đặt, Tài liệu thêm', () => {
    const tabs = trackTabs('sql', { resources: true, setup: true }, 'overview');
    expect(tabs.map((t) => [t.label, t.current])).toEqual([
      ['Tổng quan', true],
      ['Cài đặt', false],
      ['Tài liệu thêm', false],
    ]);
  });
});
