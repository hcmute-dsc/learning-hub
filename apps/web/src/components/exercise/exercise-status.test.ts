import { describe, expect, it } from 'vitest';
import { statusBanner, submissionTone } from './exercise-status';

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
