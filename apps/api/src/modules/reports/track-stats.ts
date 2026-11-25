import {
  TRACK_STATS_INACTIVE_DAYS,
  TRACK_STATS_INACTIVE_LIMIT,
  TRACK_STATS_TOP,
  TRACK_STATS_WEEKS,
  type ExerciseType,
  type HardExercise,
  type InactiveLearner,
  type Role,
  type SubmissionStatus,
  type TrackFunnelModule,
  type TrackStatsTotals,
  type TrackStatsWeek,
  type WaitingReview,
} from '@hub/shared';
import { dayStart, mondayOf } from './period';
import { percent, stats, type MemberFact, type ReviewFact } from './report-stats';

/**
 * Numbers of the track statistics page (learning-hub#118). Pure functions over rows read by
 * TrackStatsRepository and the report's MemberFacts, tested in track-stats.spec.ts.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Who may see a track's statistics: an admin sees every track; a mentor sees the tracks
 * where they have an active `mentor_assignments` row; nobody else.
 */
export function canViewTrackStats(roles: Role[], mentorsThisTrack: boolean): boolean {
  if (roles.includes('admin')) return true;
  return roles.includes('mentor') && mentorsThisTrack;
}

/** The totals, from the same facts and reviews as the progress report (`stats`). */
export function trackTotals(facts: MemberFact[], reviews: ReviewFact[]): TrackStatsTotals {
  const s = stats(facts, reviews);
  return {
    enrolled: s.enrolled,
    active: s.active,
    completed: s.completedTrack,
    completionRate: s.completionRate,
    awaitingReview: s.awaitingReview,
    reviewsDone: s.reviewsDone,
    reviewHoursMedian: s.reviewHoursMedian,
  };
}

/** Active modules of a track, in content order, with their active lessons and exercises. */
export interface OutlineModule {
  slug: string;
  title: string;
  lessons: { id: string; title: string }[];
  exercises: { id: string; title: string; type: ExerciseType }[];
}

/** A learner who completed a lesson or an exercise (by id). */
export interface DoneItem {
  userId: string;
  itemId: string;
}

/**
 * How many learners completed each module, lesson and exercise, in reading order, to see
 * where learners stop. A module counts as completed when every item of it is.
 */
export function funnel(outline: OutlineModule[], done: DoneItem[]): TrackFunnelModule[] {
  const usersByItem = new Map<string, Set<string>>();
  for (const d of done) {
    const users = usersByItem.get(d.itemId) ?? new Set<string>();
    users.add(d.userId);
    usersByItem.set(d.itemId, users);
  }
  const usersOf = (id: string) => usersByItem.get(id) ?? new Set<string>();

  return outline.map((m) => {
    const items = [
      ...m.lessons.map((l) => ({ kind: 'lesson' as const, id: l.id, title: l.title })),
      ...m.exercises.map((x) => ({ kind: 'exercise' as const, id: x.id, title: x.title })),
    ];
    let completed = 0;
    if (items.length > 0) {
      // Everyone who did all items is in the set of the first one, so start from there.
      for (const user of usersOf(items[0].id)) {
        if (items.every((item) => usersOf(item.id).has(user))) completed++;
      }
    }
    return {
      slug: m.slug,
      title: m.title,
      completed,
      items: items.map((item) => ({ ...item, completed: usersOf(item.id).size })),
    };
  });
}

/** Exercise types checked automatically; the others have no "failed" first attempt. */
export const AUTO_CHECKED_TYPES: ExerciseType[] = ['quiz', 'code'];

/**
 * What the automatic check said about an attempt: `failed`, `passed` (a passing code
 * exercise may then go to review, so the review statuses count as passed too), or null
 * while there is no result yet (submitted, testing) or the checker broke (errored).
 */
export function checkOutcome(status: SubmissionStatus): 'passed' | 'failed' | null {
  if (status === 'failed') return 'failed';
  if (
    status === 'passed' ||
    status === 'awaiting_review' ||
    status === 'approved' ||
    status === 'changes_requested'
  ) {
    return 'passed';
  }
  return null;
}

/** A learner's first attempt (attempt = 1) at an exercise of the track. */
export interface FirstAttempt {
  exerciseId: string;
  status: SubmissionStatus;
}

/**
 * Auto-checked exercises with the highest share of first attempts that failed, highest
 * first (then the most attempts, then content order). Exercises nobody tried are left out.
 */
