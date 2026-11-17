import type { PersonRef } from '@hub/shared';
import {
  parseStoredScores,
  toCompletedReview,
  toOpenReview,
  toQueueItem,
  type ReviewRow,
} from './review-view';

const reviewer: PersonRef = {
  id: 'mentor-1',
  githubLogin: 'mentor',
  displayName: 'Mentor A',
  avatarUrl: null,
};

const row: ReviewRow = {
  id: 'r1',
  submissionId: 's1',
  reviewerId: 'mentor-1',
  status: 'changes_requested',
  summaryMd: 'Thiếu index cho bảng orders.',
  rubricScores: [
    { criterion: 'Schema', weight: 60, score: 30 },
    { criterion: 'Query', weight: 40, score: 40 },
  ],
  submittedAt: new Date('2026-11-17T08:00:00Z'),
  createdAt: new Date('2026-11-17T07:00:00Z'),
};

describe('toCompletedReview', () => {
  it('maps a finished review with its rubric total', () => {
    expect(toCompletedReview(row, reviewer)).toEqual({
      id: 'r1',
      outcome: 'changes_requested',
      summaryMd: 'Thiếu index cho bảng orders.',
      rubricScores: [
        { criterion: 'Schema', weight: 60, score: 30 },
        { criterion: 'Query', weight: 40, score: 40 },
      ],
      rubricTotal: 70,
      reviewer,
      completedAt: '2026-11-17T08:00:00.000Z',
    });
  });

  it('never turns an in-progress review (a draft) into a completed one', () => {
    expect(toCompletedReview({ ...row, status: 'in_progress', submittedAt: null }, reviewer)).toBe(
      null,
    );
  });

  it('has a null total when there are no scores', () => {
    expect(toCompletedReview({ ...row, rubricScores: null }, reviewer)?.rubricTotal).toBeNull();
  });
});

describe('parseStoredScores', () => {
  it('skips malformed entries', () => {
    expect(
      parseStoredScores([{ criterion: 'A', weight: 1, score: 1 }, { criterion: 'B' }, null, 'x']),
    ).toEqual([{ criterion: 'A', weight: 1, score: 1 }]);
    expect(parseStoredScores({ not: 'an array' })).toEqual([]);
  });
});

describe('toOpenReview', () => {
  it('uses the claim time', () => {
    expect(toOpenReview({ ...row, status: 'in_progress', submittedAt: null }, reviewer)).toEqual({
      id: 'r1',
      submissionId: 's1',
      reviewer,
      claimedAt: '2026-11-17T07:00:00.000Z',
    });
  });
});

describe('toQueueItem', () => {
  it('adds waiting hours against the target', () => {
    const item = toQueueItem({
      row: {
        id: 's1',
        userId: 'member-1',
        exerciseId: 'e1',
        attempt: 2,
        status: 'awaiting_review',
        sourceUrl: 'https://github.com/member/project',
        note: null,
        submittedAt: new Date('2026-11-13T00:00:00Z'),
        exercise: { id: 'e1', title: 'Final project' },
        track: { slug: 'sql', title: 'SQL' },
      },
      member: { ...reviewer, id: 'member-1' },
      openReview: null,
      now: new Date('2026-11-17T01:00:00Z'),
      targetHours: 72,
    });
    expect(item).toMatchObject({
      submissionId: 's1',
      attempt: 2,
      hoursWaiting: 97,
      overTarget: true,
      exercise: { id: 'e1', title: 'Final project' },
      track: { slug: 'sql', title: 'SQL' },
      openReview: null,
    });
  });
});
