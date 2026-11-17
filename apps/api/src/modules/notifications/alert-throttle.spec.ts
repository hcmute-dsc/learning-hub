import { AlertThrottle, errorSignature } from './alert-throttle';

const MIN = 60_000;

describe('AlertThrottle', () => {
  it('sends the same signature once per 10 minutes', () => {
    const t = new AlertThrottle();
    expect(t.check('a', 0).send).toBe(true);
    expect(t.check('a', 5 * MIN).send).toBe(false);
    expect(t.check('a', 10 * MIN)).toEqual({ send: true, suppressed: 1 });
  });

  it('lets different signatures through', () => {
    const t = new AlertThrottle();
    expect(t.check('a', 0).send).toBe(true);
    expect(t.check('b', 0).send).toBe(true);
  });

  it('caps all alerts per window and counts what it dropped', () => {
    const t = new AlertThrottle({ globalMax: 2, globalWindowMs: 60 * MIN });
    expect(t.check('a', 0).send).toBe(true);
    expect(t.check('b', 1).send).toBe(true);
    expect(t.check('c', 2)).toEqual({ send: false, suppressed: 1 });
    expect(t.check('d', 3)).toEqual({ send: false, suppressed: 2 });
    expect(t.check('e', 60 * MIN)).toEqual({ send: true, suppressed: 2 });
  });
});

describe('errorSignature', () => {
  it('treats different ids as the same error', () => {
    const a = errorSignature(
      'GET',
      '/api/v1/submissions/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
      'Error',
      'timeout after 5000 ms',
    );
    const b = errorSignature(
      'GET',
      '/api/v1/submissions/0190ffff-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
      'Error',
      'timeout after 3000 ms',
    );
    expect(a).toBe(b);
  });

  it('keeps different routes and errors apart', () => {
    expect(errorSignature('GET', '/a', 'E', 'm')).not.toBe(errorSignature('POST', '/a', 'E', 'm'));
    expect(errorSignature('GET', '/a', 'E', 'm')).not.toBe(errorSignature('GET', '/b', 'E', 'm'));
    expect(errorSignature('GET', '/a', 'E', 'm')).not.toBe(errorSignature('GET', '/a', 'F', 'm'));
  });
});
