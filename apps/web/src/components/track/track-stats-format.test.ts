import { describe, expect, it } from 'vitest';
import { trackStatsDays } from '@hub/shared';
import {
  adminReportsHref,
  barPercent,
  biggestDrop,
  bucketLabel,
  change,
  changeText,
  itemSteps,
  lastActiveText,
  niceTicks,
  profileHref,
  shareText,
  statsHref,
  waitingText,
  weekLabel,
  weekRange,
} from './track-stats-format';

describe('period (?days=)', () => {
  it('keeps the four periods and falls back to 14 days for anything else', () => {
    expect(['7', '14', '30', '90'].map(trackStatsDays)).toEqual([7, 14, 30, 90]);
    for (const raw of [undefined, '', '8', '365', 'abc', '07x', ['7'], 30]) {
      expect(trackStatsDays(raw)).toBe(14);
    }
  });

  it('links to another period, the default without a query', () => {
    expect(statsHref('sql-30-days', 30, 14)).toBe('/tracks/sql-30-days/stats?days=30');
    expect(statsHref('sql-30-days', 14, 14)).toBe('/tracks/sql-30-days/stats');
  });
});

describe('change and changeText', () => {
  it('compares with the previous period and says whether it is good news', () => {
    expect(change(8, 5)).toEqual({ diff: 3, tone: 'good' });
    expect(change(2, 5)).toEqual({ diff: -3, tone: 'bad' });
    expect(change(4, 4)).toEqual({ diff: 0, tone: 'same' });
    // waiting times: shorter is better
    expect(change(10.2, 12, false)).toEqual({ diff: -1.8, tone: 'good' });
    expect(change(null, 12)).toBeNull();
    expect(change(3, null)).toBeNull();
  });

  it('writes the sign, the Vietnamese decimal comma and the unit', () => {
    expect(changeText({ diff: 3, tone: 'good' })).toBe('+3 so với kỳ trước');
    expect(changeText({ diff: -1.5, tone: 'good' }, 'giờ')).toBe('−1,5 giờ so với kỳ trước');
    expect(changeText({ diff: 0, tone: 'same' })).toBe('Bằng kỳ trước');
  });
});

describe('niceTicks', () => {
  it('uses round steps of 1, 2 or 5 and reaches the largest value', () => {
    expect(niceTicks(3)).toEqual([0, 1, 2, 3]);
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(45)).toEqual([0, 20, 40, 60]);
    expect(niceTicks(100)).toEqual([0, 50, 100]);
    expect(niceTicks(1)).toEqual([0, 1]);
  });

  it('never steps below one person, and still draws an axis when all is zero', () => {
    expect(niceTicks(2)).toEqual([0, 1, 2]);
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});

describe('biggestDrop', () => {
  it('finds the step that loses the most people, the first one against the start', () => {
    expect(biggestDrop([18, 10, 9], 20)).toEqual({ index: 1, before: 18, after: 10, lost: 8 });
    expect(biggestDrop([5, 4], 20)).toEqual({ index: 0, before: 20, after: 5, lost: 15 });
  });

  it('keeps the earliest of equal drops and ignores steps that gain people', () => {
    expect(biggestDrop([8, 6, 7, 5], 10)?.index).toBe(0);
    expect(biggestDrop([10, 12], 10)).toBeNull();
    expect(biggestDrop([], 0)).toBeNull();
  });
});

describe('itemSteps', () => {
  const item = (id: string, completed: number) => ({
    kind: 'lesson' as const,
    id,
    title: id,
    completed,
  });

  it('compares each item with the one before it, across chapters', () => {
    const [first, second] = itemSteps(
      [
        { slug: 'a', items: [item('l1', 10), item('l2', 6)] },
        { slug: 'b', items: [item('l3', 6), item('l4', 1)] },
      ],
      12,
    );
    expect(first.slug).toBe('a');
    expect(first.items.map((i) => [i.previous, i.keptPercent, i.highDrop])).toEqual([
      [12, 83, false],
      [10, 60, true], // lost 40%
    ]);
    expect(second.items.map((i) => [i.previous, i.keptPercent, i.highDrop])).toEqual([
      [6, 100, false],
      [6, 17, true],
    ]);
  });

  it('does not flag small numbers or divide by zero', () => {
    const [m] = itemSteps([{ items: [item('l1', 2), item('l2', 0), item('l3', 0)] }], 2);
    expect(m.items.map((i) => [i.keptPercent, i.highDrop])).toEqual([
      [100, false],
      [0, false], // 2 → 0 is below HIGH_DROP_MIN
      [null, false],
    ]);
  });
});

describe('chart labels', () => {
  it('names histogram buckets and week ranges', () => {
    expect(bucketLabel({ from: 25, to: 50 })).toBe('25–50%');
    expect(bucketLabel({ from: 100, to: 100 })).toBe('100%');
    expect(weekRange('2026-11-23')).toBe('23/11 – 29/11');
    expect(weekRange('2026-12-28')).toBe('28/12 – 03/01');
  });
});

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
