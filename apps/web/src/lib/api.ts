import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { Me, ProblemDetails } from '@hub/shared';

const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.title);
  }
}

/**
 * Headers every server-side API call carries for the member: their cookies, and the
 * client address the reverse proxy put in X-Forwarded-For. The API limits requests per
 * client IP (ThrottlerModule); without this header every page render would come from
 * the web container's address, and all members together would share one limit.
 */
async function memberHeaders(): Promise<Record<string, string>> {
  const forwarded: Record<string, string> = { cookie: (await cookies()).toString() };
  const clientIp = (await headers()).get('x-forwarded-for');
  if (clientIp) forwarded['x-forwarded-for'] = clientIp;
  return forwarded;
}

/**
 * Server-side API call that forwards the user's cookies and IP. Permission decisions
 * stay in the API; this only redirects on 401 / pending accounts.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}/api/v1${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...(await memberHeaders()), ...(init.headers ?? {}) },
    cache: 'no-store',
  });
  if (res.ok) return (await res.json()) as T;

  const problem = (await res.json().catch(() => null)) as ProblemDetails | null;
  if (res.status === 401) redirect('/login');
  if (problem?.code === 'ACCOUNT_PENDING') redirect('/pending');
  throw new ApiError(
    problem ?? {
      type: 'about:blank',
      title: res.statusText,
      status: res.status,
      code: 'INTERNAL_ERROR',
    },
  );
}

/**
 * `api` for a page's main resource: 404 (missing or archived) and 422 (malformed id or
 * slug, rejected by the API's ZodPipe) both show the not-found page instead of the
 * error page. Every other error is rethrown.
 */
export async function apiOrNotFound<T>(path: string): Promise<T> {
  try {
    return await api<T>(path);
  } catch (e) {
    if (e instanceof ApiError && (e.problem.status === 404 || e.problem.status === 422)) {
      notFound();
    }
    throw e;
  }
}

/**
 * Current user or null (never redirects). Wrapped in React `cache`, so the layout, the page
 * and helpers such as `canSeeTrackStats` share one /auth/me call per request (the cache
 * lives for one server render, and the cookies are that request's own).
 */
export const getMe = cache(async (): Promise<Me | null> => {
  const member = await memberHeaders();
  if (!member.cookie) return null;
  const res = await fetch(`${API}/api/v1/auth/me`, {
    headers: { Accept: 'application/json', ...member },
    cache: 'no-store',
  }).catch(() => null);
  if (!res?.ok) return null;
  return ((await res.json()) as { data: Me }).data;
});
