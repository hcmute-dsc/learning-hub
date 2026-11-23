import { REVIEW_THREAD_MAX_MESSAGES, type Role, type ThreadRole } from '@hub/shared';
import { DomainError } from '../../common/errors';

/**
 * Pure rules of the conversation on a finished review (learning-hub#41), tested in
 * review-thread-rules.spec.ts. Only three kinds of people are in a conversation: the
 * member who submitted, the mentor who reviewed, and admins. Other mentors are not:
 * the member wrote to one mentor, not to the whole club.
 */

interface Viewer {
  id: string;
  roles: Role[];
}

/** The two people a review is between. */
export interface ThreadParties {
  memberId: string;
  reviewerId: string;
}

/** The viewer's place in the conversation, or null when they are not part of it. */
export function threadRole(viewer: Viewer, parties: ThreadParties): ThreadRole | null {
  if (viewer.id === parties.memberId) return 'mentee';
  if (viewer.id === parties.reviewerId) return 'mentor';
  if (viewer.roles.includes('admin')) return 'admin';
  return null;
}

/**
 * The role shown next to a message. Only the member, the mentor and admins can post, so
 * anyone else who wrote is an admin (an admin who submitted the work is the mentee).
 */
export function authorRole(authorId: string, parties: ThreadParties): ThreadRole {
  if (authorId === parties.memberId) return 'mentee';
  if (authorId === parties.reviewerId) return 'mentor';
  return 'admin';
}

/** 403 for anyone outside the conversation; otherwise their role. */
export function assertCanRead(viewer: Viewer, parties: ThreadParties): ThreadRole {
  const role = threadRole(viewer, parties);
  if (!role) throw DomainError.forbidden('Bạn không xem được trao đổi của review này.');
  return role;
}

/** A review still `in_progress` is the mentor's draft: there is nothing to answer yet. */
export function isFinished(status: string): boolean {
  return status === 'approved' || status === 'changes_requested';
}

/** Why a new message is refused, or null when it may be posted. */
export function postBlocker(status: string, messageCount: number): string | null {
  if (!isFinished(status)) return 'Trao đổi mở sau khi mentor hoàn thành review.';
  if (messageCount >= REVIEW_THREAD_MAX_MESSAGES) {
    return `Trao đổi này đã đủ ${REVIEW_THREAD_MAX_MESSAGES} tin nhắn. Hãy nhắn mentor qua Discord.`;
  }
  return null;
}

/** POST a message: someone in the conversation, on a finished review that is not full. */
export function assertCanPost(
  viewer: Viewer,
  parties: ThreadParties,
  review: { status: string; messageCount: number },
): ThreadRole {
  const role = assertCanRead(viewer, parties);
  const blocker = postBlocker(review.status, review.messageCount);
  if (blocker) throw DomainError.conflict(blocker);
  return role;
}

/** Only the member thanks, once, and only for a finished review. */
export function canThank(role: ThreadRole, status: string, alreadyThanked: boolean): boolean {
  return role === 'mentee' && isFinished(status) && !alreadyThanked;
}

export function assertCanThank(
  viewer: Viewer,
  parties: ThreadParties,
  review: { status: string; alreadyThanked: boolean },
): void {
  const role = assertCanRead(viewer, parties);
  if (role !== 'mentee') {
    throw DomainError.forbidden('Chỉ thành viên đã nộp bài mới gửi lời cảm ơn được.');
  }
  if (!isFinished(review.status)) {
    throw DomainError.conflict('Hãy chờ mentor hoàn thành review rồi cảm ơn nhé.');
  }
  if (review.alreadyThanked) throw DomainError.conflict('Bạn đã cảm ơn mentor cho review này rồi.');
}

/** Showing a note on a profile is the mentor's own choice: not even an admin decides it. */
export function assertCanSetThanksVisibility(viewer: Viewer, parties: ThreadParties): void {
  if (viewer.id !== parties.reviewerId) {
    throw DomainError.forbidden('Chỉ mentor nhận lời cảm ơn mới chọn hiện nó trên hồ sơ được.');
  }
}

/**
 * Who gets a bell notification for a new message: the member and the mentor, except the
 * one who wrote it. Admins who join in are not notified (they read when they choose to).
 */
export function messageRecipients(authorId: string, parties: ThreadParties): string[] {
  return [...new Set([parties.memberId, parties.reviewerId])].filter((id) => id !== authorId);
}
