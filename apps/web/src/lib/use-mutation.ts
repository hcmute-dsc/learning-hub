'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { ProblemDetails } from '@hub/shared';
import type { SendResult } from './client-api';

/**
 * One way for every button/form that changes data: send the request, then reload the
 * server-rendered page data with `router.refresh()`.
 *
 * Why the transition: `router.refresh()` returns immediately and the new data arrives a
 * moment later. Without `startTransition` the button would be enabled again while the
 * old state is still on screen, so members clicked twice (bug reported 17/11/2026).
 * `busy` stays true until the refreshed page has rendered.
 */
export function useMutation() {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [problem, setProblem] = useState<ProblemDetails | null>(null);

  async function run<T>(send: () => Promise<SendResult<T>>): Promise<SendResult<T>> {
    setSending(true);
    setProblem(null);
    const result = await send();
    if (result.ok) {
      startTransition(() => router.refresh());
    } else {
      setProblem(result.problem);
    }
    setSending(false);
    return result;
  }

  return { run, busy: sending || refreshing, problem, setProblem };
}
