import { describe, expect, it } from 'vitest';
import { nextHintStatus } from './hints';

const hints = (next: { position: number; cost: number; ready: boolean } | null) => ({
  total: 3,
  opened: [],
  next,
});

describe('nextHintStatus', () => {
  it('offers the next hint when the API says it is ready', () => {
    expect(
      nextHintStatus(hints({ position: 2, cost: 1, ready: true }), {
        attempts: 1,
        state: 'attempted',
      }),
    ).toEqual({ kind: 'ready', position: 2, label: 'Mở gợi ý 2/3' });
  });

  it('says how many attempts are still needed', () => {
    const status = nextHintStatus(hints({ position: 3, cost: 3, ready: false }), {
      attempts: 1,
      state: 'attempted',
    });
    expect(status).toEqual({
      kind: 'waiting',
      position: 3,
      reason: 'Gợi ý 3 mở được sau 3 lần nộp (còn 2 lần).',
    });
  });

  it('points to the prerequisites on a locked exercise', () => {
    const status = nextHintStatus(hints({ position: 1, cost: 0, ready: false }), {
      attempts: 0,
      state: 'locked',
    });
    expect(status.kind === 'waiting' && status.reason).toContain('tiên quyết');
  });

  it('has nothing to offer when every hint is open', () => {
    expect(nextHintStatus(hints(null), { attempts: 0, state: 'completed' })).toEqual({
      kind: 'none',
    });
  });
});
