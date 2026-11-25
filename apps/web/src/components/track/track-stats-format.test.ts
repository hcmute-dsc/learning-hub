import { describe, expect, it } from 'vitest';
import {
  adminReportsHref,
  barPercent,
  lastActiveText,
  profileHref,
  shareText,
  waitingText,
  weekLabel,
} from './track-stats-format';

describe('barPercent and shareText', () => {
  it('scales bars to the largest value and never divides by zero', () => {
    expect(barPercent(5, 10)).toBe(50);
    expect(barPercent(1, 3)).toBe(33);
    expect(barPercent(0, 0)).toBe(0);
    expect(barPercent(12, 10)).toBe(100);
  });

  it('writes a share as a whole percent', () => {
    expect(shareText(1, 3)).toBe('33%');
    expect(shareText(0, 0)).toBe('0%');
  });
});

describe('weekLabel', () => {
  it('shows the Monday as day/month', () => {
    expect(weekLabel('2026-11-23')).toBe('23/11');
  });
});

describe('waitingText', () => {
  it('uses hours under two days, then days', () => {
    expect(waitingText(0.4)).toBe('dưới 1 giờ');
    expect(waitingText(5.7)).toBe('5 giờ');
    expect(waitingText(47.9)).toBe('47 giờ');
    expect(waitingText(50)).toBe('2 ngày');
  });
});

describe('lastActiveText', () => {
  const now = new Date('2026-11-25T05:00:00Z');
  it('counts whole days, and names learners who never started', () => {
    expect(lastActiveText(null, now)).toBe('Chưa hoạt động');
    expect(lastActiveText('2026-11-15T04:00:00Z', now)).toBe('10 ngày trước');
    expect(lastActiveText('2026-11-25T01:00:00Z', now)).toBe('Hôm nay');
  });
});

describe('links', () => {
  it('opens the progress report on the same track and days', () => {
    expect(adminReportsHref('sql-30-days', { from: '2026-11-12', to: '2026-11-25' })).toBe(
      '/admin/reports?track=sql-30-days&from=2026-11-12&to=2026-11-25',
    );
  });

  it('links a learner to their profile', () => {
    expect(profileHref('an-nguyen')).toBe('/u/an-nguyen');
  });
});
