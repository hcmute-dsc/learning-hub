import { z } from 'zod';

/**
 * API contract for the in-app bell and the email digest (learning-hub#49, PRD F13).
 */

export const NOTIFICATION_TYPES = [
  'review_completed',
  'review_requested',
  'track_published',
  'review_message',
  'review_thanks',
  /** a content report the member sent was resolved or dismissed (learning-hub#121) */
  'content_report',
  /** an admin gave, changed or removed a mentee's mentor in a track (learning-hub#131) */
  'mentor_assignment',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** One line in the bell. `link` is a path inside the web app, e.g. /exercises/<id>. */
export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string;
  read: boolean;
  createdAt: string;
}

/** GET /api/v1/me/notifications → { data, unreadCount } */
export interface NotificationList {
  data: NotificationItem[];
  unreadCount: number;
}

/** GET /api/v1/me/notifications/settings → { data } */
export interface NotificationSettings {
  emailDigest: boolean;
  /** false when the server has no SMTP settings: the toggle is shown but disabled */
  emailAvailable: boolean;
  /** false when the account has no email address from GitHub */
  hasEmail: boolean;
}

/** PUT /api/v1/me/notifications/settings */
export const notificationSettingsUpdateSchema = z.object({ emailDigest: z.boolean() }).strict();
export type NotificationSettingsUpdate = z.infer<typeof notificationSettingsUpdateSchema>;

/** POST /api/v1/notifications/unsubscribe (public: the token is the credential) */
export const unsubscribeSchema = z
  .object({ token: z.string().regex(/^[A-Za-z0-9_-]{32,64}$/) })
  .strict();
export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>;