export function hardestByFirstAttempt(
  outline: OutlineModule[],
  attempts: FirstAttempt[],
  limit = TRACK_STATS_TOP,
): HardExercise[] {
  const tally = new Map<string, { firstAttempts: number; failed: number }>();
  for (const a of attempts) {
    const outcome = checkOutcome(a.status);
    if (!outcome) continue;
    const t = tally.get(a.exerciseId) ?? { firstAttempts: 0, failed: 0 };
    t.firstAttempts++;
    if (outcome === 'failed') t.failed++;
    tally.set(a.exerciseId, t);
  }

  const rows: HardExercise[] = [];
  for (const m of outline) {
    for (const x of m.exercises) {
      const t = tally.get(x.id);
      if (!t || !AUTO_CHECKED_TYPES.includes(x.type)) continue;
      rows.push({
        id: x.id,
        title: x.title,
        moduleTitle: m.title,
        ...t,
        failRate: percent(t.failed, t.firstAttempts),
      });
    }
  }
  // Array.prototype.sort is stable, so equal rows keep content order.
  return rows
    .sort((a, b) => b.failRate - a.failRate || b.firstAttempts - a.firstAttempts)
    .slice(0, limit);
}

/** A learner's submission waiting for a mentor, as read (oldest first). */
export interface WaitingRow {
  submissionId: string;
  exerciseId: string;
  exerciseTitle: string;
  githubLogin: string;
  submittedAt: Date;
}

export function waitingReviews(rows: WaitingRow[], now: Date): WaitingReview[] {
  return rows.map((r) => ({
    submissionId: r.submissionId,
    exerciseId: r.exerciseId,
    exerciseTitle: r.exerciseTitle,
    githubLogin: r.githubLogin,
    submittedAt: r.submittedAt.toISOString(),
    hoursWaiting: Math.round(((now.getTime() - r.submittedAt.getTime()) / HOUR_MS) * 10) / 10,
  }));
}

/** Mondays ("YYYY-MM-DD", Vietnam time) of the last `weeks` weeks, oldest first, this one last. */
export function recentWeeks(now: Date, weeks = TRACK_STATS_WEEKS): string[] {
  const thisMonday = dayStart(mondayOf(now))!;
  const mondays: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    mondays.push(mondayOf(new Date(thisMonday.getTime() - i * 7 * DAY_MS)));
  }
  return mondays;
}

/** A moment a learner was active (marked a lesson or submitted). */
export interface ActivityAt {
  userId: string;
  at: Date;
}

/**
 * Enrollments and active learners per Vietnam week (Monday → Sunday). A learner active on
 * several days of a week counts once for that week. Moments outside the weeks are ignored.
 */
export function weekly(
  weeks: string[],
  enrollments: { enrolledAt: Date }[],
  activity: ActivityAt[],
): TrackStatsWeek[] {
  const enrolled = new Map(weeks.map((w) => [w, 0]));
  const active = new Map(weeks.map((w) => [w, new Set<string>()]));
  for (const e of enrollments) {
    const week = mondayOf(e.enrolledAt);
    if (enrolled.has(week)) enrolled.set(week, enrolled.get(week)! + 1);
  }
  for (const a of activity) active.get(mondayOf(a.at))?.add(a.userId);
  return weeks.map((w) => ({
    weekStart: w,
    enrolled: enrolled.get(w)!,
    active: active.get(w)!.size,
  }));
}

/**
 * Learners a mentor may want to check on: not completed, and no lesson mark or submission
 * for TRACK_STATS_INACTIVE_DAYS days or more. Never active first, then the longest quiet,
 * then by login.
 */
export function inactiveLearners(
  facts: MemberFact[],
  now: Date,
  limit = TRACK_STATS_INACTIVE_LIMIT,
): { total: number; learners: InactiveLearner[] } {
  const cutoff = now.getTime() - TRACK_STATS_INACTIVE_DAYS * DAY_MS;
  const quiet = facts
    .filter((f) => !f.completedAt && (!f.lastActiveAt || f.lastActiveAt.getTime() <= cutoff))
    .sort(
      (a, b) =>
        // never active = 0, older than any real moment
        (a.lastActiveAt?.getTime() ?? 0) - (b.lastActiveAt?.getTime() ?? 0) ||
        a.githubLogin.localeCompare(b.githubLogin),
    );
  return {
    total: quiet.length,
    learners: quiet.slice(0, limit).map((f) => {
      const itemsDone = f.lessonsDone + f.exercisesDone;
      const itemsTotal = f.lessonsTotal + f.exercisesTotal;
      return {
        githubLogin: f.githubLogin,
        enrolledAt: f.enrolledAt.toISOString(),
        itemsDone,
        itemsTotal,
        progress: percent(itemsDone, itemsTotal),
        lastActiveAt: f.lastActiveAt?.toISOString() ?? null,
      };
    }),
  };
}
