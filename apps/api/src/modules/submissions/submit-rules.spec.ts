import { DomainError } from '../../common/errors';
import type { CodeSpec, ProjectSpec } from './exercise-spec';
import {
  acceptedUrlFor,
  assertCanSubmit,
  assertSameRequest,
  canViewSubmission,
  linkSubmissionStatus,
  nextAttempt,
  parseIdempotencyKey,
} from './submit-rules';

describe('assertCanSubmit', () => {
  it('allows an open exercise of a matching type', () => {
    expect(() => assertCanSubmit({ type: 'quiz', state: 'attempted' }, ['quiz'])).not.toThrow();
    expect(() =>
      assertCanSubmit({ type: 'project', state: 'needs_changes' }, ['code', 'project']),
    ).not.toThrow();
  });

  it('409 when the endpoint does not match the type, or the exercise is locked/completed', () => {
    const cases = [
      () => assertCanSubmit({ type: 'quiz', state: 'not_started' }, ['code', 'project']),
      () => assertCanSubmit({ type: 'quiz', state: 'locked' }, ['quiz']),
      () => assertCanSubmit({ type: 'quiz', state: 'completed' }, ['quiz']),
    ];
    for (const run of cases) {
      expect(run).toThrow(DomainError);
      expect(run).toThrow(expect.objectContaining({ code: 'CONFLICT', status: 409 }));
    }
  });
});

describe('acceptedUrlFor / linkSubmissionStatus', () => {
  it('reads submit.kind for code and deliverable for project', () => {
    const code = { submit: { kind: 'github_commit', allowedPaths: [] } } as unknown as CodeSpec;
    const project = { deliverable: 'link', rubric: [] } as unknown as ProjectSpec;
    expect(acceptedUrlFor({ type: 'code', spec: code })).toBe('github_commit');
    expect(acceptedUrlFor({ type: 'project', spec: project })).toBe('link');
  });

  it('code waits for checks, project waits for a mentor', () => {
    expect(linkSubmissionStatus('code')).toBe('submitted');
    expect(linkSubmissionStatus('project')).toBe('awaiting_review');
  });
});

describe('nextAttempt', () => {
  it('starts at 1 and increments the previous max', () => {
    expect(nextAttempt(null)).toBe(1);
    expect(nextAttempt(undefined)).toBe(1);
    expect(nextAttempt(3)).toBe(4);
  });
});

describe('parseIdempotencyKey', () => {
  it('accepts a UUID (case-insensitive, stored lower-cased)', () => {
    expect(parseIdempotencyKey('6F1C0F5E-1234-4ABC-8DEF-0123456789AB')).toBe(
      '6f1c0f5e-1234-4abc-8def-0123456789ab',
    );
  });

  it('400 when missing or not a UUID', () => {
    for (const bad of [undefined, '', 'abc', ['nope']]) {
      expect(() => parseIdempotencyKey(bad)).toThrow(
        expect.objectContaining({ code: 'BAD_REQUEST', status: 400 }),
      );
    }
  });
});

describe('assertSameRequest', () => {
  const original = { exerciseId: 'e1', sourceUrl: 'https://github.com/a/b/pull/1' };

  it('passes for the same exercise and URL', () => {
    expect(() => assertSameRequest(original, { ...original })).not.toThrow();
  });

  it('422 for a different URL or exercise under the same key', () => {
    expect(() =>
      assertSameRequest(original, { ...original, sourceUrl: 'https://github.com/a/b/pull/2' }),
    ).toThrow(expect.objectContaining({ status: 422 }));
    expect(() => assertSameRequest(original, { ...original, exerciseId: 'e2' })).toThrow(
      expect.objectContaining({ status: 422 }),
    );
  });
});

describe('canViewSubmission', () => {
  it('owner, mentor and admin can read; another member cannot', () => {
    expect(canViewSubmission({ id: 'u1', roles: ['member'] }, 'u1')).toBe(true);
    expect(canViewSubmission({ id: 'u2', roles: ['member', 'mentor'] }, 'u1')).toBe(true);
    expect(canViewSubmission({ id: 'u3', roles: ['admin'] }, 'u1')).toBe(true);
    expect(canViewSubmission({ id: 'u4', roles: ['member', 'content_maintainer'] }, 'u1')).toBe(
      false,
    );
  });
});
