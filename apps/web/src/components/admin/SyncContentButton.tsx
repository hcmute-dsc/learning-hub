'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ContentVersionStatus } from '@hub/shared';
import { ProblemAlert } from '@/components/exercise/ProblemAlert';
import { sendJson } from '@/lib/client-api';
import { useMutation } from '@/lib/use-mutation';
import { shortSha, VERSION_STATUS_LABEL } from './content-version';

interface SyncedVersion {
  id: string;
  commitSha: string;
  status: ContentVersionStatus;
}

/**
 * "Đồng bộ từ GitHub": POST /admin/content/sync reads the newest commit and records a
 * draft (it never changes what members see; publishing does). `knownIds` are the
 * versions already listed, to tell "new draft" from "this commit was synced before".
 */
export function SyncContentButton({ knownIds }: { knownIds: string[] }) {
  const router = useRouter();
  const { run, busy, problem } = useMutation();
  const [result, setResult] = useState<{ version: SyncedVersion; isNew: boolean } | null>(null);

  async function sync() {
    setResult(null);
    const res = await run(() => sendJson<SyncedVersion>('/admin/content/sync', 'POST', {}));
    if (res.ok) {
      setResult({ version: res.data, isNew: !knownIds.includes(res.data.id) });
      // Show the new draft in "Các phiên bản" too, not only in the message above (#87).
      router.refresh();
    } else if (res.problem.status === 422) {
      // Invalid content is still recorded as a `rejected` version: show it in the list.
      router.refresh();
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={sync}
        disabled={busy}
        aria-busy={busy}
        className="press rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? 'Đang đồng bộ…' : 'Đồng bộ từ GitHub'}
      </button>
      <div aria-live="polite">
        {result && (
          <p className="motion-fade-up mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
            {result.isNew
              ? `Đã đọc commit ${shortSha(result.version.commitSha)}: ${VERSION_STATUS_LABEL[result.version.status].toLowerCase()} mới.`
              : `Commit ${shortSha(result.version.commitSha)} đã được đồng bộ trước đó (${VERSION_STATUS_LABEL[result.version.status].toLowerCase()}).`}{' '}
            <Link
              href={`/admin/content/versions/${result.version.id}`}
              className="font-medium underline"
            >
              Xem chi tiết
            </Link>
          </p>
        )}
      </div>
      <ProblemAlert problem={problem} />
    </div>
  );
}
