import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * loadTrackStats (learning-hub#118) turns the API's 403 into "no access" (null) and lets
 * everything else through: 401 is already a redirect to /login inside `api`, and 404/422
 * are already the not-found page inside `apiOrNotFound`.
 */
const mocks = vi.hoisted(() => {
  class ApiError extends Error {
    constructor(readonly problem: { status: number; code: string }) {
      super(String(problem.status));
    }
  }
  return { ApiError, apiOrNotFound: vi.fn(), getMe: vi.fn() };
});

vi.mock('server-only', () => ({}));
vi.mock('./api', () => ({
  ApiError: mocks.ApiError,
  api: vi.fn(),
  apiOrNotFound: mocks.apiOrNotFound,
  getMe: mocks.getMe,
}));

const { canSeeTrackStats, loadTrackStats } = await import('./track');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadTrackStats', () => {
  it('returns the stats', async () => {
    mocks.apiOrNotFound.mockResolvedValue({ data: { track: { slug: 'sql' } } });
    await expect(loadTrackStats('sql', 14)).resolves.toEqual({ track: { slug: 'sql' } });
    expect(mocks.apiOrNotFound).toHaveBeenCalledWith('/tracks/sql/stats?days=14');
  });

  it('returns null when the API says 403 (not an admin or mentor)', async () => {
    mocks.apiOrNotFound.mockRejectedValue(new mocks.ApiError({ status: 403, code: 'FORBIDDEN' }));
    await expect(loadTrackStats('sql', 14)).resolves.toBeNull();
  });

  it('lets the sign-in redirect of a 401 through', async () => {
    // `api` calls redirect('/login') on 401, which throws Next's redirect error.
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;/login' });
    mocks.apiOrNotFound.mockRejectedValue(redirect);
    await expect(loadTrackStats('sql', 14)).rejects.toBe(redirect);
  });

  it('rethrows other API errors for the error page', async () => {
    const failure = new mocks.ApiError({ status: 500, code: 'INTERNAL_ERROR' });
    mocks.apiOrNotFound.mockRejectedValue(failure);
    await expect(loadTrackStats('sql', 14)).rejects.toBe(failure);
  });
});

describe('canSeeTrackStats', () => {
  it('follows the viewer roles, and is false for a guest', async () => {
    mocks.getMe.mockResolvedValueOnce({ roles: ['member', 'mentor'] });
    await expect(canSeeTrackStats()).resolves.toBe(true);
    mocks.getMe.mockResolvedValueOnce({ roles: ['member'] });
    await expect(canSeeTrackStats()).resolves.toBe(false);
    mocks.getMe.mockResolvedValueOnce(null);
    await expect(canSeeTrackStats()).resolves.toBe(false);
  });
});
