import { z } from 'zod';

/** Roles — see docs/product/PRD.md §5 and SECURITY.md §2. */
export const ROLES = ['member', 'mentor', 'content_maintainer', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['pending', 'active', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const TRACK_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type TrackLevel = (typeof TRACK_LEVELS)[number];

export const EXERCISE_TYPES = ['code', 'quiz', 'project', 'self_check'] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const SUBMISSION_STATUSES = [
  'submitted',
  'testing',
  'passed',
  'failed',
  'awaiting_review',
  'approved',
  'changes_requested',
  'errored',
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Stable machine-readable error codes (BACKEND-DESIGN §3.6). */
export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'ACCOUNT_PENDING',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'UPSTREAM_ERROR',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** RFC 9457 problem+json body used by every API error. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: ErrorCode;
  detail?: string;
  errors?: { path: string; message: string }[];
  requestId?: string;
}

// ---------- Catalog ----------

/** Most tags one catalog request may filter by (`?tag=a&tag=b`). */
export const MAX_TAG_FILTERS = 10;

export const trackListQuerySchema = z.object({
  level: z.enum(TRACK_LEVELS).optional(),
  /**
   * `?tag=` may repeat. A single value arrives as a string, several as an array; both
   * become a deduplicated list. A track matches when it has ANY of the tags.
   */
  tag: z
    .preprocess(
      (value) => (Array.isArray(value) ? value : [value]),
      z
        .array(z.string().trim().min(1).max(40))
        .max(MAX_TAG_FILTERS)
        .transform((tags) => [...new Set(tags)]),
    )
    .optional(),
  q: z.string().trim().min(1).max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type TrackListQuery = z.infer<typeof trackListQuerySchema>;

export const trackSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  level: z.enum(TRACK_LEVELS),
  language: z.string(),
  estHours: z.number().int().nullable(),
  tags: z.array(z.string()),
  lessonCount: z.number().int(),
  exerciseCount: z.number().int(),
});
export type TrackSummary = z.infer<typeof trackSummarySchema>;

export interface OffsetPage {
  page: number;
  pageSize: number;
  total: number;
}

export interface Paginated<T> {
  data: T[];
  page: OffsetPage;
}

// ---------- Identity ----------

export const meSchema = z.object({
  id: z.string().uuid(),
  githubLogin: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().url().nullable(),
  status: z.enum(USER_STATUSES),
  roles: z.array(z.enum(ROLES)),
  bio: z.string().nullable(),
  /** color scheme picked in /settings (see profile.ts) */
  theme: z.enum(['system', 'light', 'dark']),
  /** false hides badges and the streak everywhere (F12, /settings) */
  showAchievements: z.boolean(),
});
export type Me = z.infer<typeof meSchema>;

export * from './learning';
export * from './admin';
export * from './profile';
export * from './review';
export * from './achievements';
export * from './notifications';
export * from './certificate';
