import type { ProblemDetails } from '@hub/shared';

export type SendResult<T> = { ok: true; data: T } | { ok: false; problem: ProblemDetails };

/**
 * Browser-side mutation through the same-origin /api rewrite. The browser adds the
 * Origin header itself, which the API's OriginGuard requires (SECURITY §5). Errors
 * come back as a value, so forms can show them instead of throwing.
 */
export async function sendJson<T>(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<SendResult<T>> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, problem: offlineProblem() };
  }

  if (res.ok) {
    const json = (await res.json().catch(() => null)) as { data: T } | null;
    return { ok: true, data: json?.data as T };
  }
  const problem = (await res.json().catch(() => null)) as ProblemDetails | null;
  return {
    ok: false,
    problem: problem ?? {
      type: 'about:blank',
      title: res.statusText,
      status: res.status,
      code: 'INTERNAL_ERROR',
    },
  };
}

function offlineProblem(): ProblemDetails {
  return {
    type: 'about:blank',
    title: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
    status: 0,
    code: 'INTERNAL_ERROR',
  };
}
