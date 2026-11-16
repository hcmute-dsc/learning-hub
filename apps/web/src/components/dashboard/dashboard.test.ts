import { describe, expect, it } from 'vitest';
import type { TrackProgress } from '@hub/shared';
import { countItems, encouragement, pickContinueTrack } from './dashboard';

function track(over: Partial<TrackProgress>): TrackProgress {
  return {
    trackId: 't',
    slug: 't',
    title: 'Track',
    status: 'active',
    cohort: null,
    enrolledAt: '2026-01-01T00:00:00.000Z',
    lessons: { done: 0, total: 4 },
    exercises: { done: 0, total: 2 },
    percent: 0,
    next: { kind: 'lesson', id: 'l1', title: 'Bài 1' },
    ...over,
  };
}

describe('countItems', () => {
  it('adds lessons and exercises', () => {
    const t = track({ lessons: { done: 2, total: 4 }, exercises: { done: 1, total: 2 } });
    expect(countItems(t)).toEqual({ done: 3, total: 6 });
  });
});

describe('pickContinueTrack', () => {
  it('returns null when nothing is left to continue', () => {
    expect(pickContinueTrack([])).toBeNull();
    expect(pickContinueTrack([track({ status: 'completed', next: null })])).toBeNull();
    expect(pickContinueTrack([track({ next: null })])).toBeNull();
  });

  it('prefers a started track over a newer untouched one', () => {
    const started = track({ slug: 'a', percent: 30, enrolledAt: '2026-01-01T00:00:00.000Z' });
    const fresh = track({ slug: 'b', percent: 0, enrolledAt: '2026-03-01T00:00:00.000Z' });
    expect(pickContinueTrack([fresh, started])?.slug).toBe('a');
  });

  it('breaks ties with the most recent enrollment', () => {
    const older = track({ slug: 'a', percent: 10, enrolledAt: '2026-01-01T00:00:00.000Z' });
    const newer = track({ slug: 'b', percent: 50, enrolledAt: '2026-02-01T00:00:00.000Z' });
    expect(pickContinueTrack([older, newer])?.slug).toBe('b');
  });
});

describe('encouragement', () => {
  it('invites a first enrollment', () => {
    expect(encouragement([])).toMatch(/lộ trình đầu tiên/);
  });

  it('celebrates when every track is completed', () => {
    expect(encouragement([track({ status: 'completed', next: null })])).toMatch(
      /hoàn thành mọi lộ trình/,
    );
  });

  it('counts finished items over all tracks', () => {
    const a = track({ lessons: { done: 2, total: 4 } });
    const b = track({ exercises: { done: 1, total: 2 } });
    expect(encouragement([a, b])).toBe(
      'Bạn đã hoàn thành 3 mục trên 2 lộ trình. Giữ vững phong độ nhé!',
    );
  });

  it('nudges a member who has not finished anything yet', () => {
    expect(encouragement([track({})])).toMatch(/Bắt đầu thôi/);
  });
});
