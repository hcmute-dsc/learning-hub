'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ProblemDetails } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';

/** One click → POST /notifications/unsubscribe with the token from the email link. */
export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [problem, setProblem] = useState<ProblemDetails | null>(null);

  async function unsubscribe() {
    setState('busy');
    setProblem(null);
    const res = await sendJson('/notifications/unsubscribe', 'POST', { token });
    if (res.ok) {
      setState('done');
    } else {
      setProblem(res.problem);
      setState('idle');
    }
  }

  if (state === 'done') {
    return (
      <p className="mt-3 text-sm" role="status">
        Đã tắt. Bạn sẽ không nhận email tóm tắt nữa. Bật lại bất cứ lúc nào trong{' '}
        <Link href="/settings" className="text-brand-600 hover:underline">
          Cài đặt
        </Link>
        .
      </p>
    );
  }
  return (
    <div className="mt-3">
      <p className="muted text-sm">
        Bạn sẽ không nhận email tóm tắt hằng ngày nữa. Chuông thông báo trên trang vẫn hoạt động.
      </p>
      <button
        type="button"
        onClick={unsubscribe}
        disabled={state === 'busy'}
        className="press mt-4 rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {state === 'busy' ? 'Đang tắt…' : 'Tắt email tóm tắt'}
      </button>
      <ProblemAlert problem={problem} />
    </div>
  );
}
