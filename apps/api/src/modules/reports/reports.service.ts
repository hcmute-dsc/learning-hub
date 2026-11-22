import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ProgressReport, ReportExportQuery, ReportQuery } from '@hub/shared';
import { DomainError } from '../../common/errors';
import { Clock } from '../../infrastructure/clock';
import { resolvePeriod } from './period';
import { exportFileName, membersCsv, summaryCsv } from './report-csv';
import { groupStats, memberRows, stats } from './report-stats';
import { ReportEvents, type ReportExportedEvent } from './reports.events';
import { ReportsRepository } from './reports.repository';

export interface CsvFile {
  fileName: string;
  body: string;
}

/**
 * Progress report per track and cohort for admins (learning-hub#34): the page, and the
 * same numbers as CSV. Every export is audited (who, which table and filters, how many
 * rows); the file itself is not kept.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly repo: ReportsRepository,
    private readonly clock: Clock,
    private readonly events: EventEmitter2,
  ) {}

  async report(query: ReportQuery, anonymize = false): Promise<ProgressReport> {
    const period = resolvePeriod(query, this.clock.now());
    if (!period) {
      throw new DomainError(
        'VALIDATION_FAILED',
        422,
        'Invalid period: "from" must not be after "to", and at most 366 days',
      );
    }
    const tracks = await this.repo.tracks();
    const track = query.track ? tracks.find((t) => t.slug === query.track) : undefined;
    if (query.track && !track) throw DomainError.notFound('Track');

    const filter = { ...period, trackId: track?.id, cohort: query.cohort };
    const [facts, reviews, cohorts] = await Promise.all([
      this.repo.memberFacts(filter),
      this.repo.reviewFacts(filter),
      this.repo.cohorts(),
    ]);
    return {
      period: {
        from: period.from,
        to: period.to,
        startsAt: period.startsAt.toISOString(),
        endsAt: period.endsAt.toISOString(),
      },
      filters: { track: track?.slug ?? null, cohort: query.cohort ?? null },
      options: { tracks: tracks.map(({ slug, title }) => ({ slug, title })), cohorts },
      groups: groupStats(facts, reviews),
      total: stats(facts, reviews),
      members: memberRows(facts, anonymize),
    };
  }

  /** One table as a CSV file, and an audit entry for it. */
  async exportCsv(actorId: string, query: ReportExportQuery): Promise<CsvFile> {
    const { table, anonymize, ...filters } = query;
    const anonymized = anonymize === 'true';
    const report = await this.report(filters, anonymized);
    const body = table === 'summary' ? summaryCsv(report) : membersCsv(report);
    const event: ReportExportedEvent = {
      actorId,
      table,
      from: report.period.from,
      to: report.period.to,
      track: report.filters.track,
      cohort: report.filters.cohort,
      anonymized,
      rows: table === 'summary' ? report.groups.length + 1 : report.members.length,
    };
    this.events.emit(ReportEvents.Exported, event);
    return { fileName: exportFileName(table, report), body };
  }
}
