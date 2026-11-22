import type { ReportGroup, ReportMemberRow, ReportStats } from '@hub/shared';

/**
 * Turns per-enrollment facts (read by ReportsRepository) into the report's numbers.
 * Pure functions, tested in report-stats.spec.ts.
 */

/** One learner's enrollment in one track, counted for one period. */
export interface MemberFact {
  userId: string;
  githubLogin: string;
  trackId: string;
  trackSlug: string;
  trackTitle: string;
  cohort: string | null;
  enrolledAt: Date;
  /** set only when the track was completed before the end of the period */
  completedAt: Date | null;
  lessonsInPeriod: number;
  lessonsDone: number;
  lessonsTotal: number;
  exercisesInPeriod: number;
  exercisesDone: number;
  exercisesTotal: number;
  awaitingReview: number;
  /** marked a lesson or submitted during the period */
  activeInPeriod: boolean;
  lastActiveAt: Date | null;
}

/** A review concluded in the period, on a submission of `userId` in `trackId`. */
export interface ReviewFact {
  userId: string;
  trackId: string;
  reviewerId: string;
  /** from submission to conclusion */
  hours: number;
}

/** Trial criterion 1 (CRITIQUE §6): a learner who did at least this many exercises. */
export const ACTIVE_LEARNER_EXERCISES = 5;

/** Middle value (mean of the two middle ones for an even count); null for none. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** part / whole as a whole percent; 0 when there is nothing to divide by. */
export function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

const oneDecimal = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);
const sum = (facts: MemberFact[], pick: (f: MemberFact) => number) =>
  facts.reduce((total, f) => total + pick(f), 0);

/**
 * Numbers for a set of enrollments. People are counted once even when they are in two of
 * the tracks (enrolled, active, atLeastFive). Only reviews of these enrollments count.
 */
export function stats(facts: MemberFact[], reviews: ReviewFact[]): ReportStats {
  const exercisesByUser = new Map<string, number>();
  const activeUsers = new Set<string>();
  for (const f of facts) {
    exercisesByUser.set(f.userId, (exercisesByUser.get(f.userId) ?? 0) + f.exercisesDone);
    if (f.activeInPeriod) activeUsers.add(f.userId);
  }
  const enrolled = exercisesByUser.size;
  const atLeastFive = [...exercisesByUser.values()].filter(
    (n) => n >= ACTIVE_LEARNER_EXERCISES,
  ).length;
  const completedTrack = facts.filter((f) => f.completedAt).length;

  const keys = new Set(facts.map((f) => `${f.userId}:${f.trackId}`));
  const ours = reviews.filter((r) => keys.has(`${r.userId}:${r.trackId}`));
  const hours = ours.map((r) => r.hours);

  return {
    enrolled,
    active: activeUsers.size,
    lessonsCompleted: sum(facts, (f) => f.lessonsInPeriod),
    exercisesCompleted: sum(facts, (f) => f.exercisesInPeriod),
    atLeastFive,
    atLeastFiveRate: percent(atLeastFive, enrolled),
    completedTrack,
    completionRate: percent(completedTrack, facts.length),
    awaitingReview: sum(facts, (f) => f.awaitingReview),
    reviewsDone: ours.length,
    reviewHoursMedian: oneDecimal(median(hours)),
    reviewHoursMax: oneDecimal(hours.length ? Math.max(...hours) : null),
    reviewers: new Set(ours.map((r) => r.reviewerId)).size,
  };
}

/** Stable order for tables: track title, then cohort (no cohort last), then login. */
export function compareFacts(a: MemberFact, b: MemberFact): number {
  return (
    a.trackTitle.localeCompare(b.trackTitle, 'vi') ||
    compareCohorts(a.cohort, b.cohort) ||
    a.githubLogin.localeCompare(b.githubLogin)
  );
}

function compareCohorts(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b, 'vi');
}

/** One row per track + cohort, in table order. */
export function groupStats(facts: MemberFact[], reviews: ReviewFact[]): ReportGroup[] {
  const groups = new Map<string, MemberFact[]>();
  for (const f of [...facts].sort(compareFacts)) {
    const key = JSON.stringify([f.trackId, f.cohort]);
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  return [...groups.values()].map((members) => ({
    track: { slug: members[0].trackSlug, title: members[0].trackTitle },
    cohort: members[0].cohort,
    ...stats(members, reviews),
  }));
}

/** "Người học 007": the same person keeps one alias across tracks in one export. */
export function anonymousName(n: number): string {
  return `Người học ${String(n).padStart(3, '0')}`;
}

/**
 * The per-member table, in table order. With `anonymize`, logins become numbered aliases
 * (for a report shared outside the club board).
 */
export function memberRows(facts: MemberFact[], anonymize = false): ReportMemberRow[] {
  const aliases = new Map<string, string>();
  return [...facts].sort(compareFacts).map((f) => {
    if (anonymize && !aliases.has(f.userId)) {
      aliases.set(f.userId, anonymousName(aliases.size + 1));
    }
    return {
      githubLogin: anonymize ? aliases.get(f.userId)! : f.githubLogin,
      trackSlug: f.trackSlug,
      cohort: f.cohort,
      enrolledAt: f.enrolledAt.toISOString(),
      lessonsInPeriod: f.lessonsInPeriod,
      lessonsDone: f.lessonsDone,
      lessonsTotal: f.lessonsTotal,
      exercisesInPeriod: f.exercisesInPeriod,
      exercisesDone: f.exercisesDone,
      exercisesTotal: f.exercisesTotal,
      awaitingReview: f.awaitingReview,
      lastActiveAt: f.lastActiveAt?.toISOString() ?? null,
      completedAt: f.completedAt?.toISOString() ?? null,
    };
  });
}
