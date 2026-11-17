import { describe, expect, it } from 'vitest';
import { bannerReview, statusBanner, submissionTone } from './exercise-status';

describe('statusBanner', () => {
  it('has no banner while the panel already says what to do', () => {
    expect(statusBanner('not_started')).toBeNull();
    expect(statusBanner('attempted')).toBeNull();
  });

  it('gives each waiting or finished state its own tone', () => {
    expect(statusBanner('locked')?.tone).toBe('neutral');
    expect(statusBanner('testing')?.tone).toBe('info');
    expect(statusBanner('in_review')?.tone).toBe('review');
    expect(statusBanner('needs_changes')?.tone).toBe('warning');
    expect(statusBanner('completed')?.tone).toBe('success');
  });
});

describe('submissionTone', () => {
  it('maps results to tones', () => {
    expect(submissionTone('passed')).toBe('success');
    expect(submissionTone('approved')).toBe('success');
    expect(submissionTone('failed')).toBe('danger');
    expect(submissionTone('errored')).toBe('danger');
    expect(submissionTone('changes_requested')).toBe('warning');
    expect(submissionTone('awaiting_review')).toBe('review');
    expect(submissionTone('submitted')).toBe('info');
    expect(submissionTone('testing')).toBe('info');
  });
});

describe('bannerReview', () => {
  const review = {
    id: 'r1',
    outcome: 'changes_requested' as const,
    summaryMd: 'Sửa index.',
    rubricScores: [],
    rubricTotal: null,
    reviewer: { id: 'm1', githubLogin: 'mentor', displayName: 'Mentor', avatarUrl: null },
    completedAt: '2026-11-17T08:00:00.000Z',
  };
  const history = [
    { id: 's2', review: null },
    { id: 's1', review },
  ];

  it('picks the newest finished review when it explains the state', () => {
    expect(bannerReview('needs_changes', history)).toEqual({ submissionId: 's1', review });
    expect(bannerReview('completed', history)?.submissionId).toBe('s1');
  });

  it('stays quiet while a new attempt waits for review', () => {
    expect(bannerReview('in_review', history)).toBeNull();
    expect(bannerReview('needs_changes', [{ id: 's1', review: null }])).toBeNull();
  });
});
