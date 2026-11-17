import { z } from 'zod';
import type { Role } from './index';
import type { TrackProgress } from './learning';

/**
 * API contract for member profiles and personal settings (added 17/11/2026).
 * Every response body is `{ data: ... }`.
 */

/** Color scheme: "system" follows the device; the others force one scheme. */
export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export const DISPLAY_NAME_MAX = 60;
export const BIO_MAX = 280;

/** PATCH /api/v1/me/profile → { data: Me } */
export const profileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX),
    /** empty string clears the bio */
    bio: z
      .string()
      .trim()
      .max(BIO_MAX)
      .transform((b) => (b === '' ? null : b)),
  })
  .strict();
export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;

/** PUT /api/v1/me/settings → { data: Me } */
export const settingsUpdateSchema = z.object({ theme: z.enum(THEMES) }).strict();
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;

/** Number of learning actions (lessons completed + submissions) on one day. */
export interface ActivityDay {
  /** YYYY-MM-DD in Vietnam time */
  date: string;
  count: number;
}

export interface LearningStats {
  lessonsCompleted: number;
  exercisesCompleted: number;
  tracksCompleted: number;
  /** days with at least one action, over the whole history */
  activeDays: number;
  /** consecutive active days ending today (or yesterday, so the streak survives until tonight) */
  currentStreak: number;
  longestStreak: number;
}

/**
 * GET /api/v1/members/:login → { data: MemberProfile }
 * Visible to every signed-in, approved club member. Never contains the email.
 */
export interface MemberProfile {
  githubLogin: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  roles: Role[];
  /** ISO date-time the account was created */
  joinedAt: string;
  /** true when the viewer is looking at their own profile */
  isMe: boolean;
  stats: LearningStats;
  /** last ACTIVITY_WEEKS weeks, oldest first, one entry per day (zeros included) */
  activity: ActivityDay[];
  tracks: TrackProgress[];
}

/** How many weeks the activity grid on the profile shows. */
export const ACTIVITY_WEEKS = 20;
