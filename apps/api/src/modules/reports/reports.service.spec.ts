import type { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainError } from '../../common/errors';
import type { Clock } from '../../infrastructure/clock';
import type { MemberFact } from './report-stats';
import { ReportEvents } from './reports.events';
import type { ReportFilter, ReportsRepository } from './reports.repository';
import { ReportsService } from './reports.service';

const NOW = new Date('2026-11-25T05:00:00Z'); // Wednesday 25/11/2026, 12:00 in Vietnam

const fact = (over: Partial<MemberFact>): MemberFact => ({
  userId: 'u1',
  githubLogin: 'an',
  trackId: 't-sql',
  trackSlug: 'sql-30-days',
  trackTitle: 'SQL 30 ngày',
  cohort: 'sql-2026',
  enrolledAt: new Date('2026-11-23T02:00:00Z'),
  completedAt: null,
  lessonsInPeriod: 2,
  lessonsDone: 2,
  lessonsTotal: 30,
  exercisesInPeriod: 1,
  exercisesDone: 1,
  exercisesTotal: 33,
  awaitingReview: 0,
  activeInPeriod: true,
  lastActiveAt: new Date('2026-11-24T03:00:00Z'),
  ...over,
});

function setup() {
  const filters: ReportFilter[] = [];
  const repo = {
    tracks: async () => [{ id: 't-sql', slug: 'sql-30-days', title: 'SQL 30 ngày' }],
    cohorts: async () => ['sql-2026'],
    memberFacts: async (f: ReportFilter) => {
      filters.push(f);
      return [fact({}), fact({ userId: 'u2', githubLogin: '=evil', activeInPeriod: false })];
    },
    reviewFacts: async () => [],
  } as unknown as ReportsRepository;
  const emitted: [string, unknown][] = [];
  const events = { emit: (name: string, e: unknown) => emitted.push([name, e]) };
  const clock = { now: () => NOW } as Clock;
  const service = new ReportsService(repo, clock, events as unknown as EventEmitter2);
  return { service, filters, emitted };
}

describe('ReportsService', () => {
  it('reports this week by default, with the filter menus', async () => {
    const { service, filters } = setup();
    const report = await service.report({});
    expect(report.period).toEqual({
      from: '2026-11-23',
      to: '2026-11-25',
      startsAt: '2026-11-22T17:00:00.000Z',
      endsAt: '2026-11-25T17:00:00.000Z',
    });
    expect(report.filters).toEqual({ track: null, cohort: null });
    expect(report.options).toEqual({
      tracks: [{ slug: 'sql-30-days', title: 'SQL 30 ngày' }],
      cohorts: ['sql-2026'],
    });
    expect(report.total).toMatchObject({ enrolled: 2, active: 1, lessonsCompleted: 4 });
    expect(report.groups).toHaveLength(1);
    expect(report.members.map((m) => m.githubLogin)).toEqual(['=evil', 'an']);
    expect(filters[0]).toMatchObject({ trackId: undefined, cohort: undefined });
  });

  it('passes the track id and cohort to the queries', async () => {
    const { service, filters } = setup();
    await service.report({ track: 'sql-30-days', cohort: '-' });
    expect(filters[0]).toMatchObject({ trackId: 't-sql', cohort: '-' });
  });

  it('refuses an unknown track and an impossible period', async () => {
    const { service } = setup();
    await expect(service.report({ track: 'nope' })).rejects.toMatchObject({ status: 404 });
    await expect(service.report({ from: '2026-11-25', to: '2026-11-01' })).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it('exports the members table as escaped CSV and audits counts only', async () => {
    const { service, emitted } = setup();
    const file = await service.exportCsv('admin-1', {
      table: 'members',
      from: '2026-11-23',
      to: '2026-11-29',
    });
    expect(file.fileName).toBe('bao-cao-thanh-vien_tat-ca_2026-11-23_2026-11-29.csv');
    const lines = file.body.split('\r\n');
    expect(lines[0].startsWith('﻿Từ ngày,Đến ngày,GitHub,')).toBe(true);
    expect(lines[1]).toBe(
      "2026-11-23,2026-11-29,'=evil,sql-30-days,sql-2026,2026-11-23,2,2,30,1,1,33,0,2026-11-24 10:00,",
    );
    expect(emitted).toEqual([
      [
        ReportEvents.Exported,
        {
          actorId: 'admin-1',
          table: 'members',
          from: '2026-11-23',
          to: '2026-11-29',
          track: null,
          cohort: null,
          anonymized: false,
          rows: 2,
        },
      ],
    ]);
    expect(JSON.stringify(emitted)).not.toContain('evil');
  });

  it('anonymizes the logins on request', async () => {
    const { service, emitted } = setup();
    const file = await service.exportCsv('admin-1', { table: 'members', anonymize: 'true' });
    expect(file.body).toContain('Người học 001');
    expect(file.body).not.toMatch(/evil|,an,/);
    expect(emitted[0][1]).toMatchObject({ anonymized: true });
  });

  it('exports the summary with a total row', async () => {
    const { service, emitted } = setup();
    const file = await service.exportCsv('admin-1', { table: 'summary', track: 'sql-30-days' });
    const lines = file.body.trimEnd().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain(',SQL 30 ngày,sql-2026,2,1,');
    expect(lines[2]).toContain(',Tổng,,2,1,');
    expect(file.fileName).toContain('bao-cao-tong-hop_sql-30-days_');
    expect(emitted[0][1]).toMatchObject({ table: 'summary', track: 'sql-30-days', rows: 2 });
  });
});
