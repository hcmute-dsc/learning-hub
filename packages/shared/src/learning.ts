import { z } from 'zod';
import type { ExerciseType, SubmissionStatus } from './index';

/**
 * API contract for E4 (learning) and E5 (exercises & submissions).
 * The api implements these shapes and the web consumes them; change both together.
 * Every response body is `{ data: ... }` (lists: `{ data: [...] }`).
 */

// ------------------------------------------------------------------ exercise state

/**
 * What a member sees on an exercise (FRONTEND-DESIGN §4). Derived from submissions,
 * never stored. Rules live in apps/api/src/modules/submissions/exercise-state.ts.
 */
export const EXERCISE_STATES = [
  'locked', // a prerequisite exercise is not completed yet
  'not_started',
  'attempted', // tried, not passed yet (quiz below passScore, failed test)
  'testing', // submitted, waiting for automatic checks (code exercises, E6)
  'in_review', // waiting for a mentor (project exercises)
  'needs_changes', // mentor asked for changes
  'completed',
] as const;
export type ExerciseState = (typeof EXERCISE_STATES)[number];

/** Lesson progress of one member, stored in lesson_progress (DATABASE §3.11). */
export const LESSON_STATUSES = ['not_started', 'in_progress', 'completed'] as const;
export type LessonStatus = (typeof LESSON_STATUSES)[number];

/** Exercise difficulty from the content repo (CONTENT-SPECIFICATION). */
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface ItemRef {
  id: string;
  title: string;
}

// ------------------------------------------------------------------ E4: enrollment & progress

/** POST /api/v1/tracks/:slug/enrollments  body (optional): { cohort } → 201 new, 200 existing */
export const enrollSchema = z
  .object({ cohort: z.string().trim().min(1).max(40).optional() })
  .strict()
  .default({});
export type EnrollInput = z.infer<typeof enrollSchema>;

/** Counts for one track and one member. */
export interface ProgressCount {
  done: number;
  total: number;
}

/**
 * The next thing to open in a track ("Tiếp tục học"): the first item not done, skipping
 * locked exercises unless only locked ones are left. null only when nothing is left to do.
 */
export interface NextItem {
  kind: 'lesson' | 'exercise';
  id: string;
  title: string;
}

/** GET /api/v1/me/enrollments → { data: TrackProgress[] } (only active/completed enrollments) */
export interface TrackProgress {
  trackId: string;
  slug: string;
  title: string;
  status: 'active' | 'completed';
  cohort: string | null;
  enrolledAt: string;
  lessons: ProgressCount;
  exercises: ProgressCount;
  /** 0–100, (lessons.done + exercises.done) / (lessons.total + exercises.total) */
  percent: number;
  next: NextItem | null;
}

/**
 * GET /api/v1/tracks/:slug/progress → { data: TrackItemsProgress }
 * Status of every lesson and exercise in the track for the signed-in member
 * (works when not enrolled: then `enrolled` is false and lessons are `not_started`).
 */
export interface TrackItemsProgress {
  enrolled: boolean;
  /** true when the track has items and every one is completed, or the enrollment is stored as completed */
  completed: boolean;
  lessons: Record<string, LessonStatus>;
  exercises: Record<string, ExerciseState>;
  /** "Tiếp tục" target, same rule as TrackProgress.next */
  next: NextItem | null;
}

// ------------------------------------------------------------------ E4: lessons

/** GET /api/v1/lessons/:id → { data: LessonView } */
export interface LessonView {
  id: string;
  slug: string;
  title: string;
  /** Markdown from the content repo. The web MUST sanitize when rendering (SECURITY §3). */
  bodyMd: string;
  estMinutes: number | null;
  track: { slug: string; title: string };
  module: { slug: string; title: string };
  /** Reading order inside the track: lessons then exercises of each module, by position */
  previous: NextItem | null;
  next: NextItem | null;
  progress: LessonStatus;
  /** Exercises whose `lesson:` is this lesson */
  exercises: (ItemRef & { type: ExerciseType; state: ExerciseState })[];
  /** Source for "Sửa trên GitHub" links */
  source: { repo: string; commitSha: string; path: string };
}

