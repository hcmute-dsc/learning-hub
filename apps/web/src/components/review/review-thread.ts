import { REVIEW_MESSAGE_MAX, REVIEW_THANKS_MAX, type ThreadRole } from '@hub/shared';

/**
 * Pure helpers for the conversation under a finished review (learning-hub#41),
 * tested in review-thread.test.ts.
 */

/** How each person is labelled next to their message. */
export const THREAD_ROLE_LABEL: Record<ThreadRole, string> = {
  mentee: 'Thành viên',
  mentor: 'Mentor',
  admin: 'Admin',
};

/** Error shown under a message box, or null when it can be sent (the API checks again). */
export function messageError(text: string): string | null {
  const body = text.trim();
  if (!body) return 'Hãy viết nội dung tin nhắn.';
  if (body.length > REVIEW_MESSAGE_MAX) return `Tin nhắn dài tối đa ${REVIEW_MESSAGE_MAX} ký tự.`;
  return null;
}

export function thanksError(text: string): string | null {
  const body = text.trim();
  if (!body) return 'Hãy viết vài lời cảm ơn.';
  if (body.length > REVIEW_THANKS_MAX) return `Lời cảm ơn dài tối đa ${REVIEW_THANKS_MAX} ký tự.`;
  return null;
}

/** The heading of the conversation, as seen by one side. */
export function threadTitle(role: ThreadRole, count: number): string {
  const who = role === 'mentee' ? 'Trao đổi với mentor' : 'Trao đổi với thành viên';
  return count > 0 ? `${who} (${count})` : who;
}
