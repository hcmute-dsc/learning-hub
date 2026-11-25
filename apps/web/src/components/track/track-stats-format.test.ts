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
  });

  it('says which period has no number (no review in it)', () => {
    expect(change(null, 12, false)).toEqual({ diff: null, missing: 'current' });
    expect(change(3, null, false)).toEqual({ diff: null, missing: 'previous' });
    expect(change(null, null)).toEqual({ diff: null, missing: 'both' });
    expect(changeText(change(null, 12), 'giờ', 'review')).toBe('Kỳ này chưa có review');
    expect(changeText(change(3, null), 'giờ', 'review')).toBe('Kỳ trước chưa có review');
    expect(changeText(change(null, null))).toBe('Cả hai kỳ chưa có số liệu');
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
  it('compares each count with the one just before it, never the first one', () => {
    // started chapter 1..4: 30 → 24 → 11 → 9
    expect(biggestDrop([30, 24, 11, 9])).toEqual({ index: 2, before: 24, after: 11, lost: 13 });
    expect(biggestDrop([5])).toBeNull();
  });

  it('keeps the earliest of equal drops and ignores steps that gain people', () => {
    expect(biggestDrop([8, 6, 7, 5])?.index).toBe(1);
    expect(biggestDrop([10, 12])).toBeNull();
    expect(biggestDrop([])).toBeNull();
  });
});

describe('itemSteps', () => {
  const lesson = (id: string, completed: number) => ({
    kind: 'lesson' as const,
    id,
    title: id,
    completed,
  });
  const exercise = (id: string, completed: number) => ({
    ...lesson(id, completed),
    kind: 'exercise' as const,
  });
  const steps = (m: {
    items: { previous: number | null; keptPercent: number | null; highDrop: boolean }[];
  }) => m.items.map((i) => [i.previous, i.keptPercent, i.highDrop]);

  it('compares lessons with lessons and exercises with exercises, inside a chapter', () => {
    const [first, second] = itemSteps([
      // few people tick lessons, many do the exercises: no fake "gain" or "drop" between kinds
      {
        slug: 'a',
        items: [lesson('l1', 10), lesson('l2', 6), exercise('x1', 20), exercise('x2', 12)],
      },
      { slug: 'b', items: [lesson('l3', 6), lesson('l4', 1)] },
    ]);
    expect(first.slug).toBe('a');
    expect(steps(first)).toEqual([
      [null, null, false], // first lesson of the chapter
      [10, 60, true], // lost 40%
      [null, null, false], // first exercise: not against lesson l2
      [20, 60, true],
    ]);
    // a new chapter starts over
    expect(steps(second)).toEqual([
      [null, null, false],
      [6, 17, true],
    ]);
  });

  it('keeps a share above 100% (more people) and never flags it as a drop', () => {
    const [m] = itemSteps([{ items: [lesson('l1', 4), lesson('l2', 9)] }]);
    expect(steps(m)[1]).toEqual([4, 225, false]);
  });

  it('does not flag small numbers or divide by zero', () => {
    const [m] = itemSteps([{ items: [lesson('l1', 2), lesson('l2', 0), lesson('l3', 0)] }]);
    expect(m.items.map((i) => [i.keptPercent, i.highDrop])).toEqual([
      [null, false],
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
