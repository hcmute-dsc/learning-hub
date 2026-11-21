import { z } from 'zod';
import type { Achievements } from './achievements';
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

/**
 * PUT /api/v1/me/settings → { data: Me }. Send only what changed; at least one field.
 * showAchievements: false hides badges and the streak on the dashboard and the profile (F12).
 * leaderboardOptIn: true shows the member on the term leaderboard (E14); false removes them at once.
 */
export const settingsUpdateSchema = z
  .object({
    theme: z.enum(THEMES).optional(),
    showAchievements: z.boolean().optional(),
    leaderboardOptIn: z.boolean().optional(),
  })
  .strict()
  .refine((input) => Object.values(input).some((v) => v !== undefined), {
    message: 'Nothing to update',
  });
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
  /** badges and streak; null when the member hid them in /settings (F12) */
  achievements: Achievements | null;
  /** last ACTIVITY_WEEKS weeks, oldest first, one entry per day (zeros included) */
  activity: ActivityDay[];
  tracks: TrackProgress[];
}

/** How many weeks the activity grid on the profile shows. */
export const ACTIVITY_WEEKS = 20;
