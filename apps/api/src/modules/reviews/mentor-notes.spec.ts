import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../../common/auth.decorators';
import { REQUIRED_ROLES } from '../../common/auth.decorators';
import type { DomainError } from '../../common/errors';
import type { ExerciseContext } from '../catalog/catalog.reader';
import { checkAccess } from '../identity/auth.guard';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

/**
 * Mentor notes (mentor-notes.md, learning-hub#43) leave the API only through the mentor
 * review page. Members never get them: the route is mentor-only (admin always passes) and
 * the member's ExerciseView never carries them (views.spec.ts).
 */

const NOTES = 'MENTOR-NOTES: check the PR title';

const user = (roles: AuthUser['roles'], id = 'u-mentor'): AuthUser => ({
  id,
  githubLogin: 'someone',
  status: 'active',
  roles,
});

function codeOf(fn: () => void): string | undefined {
  try {
    fn();
    return undefined;
  } catch (e) {
    return (e as DomainError).code;
  }
}

describe('GET /reviews/submissions/:submissionId (the only route with mentor notes)', () => {
  const roles = new Reflector().getAllAndOverride<AuthUser['roles']>(REQUIRED_ROLES, [
    ReviewsController.prototype.page,
    ReviewsController,
  ]);
  const access = (u: AuthUser) => () =>
    checkAccess(u, { isPublic: false, allowPending: false, roles });

  it('needs the mentor role', () => {
    expect(roles).toEqual(['mentor']);
  });

  it('turns members away and lets mentors and admins in', () => {
    expect(codeOf(access(user(['member'], 'u-member')))).toBe('FORBIDDEN');
    expect(codeOf(access(user(['member', 'mentor'])))).toBeUndefined();
    expect(codeOf(access(user(['admin'])))).toBeUndefined();
  });
});

describe('ReviewsService.page', () => {
  function service(mentorNotesMd: string | null) {
    const exercise = {
      id: 'e1',
      title: 'Mở pull request đầu tiên',
      type: 'code',
      statementMd: '# Đề',
      mentorNotesMd,
      track: { id: 't1', slug: 'git', title: 'Git', starterRepo: null },
    } as unknown as ExerciseContext;
    const submission = {
      id: 's1',
      userId: 'u-member',
      exerciseId: 'e1',
      attempt: 1,
      status: 'pending_review',
      sourceUrl: null,
      note: null,
      submittedAt: new Date('2026-11-19T00:00:00Z'),
    };
    const submissions = {
      forReview: async () => ({ submission, exercise, rubric: [], earlierAttempts: [] }),
    };
    const records = { forSubmissions: async () => new Map(), openFor: async () => new Map() };
    const people = { byIds: async () => new Map() };
    const none = {} as never;
    return new ReviewsService(
      none,
      submissions as never,
      records as never,
      people as never,
      none,
      none,
      none,
      none,
      none,
    );
  }

  it('gives the mentor the exercise notes', async () => {
    const page = await service(NOTES).page(user(['mentor']), 's1');
    expect(page.exercise.mentorNotesMd).toBe(NOTES);
  });

  it('sends null when the exercise has no notes', async () => {
    const page = await service(null).page(user(['admin']), 's1');
    expect(page.exercise.mentorNotesMd).toBeNull();
  });
});
