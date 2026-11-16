import 'server-only';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { Me, ProblemDetails } from '@hub/shared';

const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.title);
  }
}

/**
 * Server-side API call that forwards the user's cookies. Permission decisions stay
 * in the API; this only redirects on 401 / pending accounts.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${API}/api/v1${path}`, {
    ...init,
    headers: { Accept: 'application/json', cookie: cookieHeader, ...(init.headers ?? {}) },
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

/** Current user or null (never redirects). */
export async function getMe(): Promise<Me | null> {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return null;
  const res = await fetch(`${API}/api/v1/auth/me`, {
    headers: { Accept: 'application/json', cookie: cookieHeader },
    cache: 'no-store',
  }).catch(() => null);
  if (!res?.ok) return null;
  return ((await res.json()) as { data: Me }).data;
}