/** PUT /api/v1/lessons/:id/progress  body → { data: { status } } (auto-enrolls in the track) */
export const lessonProgressSchema = z
  .object({ status: z.enum(['in_progress', 'completed']) })
  .strict();
export type LessonProgressInput = z.infer<typeof lessonProgressSchema>;

// ------------------------------------------------------------------ E5: exercises

/** Quiz question as sent to members: NEVER includes the answer. */
export type QuizQuestionView =
  | { id: string; type: 'single' | 'multiple'; prompt: string; options: string[] }
  | { id: string; type: 'short_text'; prompt: string };

/** GET /api/v1/exercises/:id → { data: ExerciseView } */
export interface ExerciseView {
  id: string;
  slug: string;
  title: string;
  type: ExerciseType;
  difficulty: Difficulty;
  statementMd: string;
  requiresReview: boolean;
  state: ExerciseState;
  /** Prerequisite exercises not completed yet (empty unless state = locked) */
  lockedBy: ItemRef[];
  track: { slug: string; title: string };
  module: { slug: string; title: string };
  lesson: ItemRef | null;
  attempts: number;
  /** Exactly one of these is set, matching `type` */
  quiz?: { passScore: number; questions: QuizQuestionView[] };
  selfCheck?: { checklist: string[] };
  project?: {
    deliverable: 'github_repo_or_pr' | 'link';
    rubric: { criterion: string; weight: number }[];
  };
  code?: {
    starterRepo: string | null;
    starterPath: string;
    submitKind: 'github_pr' | 'github_commit';
  };
}

/** POST /api/v1/exercises/:id/quiz-attempts  answers by question id */
export const quizAttemptSchema = z
  .object({
    answers: z.record(
      z.string().min(1).max(50),
      z.union([
        z.number().int().min(0),
        z.array(z.number().int().min(0)).max(50),
        z.string().max(500),
      ]),
    ),
  })
  .strict();
export type QuizAttemptInput = z.infer<typeof quizAttemptSchema>;

/** → { data: QuizResult } — answers are revealed only after an attempt */
export interface QuizResult {
  submissionId: string;
  attempt: number;
  score: number; // 0–1
  passed: boolean;
  questions: {
    id: string;
    correct: boolean;
    correctAnswer: number | number[] | string[];
    explanation: string | null;
  }[];
}

/**
 * POST /api/v1/exercises/:id/self-check  body: { confirmed: true } → completed.
 * Honour-based (USER-FLOWS): the API never sees the checklist, the web only uses it as a reminder.
 */
export const selfCheckSchema = z.object({ confirmed: z.literal(true) }).strict();
export type SelfCheckInput = z.infer<typeof selfCheckSchema>;

/**
 * POST /api/v1/exercises/:id/submissions  (code + project) — header `Idempotency-Key` (UUID) required.
 * code: a GitHub PR or commit URL in the member's own public repo; project: also any https link
 * when deliverable = link. → 202 { data: SubmissionView } (a retry with the same key → 200, same body)
 */
export const linkSubmissionSchema = z
  .object({
    url: z.string().trim().url().max(500),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();
export type LinkSubmissionInput = z.infer<typeof linkSubmissionSchema>;

/** GET /api/v1/submissions/:id, GET /api/v1/me/submissions?exerciseId= → SubmissionView(s) */
export interface SubmissionView {
  id: string;
  exerciseId: string;
  exerciseTitle: string;
  attempt: number;
  sourceType: 'github_pr' | 'github_commit' | 'quiz_answers' | 'self_check' | 'link';
  sourceUrl: string | null;
  note: string | null;
  status: SubmissionStatus;
  /** quiz only */
  score: number | null;
  submittedAt: string;
}
