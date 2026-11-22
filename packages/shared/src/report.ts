import { z } from 'zod';
import { TRACK_SLUG_PATTERN } from './review';

/**
 * Progress report per track and cohort (đợt) for `/admin/reports` (learning-hub#34,
 * INFORMATION-ARCHITECTURE §9). Admin only. Counted on the fly, nothing is stored.
 * Numbers follow the weekly trial metrics M1–M8 of learning-hub-docs `docs/ops/TRIAL-P0.md`.
 */

/** A day in Vietnam time, "YYYY-MM-DD". */
export const REPORT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Longest period one report may cover (a school year fits). */
export const REPORT_MAX_DAYS = 366;

/** `?cohort=` value for enrollments without a cohort label. */
export const REPORT_NO_COHORT = '-';

/** The two tables a CSV export can hold. */
export const REPORT_TABLES = ['summary', 'members'] as const;
export type ReportTable = (typeof REPORT_TABLES)[number];

const day = z.string().regex(REPORT_DATE_PATTERN, 'Ngày phải có dạng YYYY-MM-DD');

/** GET /api/v1/admin/reports?from=&to=&track=&cohort=  (admin only) */
export const reportQuerySchema = z
  .object({
    /** first day, included (default: Monday of the current week) */
    from: day.optional(),
    /** last day, included (default: today) */
    to: day.optional(),
    /** track slug; all tracks when absent */
    track: z.string().max(80).regex(TRACK_SLUG_PATTERN).optional(),
    /** cohort label, or REPORT_NO_COHORT; all cohorts when absent */
    cohort: z.string().trim().min(1).max(40).optional(),
  })
  .strict();
export type ReportQuery = z.infer<typeof reportQuerySchema>;

/** GET /api/v1/admin/reports/export?...&table=members&anonymize=true → text/csv */
export const reportExportQuerySchema = reportQuerySchema
  .extend({
    table: z.enum(REPORT_TABLES),
    /** replace GitHub logins with "Người học 001"… (for sharing outside the board) */
    anonymize: z.enum(['true', 'false']).optional(),
  })
  .strict();
export type ReportExportQuery = z.infer<typeof reportExportQuerySchema>;

/** Numbers for one track + cohort (or for everything shown, in `total`). */
export interface ReportStats {
  /** M1: learners enrolled by the end of the period (people) */
  enrolled: number;
  /** M2: learners who marked a lesson or submitted in the period (people) */
  active: number;
  /** M3: lessons marked done in the period */
  lessonsCompleted: number;
  /** M4: exercises completed for the first time in the period */
  exercisesCompleted: number;
  /** M5: learners with at least 5 exercises done by the end of the period (people) */
  atLeastFive: number;
  /** atLeastFive / enrolled, 0–100 (trial criterion 1) */
  atLeastFiveRate: number;
  /** enrollments that completed the track by the end of the period */
  completedTrack: number;
  /** completedTrack / enrollments, 0–100 */
  completionRate: number;
  /** M6: submissions waiting for a mentor right now (not limited to the period) */
  awaitingReview: number;
  /** reviews concluded in the period */
  reviewsDone: number;
  /** M7: hours from submission to conclusion, median and longest; null without reviews */
  reviewHoursMedian: number | null;
  reviewHoursMax: number | null;
  /** M8: mentors who concluded at least one review in the period */
  reviewers: number;
}

export interface ReportGroup extends ReportStats {
  track: { slug: string; title: string };
  /** null = enrolled without a cohort label */
  cohort: string | null;
}

/** One enrollment of one learner. Only the GitHub login identifies the person (SECURITY: no email). */
export interface ReportMemberRow {
  githubLogin: string;
  trackSlug: string;
  cohort: string | null;
  enrolledAt: string;
  lessonsInPeriod: number;
  /** done by the end of the period, of `lessonsTotal` */
  lessonsDone: number;
  lessonsTotal: number;
  exercisesInPeriod: number;
  exercisesDone: number;
  exercisesTotal: number;
  awaitingReview: number;
  /** last lesson mark or submission before the end of the period */
  lastActiveAt: string | null;
  /** when the track was completed, if by the end of the period */
  completedAt: string | null;
}

/** GET /api/v1/admin/reports → { data: ProgressReport } */
export interface ProgressReport {
  period: {
    /** "YYYY-MM-DD", Vietnam days, both included */
    from: string;
    to: string;
    /** the same period as instants: [startsAt, endsAt) */
    startsAt: string;
    endsAt: string;
  };
  filters: { track: string | null; cohort: string | null };
  /** values for the filter menus */
  options: { tracks: { slug: string; title: string }[]; cohorts: string[] };
  groups: ReportGroup[];
  total: ReportStats;
  members: ReportMemberRow[];
}
