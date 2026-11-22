import { describe, expect, it } from 'vitest';
import {
  cohortLabel,
  cohortOptions,
  formatDay,
  formatHours,
  reportPresets,
  reportQueryFromParams,
  reportSearch,
  vietnamDay,
} from './report-format';

describe('reportQueryFromParams', () => {
  it('keeps well-formed filters', () => {
    expect(
      reportQueryFromParams({
        from: '2026-11-23',
        to: '2026-11-29',
        track: 'sql-30-days',
        cohort: 'sql-2026',
      }),
    ).toEqual({ from: '2026-11-23', to: '2026-11-29', track: 'sql-30-days', cohort: 'sql-2026' });
  });

  it('drops empty, malformed and repeated values', () => {
    expect(
      reportQueryFromParams({
        from: '23/11/2026',
        to: '',
        track: '../x',
        cohort: 'x'.repeat(41),
      }),
    ).toEqual({});
    expect(reportQueryFromParams({ track: ['sql-30-days', 'git'] })).toEqual({
      track: 'sql-30-days',
    });
  });
});

describe('reportSearch', () => {
  it('builds a query string without empty values', () => {
    expect(reportSearch({ from: '2026-11-23', track: undefined, cohort: 'đợt 1' })).toBe(
      '?from=2026-11-23&cohort=%C4%91%E1%BB%A3t+1',
    );
    expect(reportSearch({})).toBe('');
  });
});

describe('reportPresets', () => {
  // Wednesday 25/11/2026, 06:30 in Vietnam (still Tuesday in UTC)
  const now = new Date('2026-11-24T23:30:00Z');

  it('uses Vietnam days', () => {
    expect(vietnamDay(now)).toBe('2026-11-25');
  });

  it('offers this week, last week (Monday → Sunday), 30 days and this month', () => {
    expect(reportPresets(now)).toEqual([
      { label: 'Tuần này', from: '2026-11-23', to: '2026-11-25' },
      { label: 'Tuần trước', from: '2026-11-16', to: '2026-11-22' },
      { label: '30 ngày qua', from: '2026-10-27', to: '2026-11-25' },
      { label: 'Tháng này', from: '2026-11-01', to: '2026-11-25' },
    ]);
  });

  it('crosses the year on a Monday in early January', () => {
    const presets = reportPresets(new Date('2027-01-04T03:00:00Z'));
    expect(presets[1]).toEqual({ label: 'Tuần trước', from: '2026-12-28', to: '2027-01-03' });
  });
});

describe('labels', () => {
  it('names enrollments without a cohort and lists them last', () => {
    expect(cohortLabel(null)).toBe('Chưa gắn đợt');
    expect(cohortOptions(['sql-2026'])).toEqual([
      { value: 'sql-2026', label: 'sql-2026' },
      { value: '-', label: 'Chưa gắn đợt' },
    ]);
  });

  it('formats review hours and days the Vietnamese way', () => {
    expect(formatHours(null)).toBe('—');
    expect(formatHours(12.5)).toBe('12,5 giờ');
    expect(formatDay('2026-11-23')).toBe('23/11/2026');
  });
});
