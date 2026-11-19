import { describe, expect, it } from 'vitest';
import { BADGES } from '@hub/shared';
import { badgeCards, streakMessage } from './achievements';

const earned = [{ code: 'first_track' as const, awardedAt: '2026-11-17T03:00:00.000Z' }];

describe('badgeCards', () => {
  it('shows only earned badges on a profile', () => {
    expect(badgeCards(earned, false).map((c) => c.code)).toEqual(['first_track']);
  });

  it('lists every badge on the dashboard, earned ones with their date', () => {
    const cards = badgeCards(earned, true);
    expect(cards.map((c) => c.code)).toEqual(BADGES.map((b) => b.code));
    expect(cards.find((c) => c.code === 'first_track')?.awardedAt).toBe(earned[0]!.awardedAt);
    expect(cards.find((c) => c.code === 'first_lesson')?.awardedAt).toBeNull();
  });
});

describe('streakMessage', () => {
  it('invites instead of scolding when there is no streak', () => {
    expect(streakMessage({ current: 0, longest: 0 })).toContain('bắt đầu');
    expect(streakMessage({ current: 0, longest: 4 })).toContain('4 ngày');
  });

  it('explains the forgiven day while the streak is alive', () => {
    expect(streakMessage({ current: 3, longest: 3 })).toContain('nghỉ xen kẽ 1 ngày');
  });
});
