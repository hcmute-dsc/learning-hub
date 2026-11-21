import { describe, expect, it } from 'vitest';
import type { LeaderboardPostStatus, LeaderboardRow } from '@hub/shared';
import { postActions } from './leaderboard-post';

const row: LeaderboardRow = {
  rank: 1,
  score: 3,
  completed: 1,
  user: { id: 'u1', githubLogin: 'an', displayName: 'An', avatarUrl: null },
};

const status = (over: Partial<LeaderboardPostStatus>): LeaderboardPostStatus => ({
  weekId: '2026-W47',
  startsAt: '2026-11-15T17:00:00.000Z',
  endsAt: '2026-11-22T17:00:00.000Z',
  enabled: true,
  state: 'not_posted',
  postedAt: null,
  updatedAt: null,
  preview: [row],
  ...over,
});

describe('postActions (admin weekly leaderboard post)', () => {
  it('offers "Đăng ngay" before the week is posted, "Cập nhật" after', () => {
    expect(postActions(status({}))).toMatchObject({ canPost: true, canUpdate: false });
    expect(postActions(status({ state: 'posted' }))).toMatchObject({
      canPost: false,
      canUpdate: true,
    });
  });

  it('offers nothing while queued or without a webhook', () => {
    expect(postActions(status({ state: 'queued' }))).toMatchObject({
      canPost: false,
      canUpdate: false,
    });
    expect(postActions(status({ enabled: false })).hint).toContain('webhook');
  });

  it('does not post or edit an empty board', () => {
    expect(postActions(status({ preview: [] })).canPost).toBe(false);
    expect(postActions(status({ state: 'posted', preview: [] })).canUpdate).toBe(false);
  });
});
