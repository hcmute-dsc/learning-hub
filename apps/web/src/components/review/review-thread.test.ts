import { describe, expect, it } from 'vitest';
import { REVIEW_MESSAGE_MAX, REVIEW_THANKS_MAX } from '@hub/shared';
import { messageError, thanksError, threadTitle } from './review-thread';

describe('review conversation helpers (learning-hub#41)', () => {
  it('refuses an empty or too long message', () => {
    expect(messageError('   ')).not.toBeNull();
    expect(messageError('x'.repeat(REVIEW_MESSAGE_MAX + 1))).not.toBeNull();
    expect(messageError(`  ${'x'.repeat(REVIEW_MESSAGE_MAX)}  `)).toBeNull();
  });

  it('refuses an empty or too long thank-you', () => {
    expect(thanksError('')).not.toBeNull();
    expect(thanksError('x'.repeat(REVIEW_THANKS_MAX + 1))).not.toBeNull();
    expect(thanksError('Cảm ơn anh!')).toBeNull();
  });

  it('names the other side in the heading', () => {
    expect(threadTitle('mentee', 0)).toBe('Trao đổi với mentor');
    expect(threadTitle('mentor', 3)).toBe('Trao đổi với thành viên (3)');
    expect(threadTitle('admin', 1)).toBe('Trao đổi với thành viên (1)');
  });
});
