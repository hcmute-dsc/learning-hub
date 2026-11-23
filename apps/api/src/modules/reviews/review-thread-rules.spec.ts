import { REVIEW_THREAD_MAX_MESSAGES, type Role } from '@hub/shared';
import { DomainError } from '../../common/errors';
import {
  assertCanPost,
  assertCanRead,
  assertCanSetThanksVisibility,
  assertCanThank,
  authorRole,
  canThank,
  messageRecipients,
  postBlocker,
  threadRole,
} from './review-thread-rules';

const parties = { memberId: 'member', reviewerId: 'mentor' };
const user = (id: string, ...roles: Role[]) => ({
  id,
  roles: roles.length ? roles : ['member' as Role],
});

const member = user('member');
const mentor = user('mentor', 'member', 'mentor');
const otherMentor = user('other', 'member', 'mentor');
const admin = user('boss', 'member', 'admin');
const stranger = user('someone');

function statusOf(fn: () => unknown): number | undefined {
  try {
    fn();
    return undefined;
  } catch (err) {
    if (err instanceof DomainError) return err.status;
    throw err;
  }
}

describe('who is in a review conversation (learning-hub#41)', () => {
  it('is the member, the mentor who reviewed, and admins', () => {
    expect(threadRole(member, parties)).toBe('mentee');
    expect(threadRole(mentor, parties)).toBe('mentor');
    expect(threadRole(admin, parties)).toBe('admin');
  });

  it('is not another mentor or another member', () => {
    expect(threadRole(otherMentor, parties)).toBeNull();
    expect(threadRole(stranger, parties)).toBeNull();
    expect(statusOf(() => assertCanRead(otherMentor, parties))).toBe(403);
    expect(statusOf(() => assertCanRead(stranger, parties))).toBe(403);
  });

  it('counts an admin who submitted the work as the mentee', () => {
    const adminMember = user('member', 'member', 'admin');
    expect(threadRole(adminMember, parties)).toBe('mentee');
    expect(authorRole('member', parties)).toBe('mentee');
    expect(authorRole('mentor', parties)).toBe('mentor');
    expect(authorRole('boss', parties)).toBe('admin');
  });
});

describe('posting a message', () => {
  const finished = { status: 'changes_requested', messageCount: 0 };

  it('is open to everyone in the conversation once the review is finished', () => {
    expect(assertCanPost(member, parties, finished)).toBe('mentee');
    expect(assertCanPost(mentor, parties, { ...finished, status: 'approved' })).toBe('mentor');
    expect(assertCanPost(admin, parties, finished)).toBe('admin');
  });

  it('is closed to people outside it (403)', () => {
    expect(statusOf(() => assertCanPost(otherMentor, parties, finished))).toBe(403);
  });

  it('waits for the mentor to finish the review (409)', () => {
    expect(postBlocker('in_progress', 0)).toMatch(/hoàn thành review/);
    expect(
      statusOf(() => assertCanPost(member, parties, { status: 'in_progress', messageCount: 0 })),
    ).toBe(409);
  });

  it('stops when the conversation is full (409)', () => {
    expect(postBlocker('approved', REVIEW_THREAD_MAX_MESSAGES - 1)).toBeNull();
    expect(postBlocker('approved', REVIEW_THREAD_MAX_MESSAGES)).not.toBeNull();
    const full = { status: 'approved', messageCount: REVIEW_THREAD_MAX_MESSAGES };
    expect(statusOf(() => assertCanPost(mentor, parties, full))).toBe(409);
  });
});

describe('thanking the mentor', () => {
  it('is only for the member, once, after the review', () => {
    expect(canThank('mentee', 'approved', false)).toBe(true);
    expect(canThank('mentee', 'approved', true)).toBe(false);
    expect(canThank('mentee', 'in_progress', false)).toBe(false);
    expect(canThank('mentor', 'approved', false)).toBe(false);
    expect(canThank('admin', 'approved', false)).toBe(false);
  });

  it('answers 403 to the mentor or an admin and 409 when too early or twice', () => {
    const ok = { status: 'approved', alreadyThanked: false };
    expect(statusOf(() => assertCanThank(member, parties, ok))).toBeUndefined();
    expect(statusOf(() => assertCanThank(mentor, parties, ok))).toBe(403);
    expect(statusOf(() => assertCanThank(admin, parties, ok))).toBe(403);
    expect(statusOf(() => assertCanThank(stranger, parties, ok))).toBe(403);
    expect(statusOf(() => assertCanThank(member, parties, { ...ok, status: 'in_progress' }))).toBe(
      409,
    );
    expect(statusOf(() => assertCanThank(member, parties, { ...ok, alreadyThanked: true }))).toBe(
      409,
    );
  });

  it('is shown on a profile only by the mentor who got it', () => {
    expect(statusOf(() => assertCanSetThanksVisibility(mentor, parties))).toBeUndefined();
    expect(statusOf(() => assertCanSetThanksVisibility(admin, parties))).toBe(403);
    expect(statusOf(() => assertCanSetThanksVisibility(member, parties))).toBe(403);
  });
});

describe('who is notified of a new message', () => {
  it('is the other side, never the author', () => {
    expect(messageRecipients('member', parties)).toEqual(['mentor']);
    expect(messageRecipients('mentor', parties)).toEqual(['member']);
  });

  it('is both sides when an admin writes, and admins are not notified', () => {
    expect(messageRecipients('boss', parties)).toEqual(['member', 'mentor']);
  });
});
